import logging
import os
import subprocess
import asyncio
import sqlite3
import shutil
import uuid
from collections import OrderedDict
from fastapi import FastAPI, HTTPException, Form, BackgroundTasks, WebSocket, WebSocketDisconnect, Path, APIRouter, Request, UploadFile, File
from yt_dlp import YoutubeDL
from fastapi.middleware.cors import CORSMiddleware
from datetime import datetime
from fastapi.responses import FileResponse
from urllib.parse import unquote
import os

# Импортируем компонент счётчика
from counter import counter_app

# Настройка логирования
logging.basicConfig(level=logging.WARNING)
logger = logging.getLogger(__name__)

# Указываем путь к FFmpeg
FFMPEG_PATH = r"/usr/bin/ffmpeg"
os.environ["PATH"] = os.path.dirname(FFMPEG_PATH) + os.pathsep + os.environ.get("PATH", "")
COOKIE_TXT_PATH = "/cookies.txt"  # Абсолютный путь в контейнере

# Проверка наличия FFmpeg
if not os.path.isfile(FFMPEG_PATH):
    logger.error("FFmpeg не найден. Убедитесь, что FFmpeg установлен и путь указан правильно.")
    raise RuntimeError("FFmpeg не найден. Убедитесь, что FFmpeg установлен и путь указан правильно.")

# Папка загрузок
DOWNLOAD_DIR = "/root/Downloads"
os.makedirs(DOWNLOAD_DIR, exist_ok=True)

# Создаём FastAPI приложение
app = FastAPI()
app.mount("/counter", counter_app)

# Настройка CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "https://videovault.ru"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ========== КЛАСС МЕНЕДЖЕРА ОЧЕРЕДИ ==========

class DownloadQueue:
    def __init__(self, max_concurrent=1):
        self.queue = OrderedDict()
        self.active_tasks = {}
        self.task_status = {}
        self.max_concurrent = max_concurrent
        self.lock = asyncio.Lock()
        self.worker_task = None
        self.websocket_connections = {}
        
    async def add_task(self, task_data: dict) -> dict:
        """Добавляет задачу в очередь"""
        task_id = str(uuid.uuid4())
        
        async with self.lock:
            position = len(self.queue) + 1
            self.queue[task_id] = {
                **task_data,
                'added_at': datetime.now(),
                'status': 'waiting'
            }
            
            self.task_status[task_id] = {
                'progress': 0,
                'message': 'В очереди',
                'completed': False,
                'filename': None,
                'error': None,
                'position': position
            }
        await self._update_queue_positions()
        # Запускаем воркер, если он не запущен
        if not self.worker_task or self.worker_task.done():
            self.worker_task = asyncio.create_task(self.process_queue())
            
        return {
            'task_id': task_id,
            'queue_position': position
        }

    def get_task_id_by_filename(self, filename: str) -> str | None:
            """Находит task_id по имени файла"""
            for task_id, status in self.task_status.items():
                if status.get('filename') == filename:
                    return task_id
            return None

    async def get_task_status(self, task_id: str) -> dict:
        """Получает статус задачи"""
        async with self.lock:
            return self.task_status.get(task_id, {
                'progress': 0,
                'message': 'Задача не найдена',
                'completed': False,
                'error': True,
                'position': 0
            })
    

    async def update_task_status(self, task_id: str, **kwargs):
        """Обновляет статус задачи"""
        async with self.lock:
            if task_id in self.task_status:
                self.task_status[task_id].update(kwargs)
                
        # Уведомляем WebSocket соединения
        if task_id in self.websocket_connections:
            status = await self.get_task_status(task_id)
            for ws in list(self.websocket_connections[task_id]):
                try:
                    await ws.send_json(status)
                except:
                    self.websocket_connections[task_id].remove(ws)

    async def add_websocket_connection(self, task_id: str, websocket: WebSocket):
        """Добавляет WebSocket соединение для задачи"""
        if task_id not in self.websocket_connections:
            self.websocket_connections[task_id] = []
        self.websocket_connections[task_id].append(websocket)
        
        # Отправляем текущий статус сразу
        status = await self.get_task_status(task_id)
        await websocket.send_json(status)
    
    async def remove_websocket_connection(self, task_id: str, websocket: WebSocket):
        """Удаляет WebSocket соединение"""
        if task_id in self.websocket_connections:
            if websocket in self.websocket_connections[task_id]:
                self.websocket_connections[task_id].remove(websocket)
    
    async def remove_task(self, task_id: str):
        """Удаляет задачу из системы"""
        async with self.lock:
            # Удаляем из всех структур
            self.queue.pop(task_id, None)
            self.active_tasks.pop(task_id, None)
            self.task_status.pop(task_id, None)
            
            # Закрываем WebSocket соединения этой задачи
            if task_id in self.websocket_connections:
                for ws in self.websocket_connections[task_id]:
                    try:
                        await ws.close()
                    except:
                        pass
                del self.websocket_connections[task_id]
        
        # ОБЯЗАТЕЛЬНО обновляем позиции остальных задач
        await self._update_queue_positions()

    async def _update_queue_positions(self):
        """Обновляет позиции всех задач в очереди и уведомляет WS"""
        async with self.lock:
            for i, (tid, _) in enumerate(self.queue.items()):
                if tid in self.task_status:
                    self.task_status[tid]['position'] = i + 1
                    # Отправляем WebSocket напрямую, минуя update_task_status
                    if tid in self.websocket_connections:
                        status_snapshot = dict(self.task_status[tid])
                        for ws in list(self.websocket_connections[tid]):
                            try:
                                await ws.send_json(status_snapshot)
                            except:
                                self.websocket_connections[tid].remove(ws)


    async def process_queue(self):
        while True:
            try:
                async with self.lock:
                    # Проверяем, есть ли свободные слоты
                    if len(self.active_tasks) >= self.max_concurrent:
                        await asyncio.sleep(1)
                        continue
                    
                    # Находим следующую задачу со статусом 'waiting'
                    task_id = None
                    task_data = None
                    
                    for tid, data in self.queue.items():
                        if tid not in self.active_tasks and data.get('status') == 'waiting':
                            task_id = tid
                            task_data = data
                            break
                    
                    if not task_id:
                        await asyncio.sleep(1)
                        continue
                    
                    # Обновляем статус задачи
                    self.queue[task_id]['status'] = 'processing'
                    self.active_tasks[task_id] = task_data
                
                # Обновляем статус для WebSocket
                await self.update_task_status(
                    task_id, 
                    message='Начинаем загрузку...', 
                    progress=5
                )
                
                # Запускаем задачу в фоне
                asyncio.create_task(self.execute_download_task(task_id, task_data))
                
            except Exception as e:
                logger.error(f"Queue processor error: {e}")
                await asyncio.sleep(1)

    
    async def execute_download_task(self, task_id: str, task_data: dict):
        """Выполняет задачу загрузки"""
        try:
            await self._download_video_task(
                task_id=task_id,
                url=task_data['url'],
                video_format_id=task_data['video_format_id'],
                download_audio=task_data['download_audio']
            )
            
            # Ждем 5 секунд после завершения загрузки, чтобы пользователь мог скачать
            await asyncio.sleep(5)
            
        except Exception as e:
            logger.error(f"Task execution error: {e}")
            await self.update_task_status(task_id,
                progress=-1,
                message=f'Ошибка: {str(e)}',
                error=True
            )
            # Ждем 5 секунд и перед ошибкой
            await asyncio.sleep(5)
        finally:
            # Удаляем из активных задач
            async with self.lock:
                self.active_tasks.pop(task_id, None)
                # Не удаляем из queue здесь - это сделает remove_task
            
            # Удаляем задачу из системы через 60 секунд после завершения
            await asyncio.sleep(60)
            await self.remove_task(task_id)
    
    MAX_FILE_SIZE = 3 * 1024 * 1024 * 1024  # 3GB limit


def _extract_size(fmt: dict):
    """Возвращает filesize или filesize_approx"""
    return fmt.get("filesize") or fmt.get("filesize_approx")


async def _download_video_task(self, task_id: str, url: str, video_format_id: str, download_audio: bool):
        """Основная функция загрузки видео"""

        def progress_hook(d):
            if d['status'] == 'downloading':
                if 'total_bytes' in d and d['total_bytes']:
                    progress = d['downloaded_bytes'] / d['total_bytes'] * 100
                    asyncio.create_task(
                        self.update_task_status(
                            task_id,
                            progress=max(10, progress * 0.9),
                            message=f"Загрузка: {progress:.1f}%"
                        )
                    )
            elif d['status'] == 'finished':
                asyncio.create_task(
                    self.update_task_status(
                        task_id,
                        progress=95,
                        message="Обработка видео..."
                    )
                )

        try:
            await self.update_task_status(
                task_id,
                progress=10,
                message="Подготовка к загрузке..."
            )

            update_yt_dlp()

            # Настройки yt-dlp
            video_opts = {
                "format": f"{video_format_id}+bestaudio/best",
                "outtmpl": os.path.join(DOWNLOAD_DIR, "%(title).200s_%(id)s_%(format_id)s.%(ext)s"),
                "ffmpeg_location": FFMPEG_PATH,
                "cookiefile": COOKIE_TXT_PATH,
                "quiet": True,
                "no_warnings": True,
                "progress_hooks": [progress_hook],
            }

            # Только аудио?
            if download_audio:
                video_opts.update({
                    "format": "bestaudio/best",
                    "postprocessors": [{
                        'key': 'FFmpegExtractAudio',
                        'preferredcodec': 'mp3',
                        'preferredquality': '192',
                    }],
                    "outtmpl": os.path.join(DOWNLOAD_DIR, "%(title).200s_%(id)s.%(ext)s"),
                })

            await self.update_task_status(
                task_id,
                progress=15,
                message="Получение информации о видео..."
            )

            # Получаем info, но БЕЗ скачивания
            with YoutubeDL(video_opts) as ydl:
                info = ydl.extract_info(url, download=False)
                formats = info.get("formats", [])

            # ================================
            # 🔥 Ограничение размера (3GB)
            # ================================
            await self.update_task_status(
                task_id,
                progress=18,
                message="Проверка размера..."
            )

            # Находим выбранный формат
            selected_fmt = next((f for f in formats if f.get("format_id") == video_format_id), None)

            if not selected_fmt:
                raise Exception("Формат не найден")

            video_size = _extract_size(selected_fmt)
            total_size = video_size

            # Если DASH → складываем audio + video
            if selected_fmt.get("acodec") == "none" and not download_audio:
                audio_formats = [f for f in formats if f.get("acodec") != "none" and f.get("vcodec") == "none"]
                if audio_formats:
                    best_audio = max(audio_formats, key=lambda x: _extract_size(x) or 0)
                    audio_size = _extract_size(best_audio)
                    if video_size and audio_size:
                        total_size = video_size + audio_size

            # Ограничение: нельзя скачивать > 3ГБ
            if total_size and total_size > MAX_FILE_SIZE:
                size_gb = total_size / 1024**3
                raise Exception(f"Размер файла {size_gb:.2f} ГБ превышает лимит 3 ГБ.")

            # ================================
            # 🔥 Скачивание
            # ================================

            await self.update_task_status(
                task_id,
                progress=20,
                message="Начинаем загрузку..."
            )

            with YoutubeDL(video_opts) as ydl:
                ydl.download([url])

            # Определяем имя файла
            if download_audio:
                filename = f"{info['title'].replace('/', '_')[:200]}_{info['id']}.mp3"
            else:
                files = os.listdir(DOWNLOAD_DIR)
                matching_files = [f for f in files if info["id"] in f]
                if matching_files:
                    filename = sorted(
                        matching_files,
                        key=lambda x: os.path.getctime(os.path.join(DOWNLOAD_DIR, x)),
                        reverse=True
                    )[0]
                else:
                    filename = f"{info['title'].replace('/', '_')[:200]}_{info['id']}.mp4"

            filepath = os.path.join(DOWNLOAD_DIR, filename)

            if os.path.exists(filepath):
                await self.update_task_status(
                    task_id,
                    progress=100,
                    message="Загрузка завершена!",
                    completed=True,
                    filename=filename
                )
            else:
                raise Exception("Файл не был создан")

        except Exception as e:
            logger.error(f"Download task error for {task_id}: {e}")
            await self.update_task_status(
                task_id,
                progress=-1,
                message=f"Ошибка загрузки: {str(e)}",
                error=True
            )


# Глобальный экземпляр менеджера очереди
download_queue = DownloadQueue(max_concurrent=1)

# ========== ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ==========

# Метод в DownloadQueue для завершения задачи по task_id
async def finish_task_by_id(self, task_id: str):
        """Завершает задачу и удаляет её из очереди"""
        async with self.lock:
            if task_id in self.task_status:
                await self.update_task_status(
                    task_id,
                    progress=100,
                    message="Задача завершена",
                    completed=True
                )
            # Убираем задачу
            await self.remove_task(task_id)

    # Привязываем метод к DownloadQueue
DownloadQueue.finish_task_by_id = finish_task_by_id

def update_yt_dlp():
    try:
        subprocess.run(["pip", "install", "--upgrade", "yt-dlp", "--quiet"], check=True)
        logger.info("yt-dlp обновлена успешно!")
    except subprocess.CalledProcessError as e:
        logger.error(f"Ошибка при обновлении yt-dlp: {e}")

def get_video_info(url: str):
    try:
        ydl_opts = {
            "quiet": True,
            "cookiefile": COOKIE_TXT_PATH
        }
        with YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=False)
            
            # Фильтруем только форматы, у которых есть URL
            formats = []
            for f in info["formats"]:
                if f.get("url"):
                    format_info = {
                        "format_id": f["format_id"],
                        "quality": f.get("format_note", "N/A"),
                        "ext": f["ext"],
                        "resolution": f.get("height", "N/A"),
                        "vcodec": f.get("vcodec", "none"),
                        "type": "Audio" if f.get("vcodec", "none") == "none" else "Video"
                    }
                    # Добавляем только уникальные форматы (по resolution и type)
                    if format_info not in formats:
                        formats.append(format_info)
            
            return {"title": info.get("title", "N/A"), "formats": formats}
    except Exception as e:
        logger.error(f"Error fetching video info: {e}")
        return None

def delete_file(path: str):
    try:
        os.remove(path)
        print(f"Удалён файл: {path}")
    except Exception as e:
        print(f"Ошибка при удалении файла: {e}")

# ========== API ЭНДПОИНТЫ ==========

@app.post("/update_cookies/")
async def update_cookies(file: UploadFile = File(...)):
    try:
        # Читаем файл из запроса
        content = await file.read()

        # Перезаписываем cookies.txt
        with open(COOKIE_TXT_PATH, "wb") as f:
            f.write(content)

        return {"status": "success", "message": "cookies.txt updated"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to update cookies: {e}")

@app.post("/get_video_info/")
async def video_info(url: str = Form(...)):
    video_info = get_video_info(url)

    if video_info:
        # Очищаем папку загрузок от старых файлов
        for filename in os.listdir(DOWNLOAD_DIR):
            file_path = os.path.join(DOWNLOAD_DIR, filename)
            try:
                if os.path.isfile(file_path) or os.path.islink(file_path):
                    # Удаляем только старые файлы (старше 1 часа)
                    if os.path.getmtime(file_path) < datetime.now().timestamp() - 3600:
                        os.remove(file_path)
                elif os.path.isdir(file_path):
                    shutil.rmtree(file_path)
            except Exception as e:
                print(f"Ошибка при удалении {file_path}: {e}")
        return video_info
    raise HTTPException(status_code=400, detail="Не удалось получить информацию о видео")

@app.websocket("/queuesocket/{task_id}")
async def websocket_endpoint(websocket: WebSocket, task_id: str):
    await websocket.accept()
    await download_queue.add_websocket_connection(task_id, websocket)
    
    try:
        # Отправляем обновления каждую секунду
        while True:
            await asyncio.sleep(1)
            status = await download_queue.get_task_status(task_id)
            
            # Проверяем, завершена ли задача
            if status.get('completed') or status.get('error'):
                # Ждем немного перед закрытием соединения
                await asyncio.sleep(5)
                break
                
    except WebSocketDisconnect:
        logger.info(f"WebSocket disconnected for task {task_id}")
    except Exception as e:
        logger.error(f"WebSocket error for task {task_id}: {e}")
    finally:
        await download_queue.remove_websocket_connection(task_id, websocket)

@app.post("/download_video/")
async def download_video(
    url: str = Form(...),
    video_format_id: str = Form(...),
    download_audio: bool = Form(False),
):
    try:
        # Проверяем, что формат существует
        video_info = get_video_info(url)
        if not video_info:
            raise HTTPException(status_code=400, detail="Не удалось получить информацию о видео")
        
        # Проверяем, что выбранный формат доступен
        format_ids = [f["format_id"] for f in video_info["formats"]]
        if video_format_id not in format_ids:
            raise HTTPException(status_code=400, detail="Выбранный формат недоступен")
        
        # Добавляем задачу в очередь
        task_info = await download_queue.add_task({
            'url': url,
            'video_format_id': video_format_id,
            'download_audio': download_audio,
            'requested_at': datetime.now()
        })
        
        return {
            "task_id": task_info['task_id'],
            "queue_position": task_info['queue_position'],
            "message": "Задача добавлена в очередь"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Ошибка при добавлении в очередь: {str(e)}")

@app.get("/task_status/{task_id}")
async def get_task_status(task_id: str):
    status = await download_queue.get_task_status(task_id)
    return status

@app.get("/queue_status/")
async def get_queue_status():
    """Получить статус всей очереди"""
    async with download_queue.lock:
        waiting_tasks = sum(1 for task in download_queue.queue.values() if task['status'] == 'waiting')
        processing_tasks = len(download_queue.active_tasks)
        
        return {
            "waiting": waiting_tasks,
            "processing": processing_tasks,
            "max_concurrent": download_queue.max_concurrent,
            "total_tasks": len(download_queue.queue)
        }

from fastapi import BackgroundTasks
from fastapi.responses import StreamingResponse
from fastapi import BackgroundTasks

@app.get("/download/{filename:path}")
async def download_file(filename: str = Path(...)):
    file_path = os.path.join(DOWNLOAD_DIR, filename)

    if not os.path.isfile(file_path):
        raise HTTPException(status_code=404, detail=f"File not found: {file_path}")

    task_id = download_queue.get_task_id_by_filename(filename)
    
    async def file_iterator():
        try:
            with open(file_path, "rb") as f:
                while chunk := f.read(1024 * 1024):
                    yield chunk
        finally:
            # НЕ удаляем задачу сразу - она удалится через 60 секунд после завершения
            # в методе execute_download_task
            pass



    async def file_iterator():
        try:
            with open(file_path, "rb") as f:
                while chunk := f.read(1024 * 1024):
                    yield chunk
        finally:
            # Убираем задачу из очереди после завершения скачки
            if task_id:
                await download_queue.remove_task(task_id)
            if task_id:
                await download_queue.update_task_status(
                    task_id,
                    message="Скачивание файла...",
                    progress=100
                )

    return StreamingResponse(file_iterator(), media_type="application/octet-stream")




# ========== СТАРЫЙ МЕТОД (для совместимости) ==========

@app.post("/download_video_old/")
async def download_video_old(
    background_tasks: BackgroundTasks,
    url: str = Form(...),
    video_format_id: str = Form(...),
    download_audio: bool = Form(False),
):
    """Старый метод для обратной совместимости"""
    
    # Создаем задачу для очереди
    task_info = await download_queue.add_task({
        'url': url,
        'video_format_id': video_format_id,
        'download_audio': download_audio,
        'requested_at': datetime.now()
    })
    
    return {
        "task_id": task_info['task_id'],
        "queue_position": task_info['queue_position'],
        "message": "Задача добавлена в очередь (старый метод)"
    }

# ========== ЗАПУСК ПРИЛОЖЕНИЯ ==========

@app.on_event("startup")
async def startup_event():
    """Запускаем обработчик очереди при старте приложения"""
    logger.info("Starting download queue processor...")
    if not download_queue.worker_task:
        download_queue.worker_task = asyncio.create_task(download_queue.process_queue())

@app.on_event("shutdown")
async def shutdown_event():
    """Останавливаем обработчик очереди при выключении"""
    logger.info("Shutting down download queue processor...")
    if download_queue.worker_task:
        download_queue.worker_task.cancel()

# Запуск приложения (для отладки)
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
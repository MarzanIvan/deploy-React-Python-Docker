import logging
import os
import shutil
import subprocess
import asyncio
from datetime import datetime

from fastapi import FastAPI, HTTPException, Form, File, UploadFile, WebSocket, WebSocketDisconnect, Path
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from yt_dlp import YoutubeDL

# Импортируем компонент счётчика
from counter import counter_app

# Настройка логирования
logging.basicConfig(level=logging.WARNING)
logger = logging.getLogger(__name__)

# Указываем путь к FFmpeg
FFMPEG_PATH = r"/usr/bin/ffmpeg"
os.environ["PATH"] = os.path.dirname(FFMPEG_PATH) + os.pathsep + os.environ.get("PATH", "")

# Проверка наличия FFmpeg
if not os.path.isfile(FFMPEG_PATH):
    logger.error("FFmpeg не найден. Убедитесь, что FFmpeg установлен и путь указан правильно.")
    raise RuntimeError("FFmpeg не найден. Убедитесь, что FFmpeg установлен и путь указан правильно.")

# Папка загрузок
DOWNLOAD_DIR = os.path.join(os.path.expanduser("~"), "/Downloads")
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

# Очередь загрузок и прогресс
download_queue = asyncio.Queue()
tasks_progress = {}
task_counter = 0

# =====================
# Функции для работы с загрузкой
# =====================
async def update_yt_dlp():
    """Обновление yt-dlp"""
    try:
        subprocess.run(["pip", "install", "--upgrade", "yt-dlp", "--quiet"], check=True)
        logger.info("yt-dlp обновлена успешно!")
    except subprocess.CalledProcessError as e:
        logger.error(f"Ошибка при обновлении yt-dlp: {e}")

async def yt_download_task(task_id: int, url: str, video_format_id: str, download_audio: bool):
    """Загрузка видео через yt-dlp"""
    def progress_hook(d):
        if d['status'] == 'downloading' and 'total_bytes' in d and d['total_bytes']:
            tasks_progress[task_id]['progress'] = d['downloaded_bytes'] / d['total_bytes'] * 100
            tasks_progress[task_id]['message'] = f"Загрузка: {tasks_progress[task_id]['progress']:.2f}%"
        elif d['status'] == 'finished':
            tasks_progress[task_id]['progress'] = 100
            tasks_progress[task_id]['message'] = "Загрузка завершена"

    await update_yt_dlp()

    # Очистка предыдущих загрузок
    for filename in os.listdir(DOWNLOAD_DIR):
        file_path = os.path.join(DOWNLOAD_DIR, filename)
        try:
            if os.path.isfile(file_path) or os.path.islink(file_path):
                os.remove(file_path)
            elif os.path.isdir(file_path):
                shutil.rmtree(file_path)
        except Exception as e:
            logger.warning(f"Ошибка при удалении {file_path}: {e}")

    video_opts = {
        "format": f"{video_format_id}+bestaudio/best",
        "outtmpl": os.path.join(DOWNLOAD_DIR, "%(timestamp)s_video.%(ext)s"),
        "progress_hooks": [progress_hook],
        "ffmpeg_location": FFMPEG_PATH,
        "cookiefile": "cookies.txt",
    }

    audio_opts = {
        "format": "bestaudio",
        "outtmpl": os.path.join(DOWNLOAD_DIR, "%(timestamp)s_audio.%(ext)s"),
        "progress_hooks": [progress_hook],
        "ffmpeg_location": FFMPEG_PATH,
        "cookiefile": "cookies.txt",
    }

    video_file, audio_file = None, None

    # Скачиваем видео
    with YoutubeDL(video_opts) as ydl:
        info = ydl.extract_info(url, download=False)
        ydl.download([url])
        video_file = os.path.join(DOWNLOAD_DIR, f"{info['timestamp']}_video.{info['ext']}")
        tasks_progress[task_id]['filename'] = os.path.basename(video_file)

    # Скачиваем аудио если нужно
    if download_audio:
        with YoutubeDL(audio_opts) as ydl:
            ydl.download([url])
            audio_file = os.path.join(DOWNLOAD_DIR, f"{info['timestamp']}_audio.{info['ext']}")

        # Объединяем видео и аудио
        output_file = os.path.join(DOWNLOAD_DIR, f"final_{datetime.now().strftime('%Y%m%d_%H%M%S')}.mp4")
        ffmpeg_command = [
            FFMPEG_PATH, '-i', video_file, '-i', audio_file,
            '-c:v', 'copy', '-c:a', 'aac', '-threads', '4', '-preset', 'ultrafast', output_file
        ]
        subprocess.run(ffmpeg_command, shell=False)
        tasks_progress[task_id]['filename'] = os.path.basename(output_file)

# =====================
# Очередь
# =====================
async def process_queue():
    while True:
        task_id, download_task = await download_queue.get()
        try:
            tasks_progress[task_id]["message"] = "Загрузка началась"
            await download_task()
        except Exception as e:
            tasks_progress[task_id]["progress"] = -1
            tasks_progress[task_id]["message"] = f"Ошибка: {e}"
        finally:
            download_queue.task_done()

@app.on_event("startup")
async def startup_event():
    asyncio.create_task(process_queue())

# =====================
# Endpoints
# =====================
@app.post("/download_video/")
async def download_video(
    url: str = Form(...),
    video_format_id: str = Form(...),
    download_audio: bool = Form(False),
):
    global task_counter
    task_id = task_counter
    task_counter += 1

    tasks_progress[task_id] = {"progress": 0, "message": "Ожидает в очереди", "filename": ""}

    async def task():
        await yt_download_task(task_id, url, video_format_id, download_audio)

    await download_queue.put((task_id, task))
    queue_position = download_queue.qsize()
    return {"task_id": task_id, "queue_position": queue_position}

@app.websocket("/queuesocket/{task_id}")
async def websocket_endpoint(websocket: WebSocket, task_id: int):
    await websocket.accept()
    try:
        while True:
            progress_data = tasks_progress.get(task_id)
            if progress_data:
                await websocket.send_json(progress_data)
                if progress_data['progress'] >= 100 or progress_data['progress'] == -1:
                    break
            await asyncio.sleep(1)
    except WebSocketDisconnect:
        logger.info(f"WebSocket disconnected for task {task_id}")

@app.get("/download/{filename:path}")
async def download_file(filename: str = Path(...)):
    file_path = os.path.join(DOWNLOAD_DIR, filename)
    if not os.path.isfile(file_path):
        raise HTTPException(status_code=404, detail=f"File not found: {file_path}")
    return FileResponse(path=file_path, filename=os.path.basename(file_path), media_type='application/octet-stream')

@app.post("/update_cookies/")
async def update_cookies(file: UploadFile = File(...)):
    try:
        content = await file.read()
        with open("cookies.txt", "wb") as f:
            f.write(content)
        return {"status": "success", "message": "cookies.txt updated"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to update cookies: {e}")

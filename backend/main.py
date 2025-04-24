import logging
import os
import subprocess
import asyncio
import sqlite3
from fastapi import FastAPI, HTTPException, Form, BackgroundTasks, WebSocket, WebSocketDisconnect
from yt_dlp import YoutubeDL
from fastapi.middleware.cors import CORSMiddleware
from datetime import datetime

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
DOWNLOAD_DIR = os.path.join(os.path.expanduser("~"), "Downloads")
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

# Прогресс загрузки
download_progress = {"progress": 0, "message": ""}

# Функция обновления yt-dlp
def update_yt_dlp():
    try:
        subprocess.run(["pip", "install", "--upgrade", "yt-dlp", "--quiet"], check=True)
        logger.info("yt-dlp обновлена успешно!")
    except subprocess.CalledProcessError as e:
        logger.error(f"Ошибка при обновлении yt-dlp: {e}")

def load_cookies_from_db(cookie_db_path):
    cookies = []
    try:
        conn = sqlite3.connect(cookie_db_path)
        cursor = conn.cursor()

        cursor.execute("SELECT name, value, domain FROM moz_cookies")
        rows = cursor.fetchall()

        for row in rows:
            cookies.append(f"{row[0]}={row[1]}; domain={row[2]}")

        conn.close()
    except Exception as e:
        logger.error(f"Ошибка при загрузке cookies: {e}")
    
    return cookies

# Функция получения информации о видео
def get_video_info(url: str):
    try:
        ydl_opts = {
            "quiet": True,
            "cookiefile": "cookies.txt"
        }  # Указываем cookies здесь}
        with YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=False)
            formats = [{
                "format_id": f["format_id"],
                "quality": f.get("format_note", "N/A"),
                "ext": f["ext"],
                "resolution": f.get("height", "N/A"),
                "vcodec": f.get("vcodec", "none"),
                "type": "Audio" if f.get("vcodec", "none") == "none" else "Video"
            } for f in info["formats"]]
            
            return {"title": info["title"], "formats": formats}
    except Exception as e:
        logger.error(f"Error fetching video info: {e}")
        return None

@app.post("/get_video_info/")
async def video_info(url: str = Form(...)):
    video_info = get_video_info(url)
    if (video_info):
        return video_info
    raise HTTPException(status_code=400, detail="Не удалось получить информацию о видео")

@app.websocket("wss/socket/")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    try:
        while True:
            await websocket.send_json(download_progress)
            await asyncio.sleep(1)  # Частота обновления прогресса
    except WebSocketDisconnect:
        logger.info("WebSocket disconnected")

@app.post("/download_video/")
async def download_video(
    background_tasks: BackgroundTasks,
    url: str = Form(...),
    video_format_id: str = Form(...),
    download_audio: bool = Form(False),
):
    global download_progress
    download_progress = {"progress": 0, "message": "Загрузка началась"}

    def download_task(url, video_format_id, download_audio):
        def progress_hook(d):
            global download_progress
            if d['status'] == 'downloading' and 'total_bytes' in d and d['total_bytes']:
                download_progress['progress'] = d['downloaded_bytes'] / d['total_bytes'] * 100
                download_progress['message'] = f"Загрузка: {download_progress['progress']:.2f}%"
            elif d['status'] == 'finished':
                download_progress['progress'] = 100
                download_progress['message'] = "Успешно загружено"

        try:
            update_yt_dlp()
            cookies = load_cookies_from_db(os.environ.get("COOKIE_DB_PATH", "/home/root/.mozilla/firefox/guest/cookies.sqlite"))  # Укажите путь к вашему файлу cookies.sqlite
            video_opts = {
                "format": f"{video_format_id}+bestaudio/best",
                "outtmpl": os.path.join(DOWNLOAD_DIR, "%(title)s_%(timestamp)s_video.%(ext)s"),
                "progress_hooks": [progress_hook],
                "ffmpeg_location": FFMPEG_PATH,
                "cookiefile": "cookies.txt"
            }

            audio_opts = {
                "format": "bestaudio",
                "outtmpl": os.path.join(DOWNLOAD_DIR, "%(title)s_%(timestamp)s_audio.%(ext)s"),
                "progress_hooks": [progress_hook],
                "ffmpeg_location": FFMPEG_PATH,
                "cookiefile": "cookies.txt"
            }

            video_file, audio_file = None, None
            with YoutubeDL(video_opts) as ydl:
                info = ydl.extract_info(url, download=False)
                ydl.download([url])
                video_file = os.path.join(DOWNLOAD_DIR, f"{info['title']}_{info['timestamp']}_video.{info['ext']}")

            if download_audio:
                with YoutubeDL(audio_opts) as ydl:
                    ydl.download([url])
                    audio_file = os.path.join(DOWNLOAD_DIR, f"{info['title']}_{info['timestamp']}_audio.{info['ext']}")

                output_file = os.path.join(DOWNLOAD_DIR, f"final_{datetime.now().strftime('%Y%m%d_%H%M%S')}.mp4")

                ffmpeg_command = [FFMPEG_PATH, '-i', video_file, '-i', audio_file, '-c:v', 'copy', '-c:a', 'aac', '-threads', '4', '-preset', 'ultrafast', output_file]
                subprocess.run(ffmpeg_command, shell=True)

            download_progress['message'] = "Спасибо, что воспользовались нашим сервисом! Загрузка завершена."
        except Exception as e:
            logger.error(f"Ошибка загрузки: {e}")
            download_progress['progress'] = -1
            download_progress['message'] = "Ошибка при загрузке. Проверьте загруженные файлы."

    background_tasks.add_task(download_task, url, video_format_id, download_audio)
    return {"message": "Загрузка началась в фоне. Пожалуйста, ожидайте."}

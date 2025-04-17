
import logging
import os
import subprocess
import asyncio
from fastapi import FastAPI, HTTPException, Form, BackgroundTasks, WebSocket, WebSocketDisconnect
from yt_dlp import YoutubeDL
from fastapi.middleware.cors import CORSMiddleware
from datetime import datetime
from selenium import webdriver
from selenium.webdriver.firefox.options import Options
import time
import pickle

# Импортируем компонент счётчика
from counter import counter_app

COOKIES_PATH = "./app/cookies.txt/cookies.txt"

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

# Функция получения информации о видео
def get_video_info(url: str):
    try:
        ydl_opts = {
            "quiet": True,
            "cookiefile": "./app/cookies.txt/cookies.txt", 
        }
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

@app.websocket("/ws/progress/")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    try:
        while True:
            await websocket.send_json(download_progress)
            await asyncio.sleep(1)  # Частота обновления прогресса
    except WebSocketDisconnect:
        logger.info("WebSocket disconnected")


def login_and_save_cookies(email: str, password: str):
    options = Options()
    options.add_argument("--headless")
    options.add_argument("--no-sandbox")

    driver = webdriver.Firefox(options=options)
    try:
        driver.get("https://accounts.google.com/signin/v2/identifier?service=youtube")

        time.sleep(2)
        driver.find_element("id", "identifierId").send_keys(email)
        driver.find_element("id", "identifierNext").click()

        time.sleep(3)
        driver.find_element("name", "password").send_keys(password)
        driver.find_element("id", "passwordNext").click()

        time.sleep(10)  # Подожди пока загрузится

        os.makedirs(os.path.dirname(COOKIES_PATH), exist_ok=True)
        with open(COOKIES_PATH, "wb") as file:
            pickle.dump(driver.get_cookies(), file)

        return True
    except Exception as e:
        print("Ошибка входа:", e)
        return False
    finally:
        driver.quit()

def load_cookies_to_browser(driver):
    if not os.path.exists(COOKIES_PATH):
        return
    with open(COOKIES_PATH, "rb") as file:
        cookies = pickle.load(file)
        for cookie in cookies:
            driver.add_cookie(cookie)

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

            video_opts = {
                "format": f"{video_format_id}+bestaudio/best",
                "outtmpl": os.path.join(DOWNLOAD_DIR, "%(title)s_%(timestamp)s_video.%(ext)s"),
                "progress_hooks": [progress_hook],
                "ffmpeg_location": FFMPEG_PATH,
                "cookiefile": "./app/cookies.txt/cookies.txt"
            }

            audio_opts = {
                "format": "bestaudio",
                "outtmpl": os.path.join(DOWNLOAD_DIR, "%(title)s_%(timestamp)s_audio.%(ext)s"),
                "progress_hooks": [progress_hook],
                "ffmpeg_location": FFMPEG_PATH,
                "cookiefile": "./app/cookies.txt/cookies.txt"  
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

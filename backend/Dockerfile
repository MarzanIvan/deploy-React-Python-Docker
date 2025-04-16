FROM python:3.13-slim

COPY requirements.txt requirements.txt
##RUN pip install -r requirements.txt
RUN pip install -r requirements.txt --default-timeout=1250 future
# Обновляем пакеты и устанавливаем ffmpeg + зависимости

# Обновляем пакеты и устанавливаем зависимости для Google Chrome
RUN apt-get update && \
    apt-get install -y \
    wget \
    curl \
    gnupg2 \
    ca-certificates \
    --no-install-recommends && \
    rm -rf /var/lib/apt/lists/*

# Скачиваем и устанавливаем Google Chrome (stable версия)
RUN wget https://dl.google.com/linux/direct/google-chrome-stable_current_amd64.deb && \
    apt install -y ./google-chrome-stable_current_amd64.deb && \
    rm google-chrome-stable_current_amd64.deb
    
RUN apt-get update && \
    apt-get install -y ffmpeg && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*


RUN pip install python-multipart
RUN pip install uvicorn[standard]

COPY . .

CMD ["python", "-m", "uvicorn", "main:app", "--reload", "--host", "0.0.0.0", "--port", "8000"]


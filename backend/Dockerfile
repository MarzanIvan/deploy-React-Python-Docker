FROM python:3.13-slim

# Обновляем пакеты и устанавливаем ffmpeg + зависимости
RUN apt-get update && \
    apt-get install -y ffmpeg && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

COPY requirements.txt requirements.txt
##RUN pip install -r requirements.txt
RUN pip install -r requirements.txt --default-timeout=1250 future
RUN pip install python-multipart


COPY . .

CMD [ "python", "main.py"]
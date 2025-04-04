FROM python:3.11.9-slim

# Устанавливаем переменные окружения для прокси
ENV https_proxy=http://47.251.122.81:8888

COPY requirements.txt requirements.txt
RUN pip install -r requirements.txt

COPY . .

CMD [ "python", "main.py"]
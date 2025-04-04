FROM python:3.11.9-slim

# Устанавливаем переменные окружения для прокси
ENV http_proxy=http://myproxy:8080
ENV https_proxy=http://myproxy:8080

COPY requirements.txt requirements.txt
RUN pip install -r requirements.txt

COPY . .

CMD [ "python", "main.py"]
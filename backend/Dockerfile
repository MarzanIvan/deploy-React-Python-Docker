FROM python:3.12-slim

COPY requirements.txt requirements.txt

RUN pip install -r requirements.txt --default-timeout=1250 future

# Install ffmpeg + Node.js runtime
RUN apt-get update && \
    apt-get install -y ffmpeg nodejs npm && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

RUN pip install -U "yt-dlp[default]"
RUN pip install python-multipart
RUN pip install uvicorn[standard]

COPY . .

CMD ["python", "-m", "uvicorn", "main:app", "--reload", "--host", "0.0.0.0", "--port", "8000"]
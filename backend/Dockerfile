FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

COPY requirements.txt ./requirements.txt

RUN pip install -r requirements.txt --default-timeout=1250 future

# Install ffmpeg + system dependencies (curl/unzip for deno, git for bgutil)
RUN apt-get update && \
    apt-get install -y \
        ffmpeg \
        ca-certificates \
        openssl \
        curl \
        unzip \
        git \
    && update-ca-certificates \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Install deno — recommended JS runtime for yt-dlp (required for PO Token generation)
RUN curl -fsSL https://deno.land/install.sh | sh
ENV DENO_INSTALL="/root/.deno"
ENV PATH="${DENO_INSTALL}/bin:${PATH}"

RUN pip install -U "yt-dlp[default]"
RUN pip install python-multipart
RUN pip install uvicorn[standard]

# Install bgutil PO Token provider plugin for YouTube downloads
RUN pip install bgutil-ytdlp-pot-provider && \
    git clone https://github.com/Brainicism/bgutil-ytdlp-pot-provider.git /root/bgutil-ytdlp-pot-provider && \
    cd /root/bgutil-ytdlp-pot-provider/server && \
    deno install

COPY . .

EXPOSE 8000

# The application keeps its download queue in memory, so it must run as a
# single production worker. Never enable --reload here: without an explicit
# reload directory WatchFiles scans the whole container filesystem.
CMD ["python", "-m", "uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--proxy-headers", "--forwarded-allow-ips=*"]

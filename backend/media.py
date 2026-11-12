"""
Платформы и медиа-материалы: определение платформы по ссылке (YouTube, Instagram),
нормализация метаданных yt-dlp (описание, обложка, теги, материалы поста),
прокси для обложек/фото и выгрузка выбранных материалов в ZIP.

Модуль не зависит от очереди загрузок из main.py.
"""

import html as html_lib
import io
import json
import logging
import os
import re
import zipfile
from typing import Optional
from urllib.parse import quote, urlparse

import requests
from fastapi import APIRouter, Form, HTTPException, Query
from fastapi.concurrency import run_in_threadpool
from fastapi.responses import Response, StreamingResponse

logger = logging.getLogger("media")

PROXY_URL = os.environ.get("PROXY_URL", "")

# ---------------------------------------------------------------- платформы

YOUTUBE_HOSTS = ("youtube.com", "youtu.be", "youtube-nocookie.com")
INSTAGRAM_HOSTS = ("instagram.com", "instagr.am")

# Хосты, с которых разрешено проксировать медиа (защита от SSRF).
MEDIA_HOST_SUFFIXES = ("cdninstagram.com", "fbcdn.net", "ytimg.com", "ggpht.com")

IMAGE_EXTS = ("jpg", "jpeg", "png", "webp", "heic")


def _host(url: str) -> str:
    try:
        return (urlparse(url.strip()).hostname or "").lower()
    except ValueError:
        return ""


def _host_in(host: str, suffixes) -> bool:
    return any(host == s or host.endswith("." + s) for s in suffixes)


def detect_platform(url: str) -> str:
    """'youtube' | 'instagram' | 'other'."""
    host = _host(url if "//" in url else "https://" + url)
    if _host_in(host, INSTAGRAM_HOSTS):
        return "instagram"
    if _host_in(host, YOUTUBE_HOSTS):
        return "youtube"
    return "other"


# ------------------------------------------------------------- метаданные

HASHTAG_RE = re.compile(r"#(\w+)", re.UNICODE)


def _has(codec: Optional[str]) -> bool:
    return bool(codec) and codec != "none"


def extract_hashtags(text: str) -> list[str]:
    seen, result = set(), []
    for tag in HASHTAG_RE.findall(text or ""):
        key = tag.lower()
        if key not in seen:
            seen.add(key)
            result.append(tag)
    return result


def best_thumbnail(info: dict) -> Optional[str]:
    thumbs = [t for t in (info.get("thumbnails") or []) if t.get("url")]
    if thumbs:
        best = max(
            thumbs,
            key=lambda t: ((t.get("width") or 0) * (t.get("height") or 0), t.get("preference") or 0),
        )
        return best["url"]
    return info.get("thumbnail")


def build_formats(info: dict) -> list[dict]:
    """Все доступные качества: видео — от большего к меньшему, аудио — в конце."""
    formats, seen = [], set()
    for f in info.get("formats") or []:
        if not f.get("url") or f.get("ext") == "mhtml":
            continue
        fid = str(f["format_id"])
        if fid in seen:
            continue
        seen.add(fid)
        has_video = _has(f.get("vcodec"))
        height = f.get("height")
        formats.append({
            "format_id": fid,
            "quality": f.get("format_note") or (f"{height}p" if height else "N/A"),
            "ext": f.get("ext"),
            "resolution": height or "N/A",
            "vcodec": f.get("vcodec") or "none",
            "type": "Video" if has_video else "Audio",
            "width": f.get("width"),
            "height": height,
            "fps": f.get("fps"),
            "filesize": f.get("filesize") or f.get("filesize_approx"),
            "has_audio": _has(f.get("acodec")),
        })
    formats.sort(key=lambda x: (x["type"] != "Video", -(x["height"] or 0), -(x["fps"] or 0)))
    return formats


def _image_url(entry: dict) -> Optional[str]:
    if entry.get("url") and str(entry.get("ext", "")).lower() in IMAGE_EXTS:
        return entry["url"]
    images = [f for f in (entry.get("formats") or [])
              if f.get("url") and str(f.get("ext", "")).lower() in IMAGE_EXTS]
    if images:
        return max(images, key=lambda f: (f.get("width") or 0) * (f.get("height") or 0))["url"]
    return best_thumbnail(entry)


def _entry_to_item(entry: dict) -> Optional[dict]:
    thumb = best_thumbnail(entry)
    videos = [f for f in (entry.get("formats") or []) if f.get("url") and _has(f.get("vcodec"))]
    if videos:
        best = max(videos, key=lambda f: (_has(f.get("acodec")), f.get("height") or 0, f.get("tbr") or 0))
        return {
            "type": "video",
            "url": best["url"],
            "ext": best.get("ext") or "mp4",
            "thumbnail": thumb or best["url"],
            "width": best.get("width"),
            "height": best.get("height"),
            "duration": entry.get("duration"),
        }
    image = _image_url(entry)
    if not image:
        return None
    return {
        "type": "image",
        "url": image,
        "ext": "jpg",
        "thumbnail": image,
        "width": entry.get("width"),
        "height": entry.get("height"),
        "duration": None,
    }


def build_items(info: dict) -> list[dict]:
    """Материалы поста: фото и видео карусели, отдельное фото."""
    entries = [e for e in (info.get("entries") or []) if e]
    items = [it for it in map(_entry_to_item, entries) if it]
    if items or entries:
        for index, item in enumerate(items, start=1):
            item["index"] = index
        return items
    # Пост из одной картинки, без видео
    if not any(_has(f.get("vcodec")) for f in (info.get("formats") or [])):
        image = _image_url(info)
        if image:
            return [{"index": 1, "type": "image", "url": image, "ext": "jpg",
                     "thumbnail": image, "width": info.get("width"),
                     "height": info.get("height"), "duration": None}]
    return []


def normalize_info(info: dict, url: str) -> dict:
    """Единый формат ответа для фронтенда."""
    platform = detect_platform(url)
    description = (info.get("description") or "").strip()
    tags = list(info.get("tags") or [])
    for tag in extract_hashtags(description):
        if tag.lower() not in {t.lower() for t in tags}:
            tags.append(tag)

    items = build_items(info)
    formats = build_formats(info)
    if len(items) > 1:
        kind = "carousel"
    elif items and not formats:
        kind = "image"
    else:
        kind = "video"

    return {
        "platform": platform,
        "kind": kind,
        "title": info.get("title") or "N/A",
        "description": description,
        "thumbnail": best_thumbnail(info) or (items[0]["thumbnail"] if items else None),
        "uploader": info.get("uploader") or info.get("channel") or info.get("uploader_id"),
        "duration": info.get("duration"),
        "tags": tags[:30],
        "formats": formats,
        "items": items,
    }


# --------------------------------------------- запасной способ для Instagram

_UA = ("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
       "(KHTML, like Gecko) Chrome/124.0 Safari/537.36")
_SHORTCODE_RE = re.compile(r"instagram\.com/(?:[\w.]+/)?(?:p|reel|reels|tv)/([\w-]+)")


def _proxies() -> Optional[dict]:
    return {"http": PROXY_URL, "https": PROXY_URL} if PROXY_URL else None


def instagram_embed_fallback(url: str) -> Optional[dict]:
    """
    Публичные фото-посты yt-dlp иногда не умеет разбирать. Тогда читаем
    встраиваемую страницу поста. Это best-effort: разметка Instagram меняется.
    """
    match = _SHORTCODE_RE.search(url)
    if not match:
        return None
    try:
        response = requests.get(
            f"https://www.instagram.com/p/{match.group(1)}/embed/captioned/",
            headers={"User-Agent": _UA, "Accept-Language": "en-US,en;q=0.9"},
            proxies=_proxies(),
            timeout=20,
        )
        response.raise_for_status()
    except requests.RequestException as error:
        logger.warning("Instagram embed fallback failed: %s", error)
        return None

    page = response.text.replace('\\"', '"').replace("\\/", "/").replace("\\u0026", "&")
    media = re.findall(r'"(display_url|video_url)":"(https:[^"]+)"', page)
    items, seen = [], set()
    for kind, link in media:
        link = html_lib.unescape(link)
        if link in seen:
            continue
        seen.add(link)
        is_video = kind == "video_url"
        items.append({"type": "video" if is_video else "image", "url": link,
                      "ext": "mp4" if is_video else "jpg", "thumbnail": link,
                      "width": None, "height": None, "duration": None})
    # Для видео display_url — это обложка того же элемента; оставляем только видео
    if any(i["type"] == "video" for i in items):
        covers = {i["url"] for i in items if i["type"] == "image"}
        if len(covers) <= sum(1 for i in items if i["type"] == "video"):
            items = [i for i in items if i["type"] == "video"]
    if not items:
        return None
    for index, item in enumerate(items, start=1):
        item["index"] = index

    caption = ""
    caption_match = re.search(r'"text":"((?:[^"\\]|\\.)*)"', page)
    if caption_match:
        try:
            caption = json.loads(f'"{caption_match.group(1)}"')
        except ValueError:
            caption = caption_match.group(1)
    owner = re.search(r'"username":"([^"]+)"', page)

    return {
        "platform": "instagram",
        "kind": "carousel" if len(items) > 1 else ("image" if items[0]["type"] == "image" else "video"),
        "title": (caption.split("\n")[0][:100] if caption else "Instagram"),
        "description": caption,
        "thumbnail": items[0]["thumbnail"],
        "uploader": owner.group(1) if owner else None,
        "duration": None,
        "tags": extract_hashtags(caption)[:30],
        "formats": [],
        "items": items,
    }


# ------------------------------------------------- прокси медиа и ZIP

media_router = APIRouter(prefix="/media")

MAX_ZIP_ITEMS = 30
MAX_ZIP_BYTES = 300 * 1024 * 1024
MAX_FILE_BYTES = 500 * 1024 * 1024


def _check_media_url(url: str) -> str:
    parsed = urlparse(url)
    if parsed.scheme != "https" or not _host_in((parsed.hostname or "").lower(), MEDIA_HOST_SUFFIXES):
        raise HTTPException(status_code=400, detail="Unsupported media host")
    return url


def _safe_name(name: str, default: str) -> str:
    name = re.sub(r"[^\w.\- ]", "_", name or "", flags=re.UNICODE).strip(" .")
    return name[:120] or default


def _attachment_header(filename: str) -> str:
    ascii_name = filename.encode("ascii", "replace").decode().replace("?", "_")
    return f"attachment; filename=\"{ascii_name}\"; filename*=UTF-8''{quote(filename)}"


def _ext_for(content_type: str) -> str:
    if content_type.startswith("video"):
        return "mp4"
    if "png" in content_type:
        return "png"
    if "webp" in content_type:
        return "webp"
    return "jpg"


def _open_upstream(url: str) -> requests.Response:
    try:
        upstream = requests.get(
            _check_media_url(url),
            headers={"User-Agent": _UA},
            proxies=_proxies(),
            stream=True,
            timeout=30,
            allow_redirects=False,
        )
    except requests.RequestException as error:
        logger.warning("Media fetch failed: %s", error)
        raise HTTPException(status_code=502, detail="Failed to fetch media")
    if upstream.status_code != 200:
        upstream.close()
        raise HTTPException(status_code=502, detail="Failed to fetch media")
    if int(upstream.headers.get("Content-Length") or 0) > MAX_FILE_BYTES:
        upstream.close()
        raise HTTPException(status_code=413, detail="File is too large")
    return upstream


@media_router.get("/proxy")
async def media_proxy(
    u: str = Query(..., max_length=4000),
    download: bool = False,
    name: str = Query("", max_length=200),
):
    """Обложки/фото/видео с CDN: показ на сайте (без Referer) и скачивание файлом."""
    upstream = await run_in_threadpool(_open_upstream, u)
    content_type = upstream.headers.get("Content-Type", "application/octet-stream")
    headers = {"Cache-Control": "private, max-age=3600"}
    if download:
        filename = _safe_name(name, "instagram")
        if "." not in filename[-5:]:
            filename = f"{filename}.{_ext_for(content_type)}"
        headers["Content-Disposition"] = _attachment_header(filename)
    if upstream.headers.get("Content-Length"):
        headers["Content-Length"] = upstream.headers["Content-Length"]

    def stream():
        try:
            for chunk in upstream.iter_content(chunk_size=1024 * 256):
                yield chunk
        finally:
            upstream.close()

    return StreamingResponse(stream(), media_type=content_type, headers=headers)


def _build_zip(urls: list[str], base_name: str) -> bytes:
    buffer = io.BytesIO()
    total = 0
    with zipfile.ZipFile(buffer, "w", zipfile.ZIP_STORED) as archive:
        for index, link in enumerate(urls, start=1):
            upstream = _open_upstream(link)
            try:
                ext = _ext_for(upstream.headers.get("Content-Type", ""))
                data = upstream.content
            finally:
                upstream.close()
            total += len(data)
            if total > MAX_ZIP_BYTES:
                raise HTTPException(status_code=413, detail="Archive is too large")
            archive.writestr(f"{base_name}_{index:02d}.{ext}", data)
    return buffer.getvalue()


@media_router.post("/zip")
async def media_zip(urls: list[str] = Form(...), name: str = Form("instagram")):
    if not urls or len(urls) > MAX_ZIP_ITEMS:
        raise HTTPException(status_code=400, detail="Invalid number of items")
    for link in urls:
        _check_media_url(link)
    base = _safe_name(name, "instagram")
    data = await run_in_threadpool(_build_zip, urls, base)
    return Response(
        content=data,
        media_type="application/zip",
        headers={"Content-Disposition": _attachment_header(f"{base}.zip"), "Cache-Control": "no-store"},
    )

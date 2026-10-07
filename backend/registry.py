"""
Реестр согласий пользователей (152-ФЗ).

Фиксирует факт принятия правовых документов и выбор по cookie (дата, IP,
браузер, редакции документов) в PostgreSQL и отдает весь реестр в виде
Excel-файла по паролю.

Модуль намеренно изолирован от очереди загрузок: если база недоступна,
скачивание видео продолжает работать, а запись согласия просто повторяется
при следующем подключении.
"""

import asyncio
import hmac
import hashlib
import io
import logging
import os
import time
from collections import defaultdict, deque
from datetime import datetime, timedelta, timezone
from typing import Optional

import asyncpg
from fastapi import APIRouter, Form, HTTPException, Request
from fastapi.responses import StreamingResponse
from openpyxl import Workbook
from openpyxl.styles import Alignment, Font, PatternFill
from openpyxl.utils import get_column_letter
from pydantic import BaseModel, Field

logger = logging.getLogger("registry")

DATABASE_URL = os.environ.get("DATABASE_URL", "")
REGISTRY_PASSWORD = os.environ.get("REGISTRY_PASSWORD", "")

MSK = timezone(timedelta(hours=3))

ALLOWED_EVENTS = {
    "legal_accepted": "Принятие Политики, Согласия на обработку ПДн и Соглашения",
    "cookies_accepted": "Согласие на необязательные cookie",
    "cookies_rejected": "Отказ от необязательных cookie",
}

# Защита пароля от перебора: после 5 неудачных попыток за 15 минут IP блокируется.
MAX_FAILED_ATTEMPTS = 5
LOCKOUT_SECONDS = 15 * 60

# Защита базы от засорения: не больше 30 записей согласия в минуту с одного IP.
MAX_CONSENTS_PER_MINUTE = 30

registry_router = APIRouter()

_pool: Optional[asyncpg.Pool] = None
_pool_lock = asyncio.Lock()
_failed_attempts: dict[str, deque] = defaultdict(deque)
_consent_hits: dict[str, deque] = defaultdict(deque)

SCHEMA = """
CREATE TABLE IF NOT EXISTS consent_registry (
    id              BIGSERIAL PRIMARY KEY,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    event           TEXT        NOT NULL,
    ip_address      INET,
    user_agent      TEXT,
    accept_language TEXT,
    visitor_id      TEXT,
    page_url        TEXT,
    language        TEXT,
    documents       TEXT
);
CREATE INDEX IF NOT EXISTS consent_registry_created_at_idx ON consent_registry (created_at);
"""


async def get_pool() -> asyncpg.Pool:
    """Подключается к базе при первом обращении, чтобы сбой БД не мешал старту сервиса."""
    global _pool
    if _pool is not None:
        return _pool
    async with _pool_lock:
        if _pool is None:
            if not DATABASE_URL:
                raise RuntimeError("DATABASE_URL is not configured")
            pool = await asyncpg.create_pool(DATABASE_URL, min_size=1, max_size=5, command_timeout=30)
            async with pool.acquire() as conn:
                await conn.execute(SCHEMA)
            _pool = pool
    return _pool


async def registry_startup() -> None:
    try:
        await get_pool()
    except Exception as error:  # база может подняться позже — подключимся при первом запросе
        logger.warning("Consent registry database is not ready yet: %s", error)


async def registry_shutdown() -> None:
    if _pool is not None:
        await _pool.close()


def _client_ip(request: Request) -> str:
    # uvicorn запущен с --proxy-headers: client.host уже содержит реальный IP из X-Forwarded-For,
    # который выставляет Caddy (подделанные клиентом заголовки Caddy отбрасывает).
    return request.client.host if request.client else ""


def _prune(bucket: deque, window: float, now: float) -> None:
    while bucket and now - bucket[0] > window:
        bucket.popleft()


def _clip(value: Optional[str], limit: int) -> Optional[str]:
    if value is None:
        return None
    value = value.strip()
    return value[:limit] if value else None


class ConsentEvent(BaseModel):
    event: str
    visitor_id: Optional[str] = Field(default=None, max_length=100)
    page_url: Optional[str] = Field(default=None, max_length=500)
    language: Optional[str] = Field(default=None, max_length=10)
    documents: Optional[str] = Field(default=None, max_length=500)


@registry_router.post("/consent/")
async def record_consent(payload: ConsentEvent, request: Request):
    if payload.event not in ALLOWED_EVENTS:
        raise HTTPException(status_code=400, detail="Unknown consent event")

    ip = _client_ip(request)
    now = time.monotonic()
    hits = _consent_hits[ip]
    _prune(hits, 60, now)
    if len(hits) >= MAX_CONSENTS_PER_MINUTE:
        raise HTTPException(status_code=429, detail="Too many requests")
    hits.append(now)

    try:
        pool = await get_pool()
        await pool.execute(
            """
            INSERT INTO consent_registry
                (event, ip_address, user_agent, accept_language, visitor_id, page_url, language, documents)
            VALUES ($1, $2::inet, $3, $4, $5, $6, $7, $8)
            """,
            payload.event,
            ip or None,
            _clip(request.headers.get("user-agent"), 500),
            _clip(request.headers.get("accept-language"), 200),
            _clip(payload.visitor_id, 100),
            _clip(payload.page_url, 500),
            _clip(payload.language, 10),
            _clip(payload.documents, 500),
        )
    except Exception as error:
        logger.error("Failed to record consent: %s", error)
        raise HTTPException(status_code=503, detail="Registry is temporarily unavailable")

    return {"status": "recorded"}


def _password_matches(candidate: str) -> bool:
    if not REGISTRY_PASSWORD:
        return False
    # Сравниваем дайджесты постоянной длины за постоянное время — без утечки по таймингу.
    return hmac.compare_digest(
        hashlib.sha256(candidate.encode("utf-8")).digest(),
        hashlib.sha256(REGISTRY_PASSWORD.encode("utf-8")).digest(),
    )


def _build_workbook(rows) -> bytes:
    wb = Workbook()
    ws = wb.active
    ws.title = "Реестр согласий"

    headers = [
        "№",
        "ID записи",
        "Дата и время (МСК)",
        "Событие",
        "IP-адрес",
        "Браузер (User-Agent)",
        "Языки браузера",
        "Язык сайта",
        "ID посетителя",
        "Страница",
        "Редакции документов",
    ]
    widths = [6, 11, 21, 52, 18, 60, 26, 11, 38, 34, 60]

    ws.append(headers)
    header_fill = PatternFill("solid", fgColor="0A84FF")
    for col, width in enumerate(widths, start=1):
        cell = ws.cell(row=1, column=col)
        cell.font = Font(bold=True, color="FFFFFF")
        cell.fill = header_fill
        cell.alignment = Alignment(vertical="center", wrap_text=True)
        ws.column_dimensions[get_column_letter(col)].width = width
    ws.row_dimensions[1].height = 30

    for number, row in enumerate(rows, start=1):
        created = row["created_at"].astimezone(MSK).replace(tzinfo=None)
        ws.append([
            number,
            row["id"],
            created,
            ALLOWED_EVENTS.get(row["event"], row["event"]),
            str(row["ip_address"]) if row["ip_address"] else "",
            row["user_agent"] or "",
            row["accept_language"] or "",
            row["language"] or "",
            row["visitor_id"] or "",
            row["page_url"] or "",
            row["documents"] or "",
        ])
        ws.cell(row=number + 1, column=3).number_format = "DD.MM.YYYY HH:MM:SS"

    ws.freeze_panes = "A2"
    if rows:
        ws.auto_filter.ref = f"A1:{get_column_letter(len(headers))}{len(rows) + 1}"

    buffer = io.BytesIO()
    wb.save(buffer)
    return buffer.getvalue()


@registry_router.post("/registry/export")
async def export_registry(request: Request, password: str = Form(...)):
    ip = _client_ip(request)
    now = time.monotonic()
    failures = _failed_attempts[ip]
    _prune(failures, LOCKOUT_SECONDS, now)

    if len(failures) >= MAX_FAILED_ATTEMPTS:
        retry_after = int(LOCKOUT_SECONDS - (now - failures[0])) + 1
        logger.warning("Registry export blocked for %s (too many attempts)", ip)
        raise HTTPException(
            status_code=429,
            detail="Too many attempts",
            headers={"Retry-After": str(retry_after)},
        )

    if not _password_matches(password):
        failures.append(now)
        logger.warning("Registry export: wrong password from %s", ip)
        raise HTTPException(status_code=401, detail="Invalid password")

    failures.clear()

    try:
        pool = await get_pool()
        rows = await pool.fetch("SELECT * FROM consent_registry ORDER BY created_at, id")
    except Exception as error:
        logger.error("Failed to read consent registry: %s", error)
        raise HTTPException(status_code=503, detail="Registry is temporarily unavailable")

    content = await asyncio.to_thread(_build_workbook, rows)
    logger.warning("Registry exported by %s (%d records)", ip, len(rows))

    filename = f"videovault-registry-{datetime.now(MSK):%Y-%m-%d_%H-%M}.xlsx"
    return StreamingResponse(
        io.BytesIO(content),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "Cache-Control": "no-store",
            "X-Registry-Count": str(len(rows)),
        },
    )

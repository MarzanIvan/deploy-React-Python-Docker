![deploy react](https://github.com/user-attachments/assets/453536e1-8f31-49bc-8159-85f05c873e0a)


## Поддерживаемые платформы

YouTube и Instagram (видео, рилс, посты и карусели с фото/видео).

Для Instagram большинству рилсов и постов нужны cookies авторизации: положите
экспортированный `cookies.txt` (формат Netscape) рядом с `docker-compose.yml`
или обновите его через `POST /api/update_cookies/` (нужен `ADMIN_PASSWORD`).
Если Instagram блокирует IP сервера, задайте `PROXY_URL` в `.env`.

# Деплой VideoVault на VPS (Ubuntu 24.04)

Сервер: `168.113.169.132`, домен: `videovault.ru` / `www.videovault.ru`.
Стек: Docker Compose — Caddy (TLS) → frontend (nginx) + backend (FastAPI, yt-dlp) + PostgreSQL.

Команды выполняются по порядку. Блоки «на Mac» — в терминале ноутбука, остальные — на сервере под `root`.

---

## 0. Срочно: утечка секретов

Репозиторий **публичный**, а в истории git лежат `cookies.txt` и логин/пароль SOCKS-прокси.

- Сменить пароль прокси у провайдера (или взять новый прокси).
- Выйти из всех сессий аккаунтов, чьи cookies были в `cookies.txt` (Instagram/YouTube → «Выйти на всех устройствах»), и сменить пароли.
- Сменить пароль `root` на VPS (он был передан в открытом виде) — шаг 3.

---

## 1. Подключение (на Mac)

```bash
ssh -i ~/.ssh/keys/videovault_168_113_169_132/videovault root@168.113.169.132
```

Удобный алиас, чтобы дальше писать просто `ssh videovault`:

```bash
cat >> ~/.ssh/config <<'EOF'

Host videovault
    HostName 168.113.169.132
    User root
    IdentityFile ~/.ssh/keys/videovault_168_113_169_132/videovault
    IdentitiesOnly yes
    ServerAliveInterval 30
EOF
```

Если соединение зависает на `SSH2_MSG_KEXINIT sent` — выключите VPN или добавьте IP сервера в исключения.

---

## 2. Базовая подготовка системы

```bash
apt update && DEBIAN_FRONTEND=noninteractive apt -y upgrade
apt install -y ca-certificates curl git ufw fail2ban unattended-upgrades htop
timedatectl set-timezone Europe/Moscow
hostnamectl set-hostname videovault
```

Swap 2 ГБ (backend с ffmpeg может съедать до 1.4 ГБ; пропустите, если `free -h` уже показывает swap):

```bash
fallocate -l 2G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile
echo '/swapfile none swap sw 0 0' >> /etc/fstab
sysctl -w vm.swappiness=10 && echo 'vm.swappiness=10' > /etc/sysctl.d/99-swap.conf
```

Автоматические обновления безопасности:

```bash
dpkg-reconfigure -f noninteractive unattended-upgrades
```

---

## 3. Безопасность SSH

Сменить пароль root:

```bash
passwd
```

Отключить вход по паролю. **Сначала** откройте второе окно и убедитесь, что вход по ключу работает (`ssh videovault`), иначе можно потерять доступ.

```bash
cat > /etc/ssh/sshd_config.d/00-hardening.conf <<'EOF'
PasswordAuthentication no
KbdInteractiveAuthentication no
PermitRootLogin prohibit-password
PubkeyAuthentication yes
EOF
sshd -t && systemctl restart ssh
```

Проверка (во втором окне, на Mac) — должно отказать без запроса пароля:

```bash
ssh -o PubkeyAuthentication=no root@168.113.169.132
```

fail2ban для SSH:

```bash
cat > /etc/fail2ban/jail.local <<'EOF'
[sshd]
enabled  = true
maxretry = 5
findtime = 10m
bantime  = 1h
EOF
systemctl enable --now fail2ban && fail2ban-client status sshd
```

---

## 4. Файрвол

```bash
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw allow 443/udp
ufw --force enable
ufw status verbose
```

Docker публикует порты в обход ufw, поэтому наружу открыты только порты Caddy (80/443) — остальные сервисы в compose портов не публикуют.

---

## 5. Docker

```bash
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
chmod a+r /etc/apt/keyrings/docker.asc
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo $VERSION_CODENAME) stable" > /etc/apt/sources.list.d/docker.list
apt update
apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
systemctl enable --now docker
docker version && docker compose version
```

Ограничение логов Docker глобально:

```bash
cat > /etc/docker/daemon.json <<'EOF'
{ "log-driver": "json-file", "log-opts": { "max-size": "10m", "max-file": "3" } }
EOF
systemctl restart docker
```

---

## 6. Освободить порты 80/443

Если на сервере раньше стоял nginx/apache/certbot или старые контейнеры:

```bash
ss -tlnp | grep -E ':(80|443)\s'
systemctl disable --now nginx apache2 2>/dev/null; true
docker ps -a
```

Старые контейнеры прежней версии сайта остановить (подставьте путь, если проект уже лежал в другом месте):

```bash
cd /root/deploy-React-Python-Docker 2>/dev/null && docker compose down; true
```

---

## 7. DNS

У регистратора домена должны быть A-записи:

| Имя | Тип | Значение |
|---|---|---|
| `videovault.ru` | A | `168.113.169.132` |
| `www.videovault.ru` | A | `168.113.169.132` |

Проверка (на сервере):

```bash
apt install -y dnsutils
dig +short videovault.ru A
dig +short www.videovault.ru A
```

Оба должны вернуть `168.113.169.132`, иначе Caddy не сможет выпустить сертификат.

---

## 8. Код приложения

```bash
git clone https://github.com/MarzanIvan/deploy-React-Python-Docker.git /opt/videovault
cd /opt/videovault
git checkout feat/instagram-support     # после мёрджа PR — main
```

---

## 9. Секреты `.env`

Сгенерировать пароли:

```bash
cd /opt/videovault
cat > .env <<EOF
POSTGRES_PASSWORD=$(openssl rand -hex 24)
REGISTRY_PASSWORD=$(openssl rand -base64 18 | tr -d '/+=')
ADMIN_PASSWORD=$(openssl rand -base64 18 | tr -d '/+=')
# Необязательно: socks5://user:pass@host:port (новый, не тот, что был в git)
PROXY_URL=
EOF
chmod 600 .env
cat .env
```

Сохраните `REGISTRY_PASSWORD` (выгрузка реестра согласий на `/registry`) и `ADMIN_PASSWORD` (обновление cookies) в менеджер паролей.

Прокси — открыть файл и вписать `PROXY_URL`:

```bash
nano .env
```

> `POSTGRES_PASSWORD` задаётся только при **первом** создании базы. Если меняете его позже — нужно также сменить пароль внутри PostgreSQL (`ALTER USER videovault PASSWORD '...'`).

---

## 10. Cookies и папка загрузок

`cookies.txt` должен быть **файлом** до первого запуска — иначе Docker создаст на его месте папку.

```bash
cd /opt/videovault
touch cookies.txt && chmod 600 cookies.txt
mkdir -p downloads
```

Загрузить свежие cookies (формат Netscape, экспорт расширением «Get cookies.txt LOCALLY» из браузера, где выполнен вход в Instagram) — на Mac:

```bash
scp ~/Downloads/cookies.txt videovault:/opt/videovault/cookies.txt
```

Или позже без перезапуска, через API:

```bash
curl -F "file=@cookies.txt" -F "password=ВАШ_ADMIN_PASSWORD" https://videovault.ru/api/update_cookies/
```

---

## 11. Запуск

```bash
cd /opt/videovault
docker compose up -d --build
docker compose ps
```

Первая сборка занимает 5–15 минут (npm, ffmpeg, deno, bgutil).

Логи:

```bash
docker compose logs -f --tail=100
docker compose logs -f caddy      # выпуск сертификата
docker compose logs -f backend
```

---

## 12. Проверка

```bash
curl -sI https://videovault.ru | head -5
curl -s https://videovault.ru/api/queue_status/
curl -sI https://videovault.ru/privacy | head -3
docker compose exec db psql -U videovault -d videovault -c "select count(*) from consent_registry;"
```

Проверка Instagram через API (подставьте ссылку на публичный рилс):

```bash
curl -s -X POST -d "url=https://www.instagram.com/reel/XXXXXXXXX/" https://videovault.ru/api/get_video_info/ | head -c 600; echo
```

Ответ с `"platform":"instagram"` и списком `formats`/`items` — всё работает. Ошибка 400 почти всегда означает отсутствующие/просроченные cookies или блокировку IP (→ `PROXY_URL`).

---

## 13. Обновление приложения

```bash
cd /opt/videovault
git pull
docker compose up -d --build
docker image prune -f
```

Скрипт для одной команды:

```bash
cat > /usr/local/bin/videovault-update <<'EOF'
#!/usr/bin/env bash
set -euo pipefail
cd /opt/videovault
git pull --ff-only
docker compose up -d --build
docker image prune -f
docker compose ps
EOF
chmod +x /usr/local/bin/videovault-update
```

Обновлять yt-dlp (YouTube/Instagram часто ломают старые версии) — пересборка backend без кэша раз в 1–2 недели:

```bash
cd /opt/videovault && docker compose build --no-cache backend && docker compose up -d backend
```

---

## 14. Резервные копии базы (реестр согласий 152-ФЗ)

```bash
mkdir -p /opt/backups
cat > /usr/local/bin/videovault-backup <<'EOF'
#!/usr/bin/env bash
set -euo pipefail
cd /opt/videovault
STAMP=$(date +%F_%H-%M)
docker compose exec -T db pg_dump -U videovault -d videovault | gzip > /opt/backups/videovault_$STAMP.sql.gz
find /opt/backups -name 'videovault_*.sql.gz' -mtime +30 -delete
EOF
chmod +x /usr/local/bin/videovault-backup
/usr/local/bin/videovault-backup && ls -lh /opt/backups
```

Ежедневно в 03:30 + очистка старых загрузок и Docker-мусора:

```bash
cat > /etc/cron.d/videovault <<'EOF'
30 3 * * * root /usr/local/bin/videovault-backup >> /var/log/videovault-backup.log 2>&1
0 * * * * root find /opt/videovault/downloads -type f -mmin +120 -delete
0 4 * * 0 root docker system prune -f >> /var/log/docker-prune.log 2>&1
EOF
```

Скачать бэкап на Mac:

```bash
scp "videovault:/opt/backups/*.sql.gz" ~/Downloads/
```

Восстановление:

```bash
gunzip -c /opt/backups/videovault_ДАТА.sql.gz | docker compose -f /opt/videovault/docker-compose.yml exec -T db psql -U videovault -d videovault
```

---

## 15. Полезное

```bash
docker compose ps                         # статус
docker compose restart backend            # перезапуск backend
docker stats --no-stream                  # память/CPU контейнеров
df -h && du -sh /opt/videovault/downloads # место на диске
fail2ban-client status sshd               # забаненные IP
```

Сертификаты Caddy хранятся в томе `caddy_data`. **Не выполняйте** `docker compose down -v` — это удалит сертификаты и базу согласий.

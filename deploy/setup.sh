#!/usr/bin/env bash
# =============================================================================
# Полный деплой VideoVault на VPS (Ubuntu 22.04 / 24.04), запуск от root.
#
#   curl -fsSL https://raw.githubusercontent.com/MarzanIvan/deploy-React-Python-Docker/feat/instagram-support/deploy/setup.sh -o /root/setup.sh
#   bash /root/setup.sh
#
# Скрипт идемпотентный: повторный запуск обновляет код и перезапускает сервисы,
# существующие .env, cookies.txt и базу не трогает.
# Полный лог: /var/log/videovault-setup.log
# =============================================================================
set -Eeuo pipefail

REPO="${REPO:-https://github.com/MarzanIvan/deploy-React-Python-Docker.git}"
BRANCH="${BRANCH:-feat/instagram-support}"   # после мёрджа PR: BRANCH=main bash setup.sh
APP="${APP:-/opt/videovault}"
DOMAIN="videovault.ru"
SERVER_IP="${SERVER_IP:-$(curl -4 -fsS --max-time 5 https://api.ipify.org || hostname -I | awk '{print $1}')}"

export DEBIAN_FRONTEND=noninteractive
export NEEDRESTART_MODE=a          # Ubuntu 24.04: не спрашивать про перезапуск служб

exec > >(tee -a /var/log/videovault-setup.log) 2>&1
trap 'echo; echo "ОШИБКА в строке $LINENO: $BASH_COMMAND"; echo "Лог: /var/log/videovault-setup.log"' ERR

step() { echo; echo "========== $* =========="; }
warn() { echo "!!! $*"; }

[ "$(id -u)" -eq 0 ] || { echo "Запустите от root"; exit 1; }
. /etc/os-release
[ "$ID" = "ubuntu" ] || warn "Скрипт рассчитан на Ubuntu, обнаружено: $PRETTY_NAME"

# -----------------------------------------------------------------------------
step "1/11 Обновление системы и базовые пакеты"
apt-get update
apt-get -y -o Dpkg::Options::=--force-confdef -o Dpkg::Options::=--force-confold upgrade
apt-get install -y ca-certificates curl git ufw fail2ban python3-systemd \
  unattended-upgrades htop dnsutils nano openssl
timedatectl set-timezone Europe/Moscow || true
hostnamectl set-hostname videovault || true

# -----------------------------------------------------------------------------
step "2/11 Swap 2 ГБ (сборка фронтенда и ffmpeg требуют памяти)"
if [ -z "$(swapon --show --noheadings)" ]; then
  fallocate -l 2G /swapfile || dd if=/dev/zero of=/swapfile bs=1M count=2048
  chmod 600 /swapfile
  mkswap /swapfile
  swapon /swapfile
  grep -q '^/swapfile ' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
else
  echo "Swap уже есть"
fi
echo 'vm.swappiness=10' > /etc/sysctl.d/99-swap.conf
sysctl -q -p /etc/sysctl.d/99-swap.conf
free -h

# -----------------------------------------------------------------------------
step "3/11 Файрвол (22, 80, 443)"
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw allow 443/udp
ufw --force enable
ufw status

# -----------------------------------------------------------------------------
step "4/11 fail2ban и автообновления безопасности"
cat > /etc/fail2ban/jail.local <<'EOF'
[sshd]
enabled  = true
backend  = systemd
maxretry = 5
findtime = 10m
bantime  = 1h
EOF
systemctl enable fail2ban
systemctl restart fail2ban
cat > /etc/apt/apt.conf.d/20auto-upgrades <<'EOF'
APT::Periodic::Update-Package-Lists "1";
APT::Periodic::Unattended-Upgrade "1";
EOF

# -----------------------------------------------------------------------------
step "5/11 Docker"
if ! command -v docker >/dev/null || ! docker compose version >/dev/null 2>&1; then
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
  chmod a+r /etc/apt/keyrings/docker.asc
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu ${VERSION_CODENAME} stable" \
    > /etc/apt/sources.list.d/docker.list
  apt-get update
  apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
fi
mkdir -p /etc/docker
cat > /etc/docker/daemon.json <<'EOF'
{ "log-driver": "json-file", "log-opts": { "max-size": "10m", "max-file": "3" } }
EOF
systemctl enable docker
systemctl restart docker
docker --version
docker compose version

# -----------------------------------------------------------------------------
step "6/11 Освобождение портов 80/443"
for svc in nginx apache2 caddy lighttpd; do
  if systemctl is-active --quiet "$svc" 2>/dev/null; then
    echo "Останавливаю системный $svc"
    systemctl disable --now "$svc"
  fi
done
# Старые контейнеры (например, прежняя версия сайта), занимающие 80/443
OLD=""
for id in $( { docker ps -q --filter publish=80; docker ps -q --filter publish=443; } | sort -u); do
  project=$(docker inspect --format '{{ index .Config.Labels "com.docker.compose.project" }}' "$id")
  [ "$project" = "videovault" ] || OLD="$OLD $id"
done
if [ -n "$OLD" ]; then
  echo "Останавливаю старые контейнеры на 80/443:"
  # shellcheck disable=SC2086
  docker inspect --format '  {{.Name}} ({{.Config.Image}})' $OLD
  # shellcheck disable=SC2086
  docker stop $OLD
fi
BUSY=$(ss -tlnp | grep -E ':(80|443)\s' | grep -v docker-proxy || true)
if [ -n "$BUSY" ]; then
  echo "$BUSY"
  echo "Порт 80/443 занят процессом выше. Остановите его и запустите скрипт снова."
  exit 1
fi

# Защита данных: база согласий прежней установки под другим именем проекта
OTHER_PG=$(docker volume ls -q | grep -E '_pgdata$' | grep -v '^videovault_pgdata$' || true)
if [ -n "$OTHER_PG" ]; then
  warn "Найдена база прежней установки: $OTHER_PG"
  warn "Новая установка создаст отдельную пустую базу videovault_pgdata."
  warn "Чтобы перенести реестр согласий, после деплоя выполните pg_dump из старой базы (см. DEPLOY.md)."
fi

# -----------------------------------------------------------------------------
step "7/11 Код приложения ($BRANCH → $APP)"
if [ -d "$APP/.git" ]; then
  git -C "$APP" fetch --prune origin
  git -C "$APP" checkout "$BRANCH"
  git -C "$APP" pull --ff-only origin "$BRANCH"
else
  git clone --branch "$BRANCH" "$REPO" "$APP"
fi
cd "$APP"
git log --oneline -1

# -----------------------------------------------------------------------------
step "8/11 Секреты (.env), cookies.txt, папка загрузок"
if [ ! -f .env ]; then
  umask 077
  cat > .env <<EOF
COMPOSE_PROJECT_NAME=videovault
POSTGRES_PASSWORD=$(openssl rand -hex 24)
REGISTRY_PASSWORD=$(openssl rand -hex 12)
ADMIN_PASSWORD=$(openssl rand -hex 12)
# Необязательно: socks5://user:pass@host:port — если Instagram/YouTube блокируют IP сервера
PROXY_URL=
EOF
  umask 022
  echo "Создан новый .env со случайными паролями"
else
  echo ".env уже существует — пароли не меняю"
  grep -q '^COMPOSE_PROJECT_NAME=' .env || sed -i '1i COMPOSE_PROJECT_NAME=videovault' .env
  grep -q '^ADMIN_PASSWORD=' .env    || echo "ADMIN_PASSWORD=$(openssl rand -hex 12)" >> .env
  grep -q '^PROXY_URL=' .env         || echo "PROXY_URL=" >> .env
fi
chmod 600 .env

# cookies.txt монтируется в backend как файл: если его нет, Docker создаст папку
if [ -d cookies.txt ]; then rmdir cookies.txt; fi
touch cookies.txt
chmod 600 cookies.txt
mkdir -p downloads

# -----------------------------------------------------------------------------
step "9/11 Скрипты обслуживания и cron"
cat > /usr/local/bin/videovault-update <<EOF
#!/usr/bin/env bash
# Обновление: git pull + пересборка
set -euo pipefail
cd $APP
git pull --ff-only
docker compose up -d --build --remove-orphans
docker image prune -f
docker compose ps
EOF
cat > /usr/local/bin/videovault-backup <<EOF
#!/usr/bin/env bash
# Бэкап базы согласий (152-ФЗ), хранится 30 дней
set -euo pipefail
mkdir -p /opt/backups
cd $APP
docker compose exec -T db pg_dump -U videovault -d videovault | gzip > "/opt/backups/videovault_\$(date +%F_%H-%M).sql.gz"
find /opt/backups -name 'videovault_*.sql.gz' -mtime +30 -delete
EOF
chmod +x /usr/local/bin/videovault-update /usr/local/bin/videovault-backup
cat > /etc/cron.d/videovault <<EOF
SHELL=/bin/bash
PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
30 3 * * * root /usr/local/bin/videovault-backup >> /var/log/videovault-backup.log 2>&1
0 * * * * root find $APP/downloads -type f -mmin +120 -delete
0 4 * * 0 root docker system prune -f >> /var/log/docker-prune.log 2>&1
EOF
chmod 644 /etc/cron.d/videovault

# -----------------------------------------------------------------------------
step "10/11 Проверка DNS"
DNS_OK=1
for host in "$DOMAIN" "www.$DOMAIN"; do
  got=$(dig +short "$host" A | tail -1)
  if [ "$got" = "$SERVER_IP" ]; then
    echo "OK   $host -> $got"
  else
    echo "FAIL $host -> ${got:-нет записи} (нужно $SERVER_IP)"
    DNS_OK=0
  fi
done
[ "$DNS_OK" -eq 1 ] || warn "Пока DNS не указывает на сервер, Caddy не выпустит HTTPS-сертификат. Сайт заработает сам после исправления записей."

# -----------------------------------------------------------------------------
step "11/11 Сборка и запуск контейнеров (первый раз 5–15 минут)"
if ! docker compose up -d --build --remove-orphans; then
  echo
  docker compose ps -a
  echo "--- последние логи ---"
  docker compose logs --tail=60
  exit 1
fi
docker image prune -f >/dev/null

echo "Жду готовности сервисов..."
for _ in $(seq 1 60); do
  code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 5 \
    --resolve "$DOMAIN:443:127.0.0.1" "https://$DOMAIN/api/queue_status/" || true)
  [ "$code" = "200" ] && break
  sleep 5
done

# -----------------------------------------------------------------------------
step "ИТОГ"
docker compose ps
echo
if [ "${code:-000}" = "200" ]; then
  echo "OK   https://$DOMAIN работает (API отвечает 200)"
else
  warn "HTTPS пока не отвечает (код ${code:-000}). Смотрите: cd $APP && docker compose logs caddy backend"
fi
echo
echo "Сохраните в менеджер паролей:"
grep -E '^(REGISTRY_PASSWORD|ADMIN_PASSWORD)=' .env | sed 's/^/  /'
echo "  REGISTRY_PASSWORD — выгрузка реестра согласий на https://$DOMAIN/registry"
echo "  ADMIN_PASSWORD    — обновление cookies через /api/update_cookies/"
echo
echo "Дальше:"
echo "  1) cookies.txt для Instagram (с Mac):  scp cookies.txt root@$SERVER_IP:$APP/cookies.txt"
echo "  2) прокси (если нужен):                nano $APP/.env  →  docker compose up -d backend"
echo "  3) обновление сайта:                   videovault-update"
echo "  4) логи:                               cd $APP && docker compose logs -f --tail=100"
echo
echo "Готово."

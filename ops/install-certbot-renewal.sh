#!/bin/sh
set -eu

project_dir=/root/deploy-React-Python-Docker

install -d -m 0755 /etc/letsencrypt/renewal-hooks/deploy
install -m 0755 \
    "$project_dir/ops/reload-nginx-after-cert-renewal.sh" \
    /etc/letsencrypt/renewal-hooks/deploy/videovault-nginx-reload
install -m 0644 \
    "$project_dir/ops/videovault-certbot.service" \
    /etc/systemd/system/videovault-certbot.service
install -m 0644 \
    "$project_dir/ops/videovault-certbot.timer" \
    /etc/systemd/system/videovault-certbot.timer

systemctl daemon-reload
systemctl enable --now videovault-certbot.timer

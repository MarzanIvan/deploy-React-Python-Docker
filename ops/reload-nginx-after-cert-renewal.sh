#!/bin/sh
set -eu

project_dir=/root/deploy-React-Python-Docker

/usr/bin/docker compose --project-directory "$project_dir" exec -T nginx nginx -s reload

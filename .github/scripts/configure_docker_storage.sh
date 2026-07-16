#!/usr/bin/env bash

set -euo pipefail

docker_root="${DOCKER_DATA_ROOT:-/mnt/docker}"

if [[ "$docker_root" != /mnt/* ]]; then
  echo "::error::Docker data root must be under /mnt: $docker_root"
  exit 1
fi

if ! mountpoint -q /mnt; then
  echo "::error::The runner data disk is not mounted at /mnt"
  exit 1
fi

daemon_config="$(mktemp)"
trap 'rm -f "$daemon_config"' EXIT

if sudo test -s /etc/docker/daemon.json; then
  sudo jq --arg root "$docker_root" '. + {"data-root": $root}' \
    /etc/docker/daemon.json | tee "$daemon_config" > /dev/null
else
  jq -n --arg root "$docker_root" '{"data-root": $root}' > "$daemon_config"
fi

sudo systemctl stop docker
sudo rm -rf "$docker_root"
sudo mkdir -p "$docker_root"
sudo install -m 0644 "$daemon_config" /etc/docker/daemon.json
sudo systemctl start docker

actual_root="$(docker info --format '{{.DockerRootDir}}')"
if [[ "$actual_root" != "$docker_root" ]]; then
  echo "::error::Docker data root is $actual_root; expected $docker_root"
  exit 1
fi

docker info --format 'Docker root: {{.DockerRootDir}}'
df -h / /mnt

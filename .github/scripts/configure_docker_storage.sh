#!/usr/bin/env bash

set -euo pipefail

readonly docker_root="/mnt/docker"
readonly minimum_free_kb=$((50 * 1024 * 1024))

if [[ ! -d /mnt ]]; then
  echo "::error::The runner does not provide /mnt"
  exit 1
fi

if [[ "$(stat -c '%d' /)" == "$(stat -c '%d' /mnt)" ]]; then
  available_kb="$(df --output=avail -k / | tail -n 1)"
  if ((available_kb < minimum_free_kb)); then
    echo "::error::The runner root has ${available_kb} KiB free; ${minimum_free_kb} KiB is required"
    df -h / /mnt
    exit 1
  fi

  echo "The runner uses one filesystem with ${available_kb} KiB free; keeping the existing Docker root"
  docker info --format 'Docker root: {{.DockerRootDir}}'
  df -h / /mnt
  exit 0
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

#!/usr/bin/env bash
set -eo pipefail
diagnostics="${RUNNER_TEMP}/python-ci-diagnostics"
rm -rf "$diagnostics"
mkdir -p "$diagnostics"
df -h > "$diagnostics/disk-usage.txt" 2>&1 || true
free -h > "$diagnostics/memory-usage.txt" 2>&1 || true
docker info > "$diagnostics/docker-info.txt" 2>&1 || true
docker system df > "$diagnostics/docker-disk-usage.txt" 2>&1 || true
docker ps --all --no-trunc > "$diagnostics/docker-containers.txt" 2>&1 || true
if [ -d docker/development ]; then
  (cd docker/development && docker compose logs --no-color --tail 2000) > "$diagnostics/docker-compose.log" 2>&1 || true
fi
coredumpctl --no-pager list > "$diagnostics/coredumps.txt" 2>&1 || true
coredumpctl --no-pager info >> "$diagnostics/coredumps.txt" 2>&1 || true
find "$GITHUB_WORKSPACE" /tmp /var/crash -maxdepth 3 -type f \
  \( -name 'core' -o -name 'core.*' -o -name '*.core' -o -name '*.dmp' -o -name '*.crash' \) \
  -printf '%p %s bytes\n' >> "$diagnostics/core-files.txt" 2>/dev/null || true
if [ -f "${RUNNER_TEMP}/exasol-disk-reclaim.log" ]; then
  cp "${RUNNER_TEMP}/exasol-disk-reclaim.log" "$diagnostics/"
fi

#!/usr/bin/env bash

set -euo pipefail

workspace_root=${GITHUB_WORKSPACE:-$(pwd)}
container_name=${PW_AUTOPILOT_MYSQL_CONTAINER:?PW_AUTOPILOT_MYSQL_CONTAINER is required}

# A per-shard source keeps AutoPilot's real ingestion coverage independent of
# the shared connector database. It is reachable only on the Docker network.
docker run --detach \
  --name "$container_name" \
  --network "${PW_DOCKER_NETWORK:-ometa_network}" \
  --memory=1g --cpus=1 \
  --tmpfs /var/lib/mysql:rw,noexec,nosuid,size=512m \
  --log-driver local --log-opt max-size=5m --log-opt max-file=1 --log-opt compress=false \
  --env MYSQL_ROOT_PASSWORD=playwright-fixture-root \
  --volume "$workspace_root/docker/development/playwright-autopilot-mysql.sql:/docker-entrypoint-initdb.d/autopilot.sql:ro" \
  mysql:8.0.42 \
  --innodb-buffer-pool-size=64M --innodb-redo-log-capacity=32M \
  --max-connections=40 --performance-schema=OFF >/dev/null

for _ in $(seq 1 60); do
  if docker exec --env MYSQL_PWD=playwright-fixture-only "$container_name" \
    mysql --protocol=TCP --host=127.0.0.1 --user=playwright --batch --skip-column-names \
    --execute='SELECT COUNT(*) FROM autopilot_secondary.chart_entity' 2>/dev/null |
    grep -qx 2; then
    echo "AutoPilot MySQL source is ready"
    exit 0
  fi
  if [[ "$(docker inspect "$container_name" --format '{{.State.Running}}')" != true ]]; then
    break
  fi
  sleep 2
done

docker logs --tail 100 "$container_name" >&2
echo "AutoPilot MySQL source did not become healthy" >&2
exit 1

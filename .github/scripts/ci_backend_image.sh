#!/usr/bin/env bash
set -euo pipefail

operation="$1"
archive="$2"
image='ci-backend:local'
revision="$(git rev-parse HEAD)"

case "$operation" in
  build)
    docker build -f docker/development/Dockerfile \
      --label "org.openmetadata.ci.revision=$revision" -t "$image" .
    docker save "$image" | zstd -T0 -3 -o "$archive"
    ;;
  load)
    zstd -dc "$archive" | docker load
    actual_revision="$(docker image inspect "$image" --format '{{index .Config.Labels "org.openmetadata.ci.revision"}}')"
    if [[ "$actual_revision" != "$revision" ]]; then
      echo '::error::Shared backend image does not match the checked-out revision'
      exit 1
    fi
    # Both database stacks use the same project and server service names.
    targets="$(docker compose -f docker/development/docker-compose.yml config --format json | \
      jq -er '. as $compose | ["execute-migrate-all", "openmetadata-server"][] as $service |
        $compose.services[$service].image // ($compose.name + "-" + $service)')"
    while IFS= read -r target; do
      docker image tag "$image" "$target"
    done <<< "$targets"
    echo 'OM_BACKEND_IMAGE_PRELOADED=true' >> "$GITHUB_ENV"
    rm -f "$archive"
    ;;
  *)
    echo 'Usage: ci_backend_image.sh build|load ARCHIVE' >&2
    exit 2
    ;;
esac

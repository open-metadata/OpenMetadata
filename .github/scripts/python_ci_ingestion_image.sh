#!/usr/bin/env bash
set -euo pipefail

operation="$1"
archive="$2"
image='python-ci-ingestion:local'
revision="$(git rev-parse HEAD)"
dependencies="${INGESTION_DEPENDENCY:-mysql,elasticsearch,sample-data}"

case "$operation" in
  build)
    docker build -f ingestion/Dockerfile.ci \
      --build-arg "INGESTION_DEPENDENCY=$dependencies" \
      --label "org.openmetadata.ci.revision=$revision" \
      --label "org.openmetadata.ci.dependencies=$dependencies" \
      -t "$image" .
    docker save "$image" | zstd -T0 -3 -o "$archive"
    ;;
  load)
    zstd -dc "$archive" | docker load
    actual_revision="$(docker image inspect "$image" --format '{{index .Config.Labels "org.openmetadata.ci.revision"}}')"
    actual_dependencies="$(docker image inspect "$image" --format '{{index .Config.Labels "org.openmetadata.ci.dependencies"}}')"
    if [[ "$actual_revision" != "$revision" || "$actual_dependencies" != "$dependencies" ]]; then
      echo '::error::Shared ingestion image does not match the checked-out revision and dependencies'
      exit 1
    fi
    compose_image="$(docker compose -f docker/development/docker-compose.yml config --format json | jq -er '.services.ingestion.image // (.name + "-ingestion")')"
    docker image tag "$image" "$compose_image"
    echo 'OM_INGESTION_IMAGE_PRELOADED=true' >> "$GITHUB_ENV"
    rm -f "$archive"
    ;;
  *)
    echo 'Usage: python_ci_ingestion_image.sh build|load ARCHIVE' >&2
    exit 2
    ;;
esac

echo "Ingestion image $operation completed in ${SECONDS}s"

#!/usr/bin/env bash

set -euo pipefail

if [[ $# -lt 1 || $# -gt 2 ]]; then
  echo "Usage: $0 <fixture.tar.zst> [ingestion-image.tar.zst]" >&2
  exit 2
fi

output_path=$(realpath -m "$1")
ingestion_output_path=${2:+$(realpath -m "$2")}
runner_temp=${RUNNER_TEMP:-/tmp}
stage_dir=$(mktemp -d "${runner_temp}/playwright-fixture.XXXXXX")
workspace_root=${GITHUB_WORKSPACE:-$(pwd)}
playwright_root="$workspace_root/openmetadata-ui/src/main/resources/ui/playwright"
auth_source="$playwright_root/.auth"
entity_state_source="$playwright_root/output/entity-response-data.json"

cleanup() {
  sudo rm -rf "$stage_dir"
}
trap cleanup EXIT

postgres_source=$(docker inspect openmetadata_postgresql --format '{{range .Mounts}}{{if eq .Destination "/var/lib/postgresql/data"}}{{.Source}}{{end}}{{end}}')
opensearch_source=$(docker inspect openmetadata_opensearch --format '{{range .Mounts}}{{if eq .Destination "/usr/share/opensearch/data"}}{{.Source}}{{end}}{{end}}')
opensearch_reference=$(docker inspect openmetadata_opensearch --format '{{.Config.Image}}')
ingestion_image_id=$(docker inspect openmetadata_ingestion --format '{{.Image}}')

if [[ -z "$postgres_source" || -z "$opensearch_source" ]]; then
  echo "Could not resolve PostgreSQL or OpenSearch data directories" >&2
  exit 1
fi

for state_file in \
  "$auth_source/admin.json" \
  "$auth_source/admin-api-token.json" \
  "$entity_state_source"; do
  if [[ ! -s "$state_file" ]]; then
    echo "Missing seeded Playwright state: $state_file" >&2
    exit 1
  fi
done

docker stop --time 30 openmetadata_ingestion openmetadata_server >/dev/null 2>&1 || true
docker stop --time 30 openmetadata_postgresql openmetadata_opensearch >/dev/null

resolve_digest() {
  local reference=$1
  local digest
  digest=$(
    docker image inspect "$reference" --format '{{index .RepoDigests 0}}' 2>/dev/null || true
  )
  if [[ -z "$digest" || "$digest" != *@sha256:* ]]; then
    docker pull "$reference" >/dev/null
    digest=$(
      docker image inspect "$reference" --format '{{index .RepoDigests 0}}' 2>/dev/null || true
    )
  fi
  if [[ -z "$digest" || "$digest" != *@sha256:* ]]; then
    echo "Could not resolve immutable digest for $reference" >&2
    exit 1
  fi
  printf '%s\n' "$digest"
}

sudo mkdir -p \
  "$stage_dir/postgres" \
  "$stage_dir/opensearch" \
  "$stage_dir/playwright-state/auth"
sudo cp -a "$postgres_source/." "$stage_dir/postgres/"
sudo cp -a "$opensearch_source/." "$stage_dir/opensearch/"
sudo cp -a "$auth_source/." "$stage_dir/playwright-state/auth/"
sudo cp -a "$entity_state_source" "$stage_dir/playwright-state/entity-response-data.json"

postgres_image=$(resolve_digest postgres:15)
opensearch_image=$(resolve_digest "$opensearch_reference")
schema_hash=$(
  git ls-files -z bootstrap/sql openmetadata-spec |
    sort -z |
    xargs -0 sha256sum |
    sha256sum |
    cut -d ' ' -f1
)
seed_hash=$(
  git ls-files -z ingestion/examples/sample_data ingestion/pipelines/sample_data.yaml ingestion/pipelines/extended_sample_data.yaml |
    sort -z |
    xargs -0 sha256sum |
    sha256sum |
    cut -d ' ' -f1
)
seed_version=$(sed -n 's:.*<version>\([^<]*\)</version>.*:\1:p' pom.xml | head -1)
playwright_state_hash=$(
  cd "$stage_dir/playwright-state"
  find . -type f -print0 |
    sort -z |
    xargs -0 sha256sum |
    sha256sum |
    cut -d ' ' -f1
)
source_sha=$(git rev-parse HEAD)
ingestion_image="openmetadata-playwright-ingestion:${source_sha}"
docker image tag "$ingestion_image_id" "$ingestion_image"
jq -n \
  --arg sourceSha "$source_sha" \
  --arg postgresImage "$postgres_image" \
  --arg opensearchImage "$opensearch_image" \
  --arg ingestionImage "$ingestion_image" \
  --arg ingestionImageId "$ingestion_image_id" \
  --arg schemaHash "$schema_hash" \
  --arg seedHash "$seed_hash" \
  --arg seedVersion "$seed_version" \
  --arg playwrightStateHash "$playwright_state_hash" \
  '{
    version: 1,
    sourceSha: $sourceSha,
    postgresImage: $postgresImage,
    opensearchImage: $opensearchImage,
    ingestionImage: $ingestionImage,
    ingestionImageId: $ingestionImageId,
    schemaHash: $schemaHash,
    seedHash: $seedHash,
    seedVersion: $seedVersion,
    playwrightStateHash: $playwrightStateHash
  }' > "$stage_dir/fixture-manifest.json"

mkdir -p "$(dirname "$output_path")"
sudo tar --numeric-owner --zstd -C "$stage_dir" -cf "$output_path" .
sudo chown "$(id -u):$(id -g)" "$output_path"

echo "Created Playwright fixture at $output_path ($(du -h "$output_path" | cut -f1))"

if [[ -n "$ingestion_output_path" ]]; then
  mkdir -p "$(dirname "$ingestion_output_path")"
  docker image save "$ingestion_image" | zstd -T0 -3 -f -o "$ingestion_output_path"
  echo "Created Playwright ingestion image at $ingestion_output_path ($(du -h "$ingestion_output_path" | cut -f1))"
fi

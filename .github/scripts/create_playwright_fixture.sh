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
fingerprint_script="$workspace_root/.github/scripts/playwright_cache_fingerprint.py"

cleanup() {
  sudo rm -rf "$stage_dir"
}
trap cleanup EXIT

postgres_source=$(docker inspect openmetadata_postgresql --format '{{range .Mounts}}{{if eq .Destination "/var/lib/postgresql/data"}}{{.Source}}{{end}}{{end}}')
opensearch_source=$(docker inspect openmetadata_opensearch --format '{{range .Mounts}}{{if eq .Destination "/usr/share/opensearch/data"}}{{.Source}}{{end}}{{end}}')
opensearch_reference=$(docker inspect openmetadata_opensearch --format '{{.Config.Image}}')
ingestion_image_id=$(docker inspect openmetadata_ingestion --format '{{.Image}}')
search_cluster_alias=$(
  docker inspect openmetadata_server --format '{{range .Config.Env}}{{println .}}{{end}}' |
    sed -n 's/^ELASTICSEARCH_CLUSTER_ALIAS=//p' |
    head -1 |
    sed -E 's/^[[:space:]]+//; s/[[:space:]]+$//; s/^"([^"]+)"$/\1/'
)

if [[ -z "$postgres_source" || -z "$opensearch_source" || -z "$search_cluster_alias" ]]; then
  echo "Could not resolve PostgreSQL, OpenSearch, or search cluster fixture settings" >&2
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
fixture_compatibility_hash=$(python3 "$fingerprint_script" --kind fixture)
ingestion_compatibility_hash=$(python3 "$fingerprint_script" --kind ingestion)
schema_hash=$(python3 "$fingerprint_script" --kind schema)
seed_hash=$(python3 "$fingerprint_script" --kind seed)
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
created_at=$(date -u +%Y-%m-%dT%H:%M:%SZ)
ingestion_image="openmetadata-playwright-ingestion:${ingestion_compatibility_hash}"
docker image tag "$ingestion_image_id" "$ingestion_image"
jq -n \
  --arg sourceSha "$source_sha" \
  --arg createdAt "$created_at" \
  --arg compatibilityHash "$fixture_compatibility_hash" \
  --arg postgresImage "$postgres_image" \
  --arg opensearchImage "$opensearch_image" \
  --arg searchClusterAlias "$search_cluster_alias" \
  --arg schemaHash "$schema_hash" \
  --arg seedHash "$seed_hash" \
  --arg seedVersion "$seed_version" \
  --arg playwrightStateHash "$playwright_state_hash" \
  '{
    version: 2,
    sourceSha: $sourceSha,
    createdAt: $createdAt,
    compatibilityHash: $compatibilityHash,
    postgresImage: $postgresImage,
    opensearchImage: $opensearchImage,
    searchClusterAlias: $searchClusterAlias,
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
  ingestion_archive_hash=$(sha256sum "$ingestion_output_path" | cut -d ' ' -f1)
  ingestion_manifest_path="${ingestion_output_path%.tar.zst}.manifest.json"
  jq -n \
    --arg sourceSha "$source_sha" \
    --arg createdAt "$created_at" \
    --arg compatibilityHash "$ingestion_compatibility_hash" \
    --arg image "$ingestion_image" \
    --arg imageId "$ingestion_image_id" \
    --arg archiveHash "$ingestion_archive_hash" \
    '{
      version: 1,
      sourceSha: $sourceSha,
      createdAt: $createdAt,
      compatibilityHash: $compatibilityHash,
      image: $image,
      imageId: $imageId,
      archiveHash: $archiveHash
    }' > "$ingestion_manifest_path"
  echo "Created Playwright ingestion image at $ingestion_output_path ($(du -h "$ingestion_output_path" | cut -f1))"
fi

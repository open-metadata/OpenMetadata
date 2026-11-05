#!/usr/bin/env bash

set -euo pipefail

if [[ $# -ne 1 ]]; then
  echo "Usage: $0 <fixture.tar.zst>" >&2
  exit 2
fi

output_path=$(realpath -m "$1")
runner_temp=${RUNNER_TEMP:-/tmp}
workspace_root=${GITHUB_WORKSPACE:-$(pwd)}
playwright_root="$workspace_root/openmetadata-ui/src/main/resources/ui/playwright"
auth_source="$playwright_root/.auth"
entity_state_source="$playwright_root/output/entity-response-data.json"
lineage_state_source="$playwright_root/output/lineage-data.json"
shared_infra_state_source="$playwright_root/output/shared-infra.json"
fingerprint_script="$workspace_root/.github/scripts/playwright_cache_fingerprint.py"
database=${PLAYWRIGHT_DATABASE:-postgresql}

# shellcheck source=playwright_fixture_profile.sh
source "$workspace_root/.github/scripts/playwright_fixture_profile.sh"
load_playwright_fixture_profile "$database"
stage_dir=$(mktemp -d "${runner_temp}/playwright-fixture.XXXXXX")

cleanup() {
  sudo rm -rf "$stage_dir"
}
trap cleanup EXIT

mount_source() {
  docker inspect "$1" --format "{{range .Mounts}}{{if eq .Destination \"$2\"}}{{.Source}}{{end}}{{end}}"
}

database_source=$(mount_source "$PW_DATABASE_CONTAINER" "$PW_DATABASE_DATA_PATH")
search_source=$(mount_source "$PW_SEARCH_CONTAINER" "$PW_SEARCH_DATA_PATH")
search_reference=$(docker inspect "$PW_SEARCH_CONTAINER" --format '{{.Config.Image}}')
# The seeded database container runs an image built from this Dockerfile; the
# fast environment restores the data directory onto its upstream base image.
database_reference=$(sed -n 's/^FROM[[:space:]]\{1,\}//p' "$workspace_root/$PW_DATABASE_DOCKERFILE" | head -1)
search_cluster_alias=$(
  docker inspect openmetadata_server --format '{{range .Config.Env}}{{println .}}{{end}}' |
    sed -n 's/^ELASTICSEARCH_CLUSTER_ALIAS=//p' |
    head -1 |
    sed -E 's/^[[:space:]]+//; s/[[:space:]]+$//; s/^"([^"]+)"$/\1/'
)

if [[ -z "$database_source" || -z "$search_source" || -z "$database_reference" || -z "$search_cluster_alias" ]]; then
  echo "Could not resolve the $database database, search, or search cluster fixture settings" >&2
  exit 1
fi

for state_file in \
  "$auth_source/admin.json" \
  "$auth_source/admin-api-token.json" \
  "$entity_state_source" \
  "$lineage_state_source" \
  "$shared_infra_state_source"; do
  if [[ ! -s "$state_file" ]]; then
    echo "Missing seeded Playwright state: $state_file" >&2
    exit 1
  fi
done

docker stop --time 30 openmetadata_ingestion openmetadata_server >/dev/null 2>&1 || true
docker stop --time 30 "$PW_DATABASE_CONTAINER" "$PW_SEARCH_CONTAINER" >/dev/null

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
  "$stage_dir/database" \
  "$stage_dir/search" \
  "$stage_dir/playwright-state/auth"
sudo cp -a "$database_source/." "$stage_dir/database/"
sudo cp -a "$search_source/." "$stage_dir/search/"
sudo cp -a "$auth_source/." "$stage_dir/playwright-state/auth/"
sudo cp -a "$entity_state_source" "$stage_dir/playwright-state/entity-response-data.json"
sudo cp -a "$lineage_state_source" "$stage_dir/playwright-state/lineage-data.json"
sudo cp -a "$shared_infra_state_source" "$stage_dir/playwright-state/shared-infra.json"

database_image=$(resolve_digest "$database_reference")
search_image=$(resolve_digest "$search_reference")
fixture_compatibility_hash=$(python3 "$fingerprint_script" --kind fixture)
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
jq -n \
  --arg sourceSha "$source_sha" \
  --arg createdAt "$created_at" \
  --arg compatibilityHash "$fixture_compatibility_hash" \
  --arg database "$database" \
  --arg databaseImage "$database_image" \
  --arg searchImage "$search_image" \
  --arg searchClusterAlias "$search_cluster_alias" \
  --arg schemaHash "$schema_hash" \
  --arg seedHash "$seed_hash" \
  --arg seedVersion "$seed_version" \
  --arg playwrightStateHash "$playwright_state_hash" \
  '{
    version: 3,
    sourceSha: $sourceSha,
    createdAt: $createdAt,
    compatibilityHash: $compatibilityHash,
    database: $database,
    databaseImage: $databaseImage,
    searchImage: $searchImage,
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

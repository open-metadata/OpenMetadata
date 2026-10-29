#!/usr/bin/env bash

set -euo pipefail

if [[ $# -ne 2 ]]; then
  echo "Usage: $0 <built-image-reference> <ingestion-image.tar.zst>" >&2
  exit 2
fi

source_image=$1
output_path=$(realpath -m "$2")
workspace_root=${GITHUB_WORKSPACE:-$(pwd)}
fingerprint_script="$workspace_root/.github/scripts/playwright_cache_fingerprint.py"

image_id=$(docker image inspect "$source_image" --format '{{.Id}}')
compatibility_hash=$(python3 "$fingerprint_script" --kind ingestion)
image="openmetadata-playwright-ingestion:${compatibility_hash}"
docker image tag "$image_id" "$image"

mkdir -p "$(dirname "$output_path")"
docker image save "$image" | zstd -T0 -3 -f -o "$output_path"
archive_hash=$(sha256sum "$output_path" | cut -d ' ' -f1)

jq -n \
  --arg sourceSha "$(git -C "$workspace_root" rev-parse HEAD)" \
  --arg createdAt "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
  --arg compatibilityHash "$compatibility_hash" \
  --arg image "$image" \
  --arg imageId "$image_id" \
  --arg archiveHash "$archive_hash" \
  '{
    version: 1,
    sourceSha: $sourceSha,
    createdAt: $createdAt,
    compatibilityHash: $compatibilityHash,
    image: $image,
    imageId: $imageId,
    archiveHash: $archiveHash
  }' > "${output_path%.tar.zst}.manifest.json"

echo "Created Playwright ingestion image at $output_path ($(du -h "$output_path" | cut -f1))"

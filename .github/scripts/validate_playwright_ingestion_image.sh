#!/usr/bin/env bash

#  Copyright 2026 Collate
#  Licensed under the Apache License, Version 2.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#  http://www.apache.org/licenses/LICENSE-2.0
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.

set -euo pipefail

if [[ $# -ne 2 ]]; then
  echo "Usage: $0 <ingestion-image.tar.zst> <expected-compatibility-hash>" >&2
  exit 2
fi

archive_path=$(realpath "$1")
expected_compatibility_hash=$2
manifest_path="${archive_path%.tar.zst}.manifest.json"
workspace_root=${GITHUB_WORKSPACE:-$(pwd)}

if [[ ! -s "$manifest_path" ]]; then
  echo "Cached Playwright ingestion image has no sidecar manifest" >&2
  exit 1
fi

current_compatibility_hash=$(
  python3 "$workspace_root/.github/scripts/playwright_cache_fingerprint.py" --kind ingestion
)
archive_hash=$(sha256sum "$archive_path" | cut -d ' ' -f1)
if [[ "$current_compatibility_hash" != "$expected_compatibility_hash" ||
      "$(jq -r .version "$manifest_path")" != "1" ||
      "$(jq -r .compatibilityHash "$manifest_path")" != "$expected_compatibility_hash" ||
      "$(jq -r .archiveHash "$manifest_path")" != "$archive_hash" ]]; then
  jq . "$manifest_path" >&2
  echo "Cached Playwright ingestion image failed compatibility or integrity validation" >&2
  exit 1
fi

if ! jq -e '
  (.sourceSha | type == "string" and test("^[0-9a-f]{40}$")) and
  (.createdAt | type == "string" and length > 0) and
  (.image | type == "string" and test("^openmetadata-playwright-ingestion:[0-9a-f]{64}$")) and
  (.imageId | type == "string" and test("^sha256:[0-9a-f]{64}$")) and
  (.archiveHash | type == "string" and test("^[0-9a-f]{64}$"))
' "$manifest_path" >/dev/null; then
  echo "Cached Playwright ingestion image manifest is invalid" >&2
  exit 1
fi

echo "Validated reusable Playwright ingestion image from $(jq -r .sourceSha "$manifest_path")"

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
  echo "Usage: $0 <fixture.tar.zst> <expected-compatibility-hash>" >&2
  exit 2
fi

fixture_path=$(realpath "$1")
expected_compatibility_hash=$2
workspace_root=${GITHUB_WORKSPACE:-$(pwd)}
runner_temp=${RUNNER_TEMP:-/tmp}
validation_root=$(mktemp -d "${runner_temp}/playwright-fixture-validation.XXXXXX")

cleanup() {
  rm -rf "$validation_root"
}
trap cleanup EXIT

tar_listing="$validation_root/listing.txt"
tar --zstd -tf "$fixture_path" > "$tar_listing"
for required_path in \
  './fixture-manifest.json' \
  './postgres/PG_VERSION' \
  './opensearch/nodes/' \
  './playwright-state/auth/admin.json' \
  './playwright-state/auth/admin-api-token.json' \
  './playwright-state/entity-response-data.json'; do
  if ! grep -Fq "$required_path" "$tar_listing"; then
    echo "Cached Playwright fixture is missing $required_path" >&2
    exit 1
  fi
done

tar --zstd -xf "$fixture_path" -C "$validation_root" \
  ./fixture-manifest.json \
  ./playwright-state
manifest="$validation_root/fixture-manifest.json"
playwright_state="$validation_root/playwright-state"

current_compatibility_hash=$(
  python3 "$workspace_root/.github/scripts/playwright_cache_fingerprint.py" --kind fixture
)
current_schema_hash=$(
  python3 "$workspace_root/.github/scripts/playwright_cache_fingerprint.py" --kind schema
)
current_seed_hash=$(
  python3 "$workspace_root/.github/scripts/playwright_cache_fingerprint.py" --kind seed
)
current_seed_version=$(sed -n 's:.*<version>\([^<]*\)</version>.*:\1:p' "$workspace_root/pom.xml" | head -1)
playwright_state_hash=$(
  cd "$playwright_state"
  find . -type f -print0 |
    sort -z |
    xargs -0 sha256sum |
    sha256sum |
    cut -d ' ' -f1
)

if [[ "$current_compatibility_hash" != "$expected_compatibility_hash" ||
      "$(jq -r .version "$manifest")" != "2" ||
      "$(jq -r .compatibilityHash "$manifest")" != "$expected_compatibility_hash" ||
      "$(jq -r .schemaHash "$manifest")" != "$current_schema_hash" ||
      "$(jq -r .seedHash "$manifest")" != "$current_seed_hash" ||
      "$(jq -r .seedVersion "$manifest")" != "$current_seed_version" ||
      "$(jq -r .playwrightStateHash "$manifest")" != "$playwright_state_hash" ]]; then
  jq . "$manifest" >&2
  echo "Cached Playwright fixture failed compatibility or integrity validation" >&2
  exit 1
fi

if ! jq -e '
  (.sourceSha | type == "string" and test("^[0-9a-f]{40}$")) and
  (.createdAt | type == "string" and length > 0) and
  (.postgresImage | type == "string" and test("^[^ @]+@sha256:[0-9a-f]{64}$")) and
  (.opensearchImage | type == "string" and test("^[^ @]+@sha256:[0-9a-f]{64}$")) and
  (.searchClusterAlias | type == "string" and test("^[A-Za-z0-9_-]+$"))
' "$manifest" >/dev/null; then
  echo "Cached Playwright fixture has invalid provenance or immutable image references" >&2
  exit 1
fi

echo "Validated reusable Playwright fixture from $(jq -r .sourceSha "$manifest")"

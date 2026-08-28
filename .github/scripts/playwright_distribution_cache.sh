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

usage() {
  echo "Usage:" >&2
  echo "  $0 package <distribution.tar.gz> <cache-dir> <fingerprint> <bundle-mode> <toolchain>" >&2
  echo "  $0 validate <cache-dir> <fingerprint> <bundle-mode> <toolchain>" >&2
  exit 2
}

[[ $# -ge 1 ]] || usage
command=$1
shift

case "$command" in
  package)
    [[ $# -eq 5 ]] || usage
    source_archive=$(realpath "$1")
    cache_dir=$2
    fingerprint=$3
    bundle_mode=$4
    toolchain=$5
    rm -rf "$cache_dir"
    mkdir -p "$cache_dir"
    archive_name=$(basename "$source_archive")
    cp "$source_archive" "$cache_dir/$archive_name"
    archive_hash=$(sha256sum "$cache_dir/$archive_name" | cut -d ' ' -f1)
    jq -n \
      --arg sourceSha "$(git rev-parse HEAD)" \
      --arg createdAt "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
      --arg fingerprint "$fingerprint" \
      --arg bundleMode "$bundle_mode" \
      --arg toolchain "$toolchain" \
      --arg archive "$archive_name" \
      --arg archiveHash "$archive_hash" \
      '{
        version: 1,
        sourceSha: $sourceSha,
        createdAt: $createdAt,
        fingerprint: $fingerprint,
        bundleMode: $bundleMode,
        toolchain: $toolchain,
        buildCommand: "mvn -DskipTests clean package -pl openmetadata-dist -am",
        archive: $archive,
        archiveHash: $archiveHash
      }' > "$cache_dir/distribution-manifest.json"
    ;;
  validate)
    [[ $# -eq 4 ]] || usage
    cache_dir=$1
    fingerprint=$2
    bundle_mode=$3
    toolchain=$4
    manifest="$cache_dir/distribution-manifest.json"
    [[ -s "$manifest" ]] || {
      echo "Cached OpenMetadata distribution has no manifest" >&2
      exit 1
    }
    archive_name=$(jq -r .archive "$manifest")
    if [[ "$archive_name" == */* || "$archive_name" != openmetadata-*.tar.gz ]]; then
      echo "Cached OpenMetadata distribution manifest has an invalid archive name" >&2
      exit 1
    fi
    archive="$cache_dir/$archive_name"
    [[ -s "$archive" ]] || {
      echo "Cached OpenMetadata distribution archive is missing" >&2
      exit 1
    }
    archive_hash=$(sha256sum "$archive" | cut -d ' ' -f1)
    if [[ "$(jq -r .version "$manifest")" != "1" ||
          "$(jq -r .fingerprint "$manifest")" != "$fingerprint" ||
          "$(jq -r .bundleMode "$manifest")" != "$bundle_mode" ||
          "$(jq -r .toolchain "$manifest")" != "$toolchain" ||
          "$(jq -r .buildCommand "$manifest")" != "mvn -DskipTests clean package -pl openmetadata-dist -am" ||
          "$(jq -r .archiveHash "$manifest")" != "$archive_hash" ]]; then
      jq . "$manifest" >&2
      echo "Cached OpenMetadata distribution failed compatibility or integrity validation" >&2
      exit 1
    fi
    if ! jq -e '
      (.sourceSha | type == "string" and test("^[0-9a-f]{40}$")) and
      (.createdAt | type == "string" and length > 0) and
      (.archiveHash | type == "string" and test("^[0-9a-f]{64}$"))
    ' "$manifest" >/dev/null; then
      echo "Cached OpenMetadata distribution has invalid provenance" >&2
      exit 1
    fi
    archive_listing=$(mktemp)
    trap 'rm -f "$archive_listing"' EXIT
    tar -tzf "$archive" > "$archive_listing"
    for required_path in '/bin/openmetadata-server-start.sh' '/conf/openmetadata.yaml' '/libs/openmetadata-service-'; do
      if ! grep -Fq "$required_path" "$archive_listing"; then
        echo "Cached OpenMetadata distribution is missing $required_path" >&2
        exit 1
      fi
    done
    echo "Validated reusable OpenMetadata distribution from $(jq -r .sourceSha "$manifest")"
    ;;
  *)
    usage
    ;;
esac

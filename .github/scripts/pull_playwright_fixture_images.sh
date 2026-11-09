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

if [[ $# -lt 1 ]]; then
  echo "Usage: $0 <image>..." >&2
  exit 2
fi

# Pre-pull the compose images with retries so a transient Docker Hub blip does
# not fail the shard on the very first step. Docker Hub's auth endpoint is
# unreliable enough that a single request per image regularly times out (see
# run 30730142750 where chromium-14/19/20 all failed on
# `Get "https://auth.docker.io/token?..."` with no test having run). Separating
# the pull from `docker compose up` also gives a clearer error when pulls
# actually fail — no orphan containers, exit before the health-wait loop.
pull_image_with_retry() {
  local image=$1
  if docker image inspect "$image" >/dev/null 2>&1; then
    return 0  # already cached from a previous invocation on the same runner
  fi
  local delay=10
  local attempt
  for attempt in 1 2 3; do
    if docker pull --quiet "$image"; then
      return 0
    fi
    if [[ $attempt -eq 3 ]]; then
      echo "docker pull failed for $image after 3 attempts" >&2
      return 1
    fi
    echo "docker pull $image failed on attempt $attempt; retrying in ${delay}s" >&2
    sleep "$delay"
    delay=$(( delay * 2 ))
  done
}

# Pulled together rather than one after the other: import-export-02 on run
# 34826046448 spent 22s on postgres and 3m44s on opensearch back to back.
# `wait` is checked per job so a failed pull still stops the script with its
# own message instead of being swallowed.
pull_pids=()
for image in "$@"; do
  pull_image_with_retry "$image" &
  pull_pids+=("$!")
done

pull_failed=0
for pid in "${pull_pids[@]}"; do
  wait "$pid" || pull_failed=1
done
exit "$pull_failed"

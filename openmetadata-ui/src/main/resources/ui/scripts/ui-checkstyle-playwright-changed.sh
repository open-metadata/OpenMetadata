#!/bin/bash
# Copyright 2026 Collate.
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
# http://www.apache.org/licenses/LICENSE-2.0
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.
#
# Runs playwright checkstyle only on changed files (vs origin/main) or on
# explicitly passed files. Mirrors what the CI workflow does.
#
# Usage:
#   yarn ui-checkstyle:playwright:changed                               # auto-detect
#   yarn ui-checkstyle:playwright:changed playwright/e2e/Foo.spec.ts   # explicit

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
UI_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
REPO_ROOT="$(cd "$UI_DIR/../../../../.." && pwd)"
UI_PREFIX="openmetadata-ui/src/main/resources/ui/"

cd "$UI_DIR"

declare -a FILES

if [ "$#" -gt 0 ]; then
  FILES=("$@")
else
  if git -C "$REPO_ROOT" rev-parse --verify origin/main &>/dev/null; then
    BASE=$(git -C "$REPO_ROOT" merge-base HEAD origin/main)
  else
    echo "origin/main not found locally — attempting to fetch..."
    if git -C "$REPO_ROOT" fetch origin main --depth=1 2>/dev/null; then
      BASE=$(git -C "$REPO_ROOT" merge-base HEAD origin/main)
    else
      echo "Fetch failed. Falling back to HEAD~1."
      BASE=$(git -C "$REPO_ROOT" rev-parse HEAD~1 2>/dev/null \
        || git -C "$REPO_ROOT" rev-parse HEAD)
    fi
  fi

  FILES=()
  while IFS= read -r file; do
    FILES+=("$file")
  done < <(
    git -C "$REPO_ROOT" diff --name-only --diff-filter=ACM "$BASE" HEAD \
      | grep "^${UI_PREFIX}playwright/" \
      | grep -v 'playwright/test-data/' \
      | grep -E '\.(ts|tsx|js|jsx)$' \
      | sed "s|^${UI_PREFIX}||"
  )
fi

if [ "${#FILES[@]}" -eq 0 ]; then
  echo "No changed playwright files to process."
  exit 0
fi

yarn organize-imports:cli "${FILES[@]}"
yarn lint:base --fix "${FILES[@]}"
yarn pretty:base --write "${FILES[@]}"

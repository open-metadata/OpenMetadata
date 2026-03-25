#!/bin/bash
#  Copyright 2021 Collate
#  Licensed under the Apache License, Version 2.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#  http://www.apache.org/licenses/LICENSE-2.0
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.
#
# Runs ui-checkstyle only on changed files (vs origin/main) or on explicitly
# passed files. Mirrors what the CI workflow does, making local fixes fast.
#
# Usage:
#   yarn ui-checkstyle:changed                          # auto-detect from git
#   yarn ui-checkstyle:changed src/components/Foo.tsx  # explicit file(s)

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
UI_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
REPO_ROOT="$(cd "$UI_DIR/../../../../.." && pwd)"
UI_PREFIX="openmetadata-ui-core-components/src/main/resources/ui/"

cd "$UI_DIR"

if [ "$#" -gt 0 ]; then
  CHANGED_FILES="$*"
else
  BASE=$(git -C "$REPO_ROOT" merge-base HEAD origin/main 2>/dev/null || echo "origin/main")
  CHANGED_FILES=$(git -C "$REPO_ROOT" diff --name-only --diff-filter=ACM "$BASE" HEAD \
    | grep "^${UI_PREFIX}src/" \
    | grep -E '\.(ts|tsx|js|jsx|json)$' \
    | sed "s|^${UI_PREFIX}||" \
    | tr '\n' ' ')
fi

if [ -z "${CHANGED_FILES// }" ]; then
  echo "No changed src files to process."
  exit 0
fi

yarn lint:base --fix $CHANGED_FILES
yarn pretty:base --write $CHANGED_FILES

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
# Runs ui-checkstyle only on changed files (vs origin/main) or on explicitly
# passed files. Mirrors what the CI workflow does, making local fixes fast.
#
# Usage:
#   yarn ui-checkstyle:changed                        # auto-detect from git
#   yarn ui-checkstyle:changed src/components/Foo.tsx  # explicit file(s)

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
UI_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
REPO_ROOT="$(cd "$UI_DIR/../../../../.." && pwd)"
UI_PREFIX="openmetadata-ui/src/main/resources/ui/"

cd "$UI_DIR"

declare -a FILES

# BASE is resolved unconditionally: the no-new-debt guards below diff against it
# even when explicit files were passed, so it cannot live inside the else branch.
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

if [ "$#" -gt 0 ]; then
  FILES=("$@")
else
  FILES=()
  while IFS= read -r file; do
    FILES+=("$file")
  done < <(
    git -C "$REPO_ROOT" diff --name-only --diff-filter=ACM "$BASE" HEAD \
      | grep "^${UI_PREFIX}src/" \
      | grep -v 'src/generated/' \
      | grep -v 'src/jsons/' \
      | grep -E '\.(ts|tsx|js|jsx|json)$' \
      | sed "s|^${UI_PREFIX}||"
  )
fi

if [ "${#FILES[@]}" -eq 0 ]; then
  echo "No changed src files to process."
else
  # organize-imports-cli only handles TS/JS source files, not JSON
  TS_FILES=()
  for f in "${FILES[@]}"; do
    [[ "$f" =~ \.(ts|tsx|js|jsx)$ ]] && TS_FILES+=("$f")
  done
  [ "${#TS_FILES[@]}" -gt 0 ] && yarn organize-imports:cli "${TS_FILES[@]}"
  yarn lint:base --fix "${FILES[@]}"
  yarn pretty:base --write "${FILES[@]}"
  yarn license-header-fix "${FILES[@]}"
fi

yarn i18n
yarn generate:app-docs

# The audit gates below are non-fixing: they report and fail. CI runs each with
# continue-on-error and decides at the end, so mirror that here — running them
# under `set -e` would stop at the first failure and hide the rest.
set +e
GATE_FAILURES=()

if [ "${#FILES[@]}" -gt 0 ]; then
  TSX_FILES=()
  for f in "${FILES[@]}"; do
    [[ "$f" =~ \.(ts|tsx|js|jsx)$ ]] && TSX_FILES+=("$f")
  done
  if [ "${#TSX_FILES[@]}" -gt 0 ]; then
    node scripts/tw-audit.js "${TSX_FILES[@]}" || GATE_FAILURES+=("tw-audit")
  fi
fi

node scripts/tw-deprecation-guard.js "$BASE" || GATE_FAILURES+=("tw-guard")

if [ "${#GATE_FAILURES[@]}" -gt 0 ]; then
  echo ""
  echo "✖ ui-checkstyle failed: ${GATE_FAILURES[*]}"
  exit 1
fi

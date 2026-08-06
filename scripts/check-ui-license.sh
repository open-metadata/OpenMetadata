#!/usr/bin/env sh
# pre-commit hook entry: newly-ADDED UI source files must carry the Apache-2.0
# header. Scoped to added files only (`git diff --cached --diff-filter=A`) so
# editing an existing file is never blocked. The UI is Apache-2.0; ingestion/
# uses the Collate Community License and is deliberately out of this hook's scope.
# CI's `ui-checkstyle` (license-check-and-add) is the exact-format backstop.
added=$(git diff --cached --name-only --diff-filter=A 2>/dev/null)
[ -z "$added" ] && exit 0

missing=""
for f in "$@"; do
  printf '%s\n' "$added" | grep -qxF "$f" || continue   # enforce on newly-added files only
  [ -f "$f" ] || continue
  head -n 20 "$f" | grep -q "Licensed under the Apache License" || missing="$missing $f"
done

if [ -n "$missing" ]; then
  echo "New UI source file(s) missing the Apache-2.0 license header:"
  for f in $missing; do echo "  - $f"; done
  echo "Fix: yarn --cwd openmetadata-ui/src/main/resources/ui license-header-fix"
  exit 1
fi
exit 0

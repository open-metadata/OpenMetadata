#!/usr/bin/env sh
# pre-commit hook entry: verify the changed UI files are prettier-formatted,
# using the project's own prettier + config (matches CI `ui-checkstyle`).
# Fails (non-zero) if any file is not formatted. Skips gracefully if the UI
# node_modules aren't installed — CI remains the backstop.
UI="openmetadata-ui/src/main/resources/ui"
PRETTIER="$UI/node_modules/.bin/prettier"

if [ ! -x "$PRETTIER" ]; then
  echo "prettier not installed under $UI (run 'make yarn_install_cache'); skipping UI format check"
  exit 0
fi

"$PRETTIER" --config "$UI/.prettierrc.yaml" --check "$@"
rc=$?
[ "$rc" -eq 0 ] || echo "UI files are not prettier-formatted. Fix: yarn --cwd $UI ui-checkstyle:changed"
exit "$rc"

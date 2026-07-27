---
name: ui-checkstyle
description: Run the ESLint + Prettier + organize-imports sequence that CI's `UI Checkstyle` jobs (`lint-src`, `lint-playwright`, `lint-core-components`) run — on just the files the PR changed — and fail if any file ends up with a diff. Run after authoring or modifying any `.ts`/`.tsx`/`.js`/`.jsx`/`.json` under `openmetadata-ui/src/main/resources/ui/src/`, `.../playwright/`, or `openmetadata-ui-core-components/src/main/resources/ui/src/`, or when CI reports a `UI Checkstyle` failure on a PR.
---

# UI Checkstyle / ESLint + Prettier + organize-imports (Codex agent)

The `UI Checkstyle` workflow (`.github/workflows/ui-checkstyle.yml`) has three
per-area jobs — `lint-src`, `lint-playwright`, `lint-core-components`. Each
reformats the files changed in the PR and fails if the reformat produces a
diff, so the committed tree must already be formatted.

## When to activate

- The user asks to "fix UI checkstyle", "fix UI lint", "run prettier", "run
  eslint", "fix UI format", or similar.
- CI posts a `UI Checkstyle / lint-src|lint-playwright|lint-core-components`
  failure (the bot surfaces the modified files in the job summary).
- After you have finished authoring or editing any `.ts`/`.tsx`/`.js`/
  `.jsx`/`.json` under the three UI trees — before opening a PR or pushing
  a commit that touches UI.

## Procedure

1. Build the file list for each affected area:

   ```bash
   # repo root
   git diff --name-only origin/main...HEAD -- \
     'openmetadata-ui/src/main/resources/ui/src/**/*.{ts,tsx,js,jsx,json}' \
     | sed 's|openmetadata-ui/src/main/resources/ui/||' > /tmp/src_files.txt

   git diff --name-only origin/main...HEAD -- \
     'openmetadata-ui/src/main/resources/ui/playwright/**/*.{ts,tsx,js,jsx}' \
     | sed 's|openmetadata-ui/src/main/resources/ui/||' > /tmp/pw_files.txt

   git diff --name-only origin/main...HEAD -- \
     'openmetadata-ui-core-components/**/*.{ts,tsx,js,jsx,json}' \
     | sed 's|openmetadata-ui-core-components/src/main/resources/ui/||' \
     > /tmp/core_files.txt
   ```

   Skip any empty list — CI won't run that area's job either.

2. From the matching working directory (`openmetadata-ui/src/main/resources/ui`
   or `openmetadata-ui-core-components/src/main/resources/ui`), run the
   three-step sequence that CI runs:

   ```bash
   # 1) imports first
   cat /tmp/src_files.txt | xargs ./node_modules/.bin/organize-imports-cli

   # 2) ESLint --fix
   NODE_OPTIONS='--max-old-space-size=8192' cat /tmp/src_files.txt \
     | xargs ./node_modules/.bin/eslint --no-error-on-unmatched-pattern --fix

   # 3) prettier --write — MUST be last, because organize-imports-cli uses
   #    4-space indentation and drops trailing commas; prettier restores them
   #    to the repo's 2-space + trailing-comma style. Reversing the order
   #    leaves CI with a dirty diff.
   cat /tmp/src_files.txt \
     | xargs ./node_modules/.bin/prettier \
         --config './.prettierrc.yaml' --ignore-path './.prettierignore' \
         --write
   ```

   Core-components has no `organize-imports-cli` wired up — skip step 1 there.

3. Check the diff from the repo root:

   ```bash
   git status --short
   git diff --stat
   ```

   If `git status --short` is empty you're done. Otherwise commit the
   reformatting diff as its own `Fix UI checkstyle` commit, matching the
   existing history for bot-triggered formatting-only commits — unless the
   user asked you to fold it into the in-progress commit.

## Out of scope

- TypeScript type-check errors (`tsc`) — different jobs, different failure
  modes, not auto-fixable by this skill.
- Java formatting — use the `java-checkstyle` skill (`mvn spotless:apply`).
- Python formatting — use `make py_format` (black + isort + pycln).

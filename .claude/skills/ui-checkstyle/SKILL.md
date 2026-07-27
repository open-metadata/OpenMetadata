---
name: ui-checkstyle
description: Run the exact ESLint + Prettier + organize-imports sequence that CI's `UI Checkstyle` jobs (`lint-src`, `lint-playwright`, `lint-core-components`) run — on just the files the PR changed — and fail the task if any file ends up with a diff. Invoke after authoring or modifying any `.ts`, `.tsx`, `.js`, `.jsx`, or `.json` file under `openmetadata-ui/src/main/resources/ui/src/`, `.../playwright/`, or `openmetadata-ui-core-components/src/main/resources/ui/src/`, or when CI reports a "UI Checkstyle" job failure on the PR.
user-invocable: true
argument-hint: "[--src] [--playwright] [--core-components] [--all] [--check]"
allowed-tools:
  - Bash
  - Read
  - Grep
  - Glob
---

# UI Checkstyle / ESLint + Prettier + organize-imports

The `UI Checkstyle` GitHub workflow
(`.github/workflows/ui-checkstyle.yml`) runs three per-area jobs:
`lint-src` (`openmetadata-ui/src/main/resources/ui/src/...`),
`lint-playwright` (`.../playwright/...`),
`lint-core-components`
(`openmetadata-ui-core-components/src/main/resources/ui/src/...`). Each job
reformats only the files changed in the PR and fails if the reformat produces
any diff — i.e. the committed tree must already be formatted.

This skill runs the same sequence locally so the CI never has to ask.

## When to activate

- The user asks to "fix UI checkstyle", "fix UI lint", "run prettier", "run
  eslint", "fix the UI format", "apply UI format", or similar.
- CI posts a `UI Checkstyle / lint-src|lint-playwright|lint-core-components`
  failure (the bot lists the modified files in the job summary).
- After the assistant has finished authoring or editing any `.ts`/`.tsx`/
  `.js`/`.jsx`/`.json` under the three UI trees — before opening a PR or
  pushing a commit that touches UI.

## Arguments

- `--src` (default for files under `openmetadata-ui/.../ui/src/`)
- `--playwright` (files under `.../ui/playwright/`)
- `--core-components` (files under `openmetadata-ui-core-components/...`)
- `--all` — run all three areas
- `--check` — verify only: run the sequence in a dry-run pass and report
  which files are still dirty, without writing. Useful before push.

If invoked with no flag, auto-detect the affected areas from
`git diff --name-only origin/main...HEAD` and run only those.

## Process

### Step 1: Compute the file list

For each area you are running against:

```bash
# from the repo root
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

Skip any list that is empty — that area has no changes so the CI job for it
wouldn't run anyway.

### Step 2: Run the CI sequence

From the corresponding working directory:

```bash
cd openmetadata-ui/src/main/resources/ui   # or .../openmetadata-ui-core-components/src/main/resources/ui

# 1) imports first — organize-imports-cli only exists for the ui module
cat /tmp/src_files.txt | xargs ./node_modules/.bin/organize-imports-cli

# 2) eslint --fix (same flags CI uses)
NODE_OPTIONS='--max-old-space-size=8192' cat /tmp/src_files.txt \
  | xargs ./node_modules/.bin/eslint --no-error-on-unmatched-pattern --fix

# 3) prettier --write — this MUST run after organize-imports because
#    organize-imports uses 4-space indentation / drops trailing commas,
#    and prettier then puts them back to the repo's 2-space + trailing-comma
#    style. Running them in the other order leaves a dirty diff.
cat /tmp/src_files.txt \
  | xargs ./node_modules/.bin/prettier \
      --config './.prettierrc.yaml' --ignore-path './.prettierignore' \
      --write
```

For playwright, use the same three commands on `/tmp/pw_files.txt`.
For core-components, the organize-imports step is skipped (no CLI there) —
just eslint + prettier.

### Step 3: Report what changed

```bash
cd <repo root>
git status --short   # should list only .ts/.tsx/.js/.jsx/.json files
git diff --stat
```

If `git status --short` is empty, the tree is already clean — tell the user
and stop.

### Step 4: Commit (only if the user asked to)

Do NOT auto-commit. Surface the list of modified files to the user; they
decide whether to fold the reformat into the in-progress commit or create a
dedicated "Fix UI checkstyle" commit (matches the repo's existing history for
bot-triggered formatting-only commits).

## Notes

- The `--check` mode mirrors CI's behavior: run the three commands and then
  verify `git status --short` is empty. Revert any writes before exiting so
  the user's working tree isn't touched.
- If ESLint reports hard errors (not warnings, not auto-fixable), stop and
  surface them — they need a real code change, not a format pass. Warnings
  (e.g. `playwright/no-wait-for-selector`) don't fail CI and can be left.
- The analogous Java command is `mvn spotless:apply` — see the
  `java-checkstyle` skill.
- TypeScript type-check errors (`tsc`) are a separate concern and are
  *not* fixed by this skill — the `tsc-src` / `tsc-playwright` jobs are
  currently either skipped or have their own failures surfaced via the CI
  report.

---
name: ui-checkstyle
description: Run the exact ESLint + Prettier + organize-imports sequence that CI's `UI Checkstyle` workflow runs — on just the files the PR changed — and fail the task if any file ends up with a diff. Invoke after authoring or modifying any `.ts`, `.tsx`, `.js`, `.jsx`, or `.json` file under `openmetadata-ui/src/main/resources/ui/src/`, `.../playwright/`, or `openmetadata-ui-core-components/src/main/resources/ui/src/`, or when CI reports a "UI Checkstyle" failure on the PR.
user-invocable: true
argument-hint: "[--src] [--playwright] [--core-components] [--all] [--check]"
allowed-tools:
  - Bash
  - Read
  - Grep
  - Glob
---

# UI Checkstyle / ESLint + Prettier + organize-imports

The `UI Checkstyle` GitHub workflow (`.github/workflows/ui-checkstyle.yml`) runs
a **single `checkstyle` job** (after `check-changes` + `authorize` gates) whose
steps gate **six** checks, each on only the files the PR changed:

1. ESLint + Prettier + organize-imports on **src**
   (`openmetadata-ui/src/main/resources/ui/src/...`)
2. **Licence header** check
3. **i18n sync** (`yarn i18n` produces no diff)
4. **app-docs** (`yarn generate:app-docs` produces no diff)
5. ESLint + Prettier + organize-imports on **playwright** (`.../ui/playwright/...`)
6. ESLint + Prettier on **core-components**
   (`openmetadata-ui-core-components/src/main/resources/ui/src/...`)

Any failing step fails the required **`ui-checkstyle`** status check. Each lint
step reformats the changed files and fails if the reformat produces a diff — i.e.
the committed tree must already be formatted. This skill runs the same sequence
locally so CI never has to ask.

> Note: there is **one** `checkstyle` job with the steps above, not three
> separate `lint-src`/`lint-playwright`/`lint-core-components` jobs — those names
> are the internal step ids, and the workflow also gates licence/i18n/app-docs.

## When to activate

- The user asks to "fix UI checkstyle", "fix UI lint", "run prettier", "run
  eslint", "fix the UI format", "apply UI format", or similar.
- CI reports a `UI Checkstyle` failure (the summary comment lists the failing
  check and the modified files).
- After you have finished authoring or editing any `.ts`/`.tsx`/`.js`/`.jsx`/
  `.json` under the three UI trees — before opening a PR or pushing a commit that
  touches UI.

## Arguments

- `--src` (default for files under `openmetadata-ui/.../ui/src/`)
- `--playwright` (files under `.../ui/playwright/`)
- `--core-components` (files under `openmetadata-ui-core-components/...`)
- `--all` — run all three areas
- `--check` — verify only: run the sequence in a dry-run pass and report which
  files are still dirty, without writing. Useful before push.

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

Skip any list that is empty — that area has no changes so the CI check for it
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

If `git status --short` is empty, the tree is already clean — tell the user and
stop.

### Step 4: Commit

Do not fold the reformat into an unrelated commit. If the user asked you to
commit, follow their preference (fold into the in-progress commit, or make a
separate one). Otherwise, when you are confident the change is a purely
mechanical formatting reformat, you may commit it on its own as a
`Fix UI checkstyle` commit — this matches the repo's existing history for
bot-triggered formatting-only commits. If you are unsure whether the diff is
purely mechanical, do NOT auto-commit: surface the changed-file list and let the
user decide.

## Notes

- The `--check` mode mirrors CI's behavior: run the commands and then verify
  `git status --short` is empty. Revert any writes before exiting so the user's
  working tree isn't touched.
- If ESLint reports hard errors (not warnings, not auto-fixable), stop and
  surface them — they need a real code change, not a format pass. Warnings
  (e.g. `playwright/no-wait-for-selector`) don't fail CI and can be left.
- The analogous Java command is `mvn spotless:apply` — see the `java-checkstyle`
  skill.
- TypeScript type-check errors (`tsc`) are a separate concern and are *not* fixed
  by this skill — the `tsc:check` / `tsc:playwright` scripts run in different jobs.

## Out of scope

- TypeScript type-check errors (`tsc`) — different jobs, different failure modes,
  not auto-fixable by this skill.
- Java formatting — use the `java-checkstyle` skill (`mvn spotless:apply`).
- Python formatting — use `make py_format` (**ruff** lint-fix + format; see
  `ingestion/Makefile`). *(Note: this is ruff, not black/isort/pycln.)*

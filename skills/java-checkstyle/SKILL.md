---
name: java-checkstyle
description: Run `mvn spotless:apply` to fix Java checkstyle / formatting failures and verify the result. Invoke after authoring or modifying any `.java` files, or when CI reports a "Java checkstyle failed" or "Fix Java checkstyle" issue on a PR.
user-invocable: true
argument-hint: "[-pl <module>] [--check]"
allowed-tools:
  - Bash
  - Read
  - Grep
  - Glob
---

# Java Checkstyle / Spotless

OpenMetadata enforces Java formatting via the Spotless Maven plugin. Every CI
build runs `mvn spotless:check` and fails the PR if any file is not formatted.
This skill keeps the fix on a single, consistent command so reviewers never have
to ask for it manually again.

## When to activate

- The user asks to "fix checkstyle", "fix Java formatting", "apply spotless",
  "run spotless", "format Java", or similar.
- CI posts a `Java checkstyle failed` / `Fix Java checkstyle` comment on a PR
  (the project's bot phrases the instruction as "Please run
  `mvn spotless:apply` in the root of your repository and commit the changes to
  this PR").
- After you have finished authoring or editing any `.java` files — before
  opening a PR or pushing a commit that touches Java.

## Arguments

- No arguments: run `mvn spotless:apply` at the repo root across all modules.
- `-pl <module>`: scope to a single Maven module (e.g.
  `-pl openmetadata-service`). Useful when only one module changed and you want
  a faster run.
- `--check`: run `mvn spotless:check` instead of `apply`. Use to confirm the
  tree is clean without touching files (e.g. to verify before push).

## Process

### Step 1: Run Spotless

From the repo root:

```bash
mvn spotless:apply                 # default — formats everything
# or
mvn -pl <module> spotless:apply    # scoped to one module
# or
mvn spotless:check                 # verify only, don't write
```

Spotless is fast (seconds, no compilation). If it fails with a plugin error
(not a formatting diff), surface the error and stop — do not try to hand-edit
formatting around the failure.

### Step 2: Check what changed

```bash
git status --short
git diff --stat
```

Expect reformatting in `.java` files only. If Spotless touches `pom.xml` or
other non-Java files, that's also fine — Spotless is configured for those too
in this repo.

### Step 3: Commit

Do not fold the reformat into an unrelated commit. If the user asked you to
commit, follow their preference (fold into the in-progress commit, or make a
separate one). Otherwise, when you are confident the change is a purely
mechanical formatting reformat, you may commit it on its own as a
`Fix Java checkstyle` commit — this matches the repo's existing history for
bot-triggered formatting-only commits. If you are unsure whether the diff is
purely mechanical, do NOT auto-commit: surface the changed-file list and let the
user decide.

## Notes

- Spotless config lives in the root `pom.xml` (`spotless-maven-plugin`
  section) — `googleJavaFormat` + `removeUnusedImports`. Do not redefine
  formatting rules inline in source files.
- If Spotless keeps rewriting a change you just made, re-read the config —
  Spotless is the source of truth, not the IDE.
- CI enforcement lives in `.github/workflows/java-checkstyle.yml`: the
  `java-checkstyle` job runs `mvn spotless:apply` and fails (`git diff-files`)
  if the tree was not already formatted, posting the "Please run
  `mvn spotless:apply`" comment.

## Out of scope

- UI / TypeScript formatting — use the `ui-checkstyle` skill
  (ESLint + Prettier + organize-imports); this skill is Java-only.
- Python formatting — use `make py_format` (**ruff** lint-fix + format; see
  `ingestion/Makefile`). *(Note: this is ruff, not black/isort/pycln.)*

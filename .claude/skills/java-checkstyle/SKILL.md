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
  `mvn spotless:apply` in the root of your repository and commit the changes").
- After the assistant has finished authoring or editing any `.java` files —
  before opening a PR or pushing a commit that touches Java.

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

### Step 3: Stage and commit (only if the user asked to commit)

Do NOT auto-commit. Report the changed file list to the user and let them
decide whether to fold the formatting into the in-progress commit or make a
separate "Fix Java checkstyle" commit. Follow the repo convention: the
existing branch history already uses `Fix Java checkstyle` as the commit title
for bot-triggered formatting-only commits.

## Notes

- Spotless config lives in the root `pom.xml` (`spotless-maven-plugin`
  section). Do not redefine formatting rules inline in source files.
- If Spotless keeps rewriting a change the user just made, re-read the config
  — Spotless is the source of truth, not the IDE.
- The analogous UI command is `yarn pretty` (see the `test-locally` skill /
  CLAUDE.md for the UI lint flow); this skill is Java-only.

---
name: java-checkstyle
description: Run `mvn spotless:apply` to fix Java checkstyle / formatting failures and verify the result. Run after authoring or modifying any `.java` files, or when CI reports a "Java checkstyle failed" / "Fix Java checkstyle" issue on a PR.
---

# Java Checkstyle / Spotless (Codex agent)

OpenMetadata enforces Java formatting via the Spotless Maven plugin. Every CI
build runs `mvn spotless:check` and fails the PR if any file is not formatted.

## When to activate

- The user asks to "fix checkstyle", "fix Java formatting", "apply spotless",
  "run spotless", "format Java", or similar.
- CI posts a `Java checkstyle failed` / `Fix Java checkstyle` comment on a PR
  (the bot's exact phrasing is "Please run `mvn spotless:apply` in the root of
  your repository and commit the changes to this PR").
- After you have finished authoring or editing any `.java` files — before
  opening a PR or pushing a commit that touches Java.

## Procedure

1. From the repo root run Spotless:

   ```bash
   mvn spotless:apply                 # formats everything
   # or
   mvn -pl <module> spotless:apply    # scope to a single Maven module for speed
   # or
   mvn spotless:check                 # verify only, without rewriting files
   ```

   Spotless is fast (seconds, no compilation). If it fails with a plugin error
   rather than a formatting diff, surface the error and stop — do not try to
   hand-edit formatting around the failure.

2. Inspect the diff:

   ```bash
   git status --short
   git diff --stat
   ```

   Expect changes only in `.java` (and possibly `pom.xml`) files. If Spotless
   keeps rewriting a change you just made, re-read the root `pom.xml`'s
   `spotless-maven-plugin` config — Spotless is the source of truth, not the
   IDE.

3. Only commit if the user asked to. Report the changed-file list first so the
   user can decide whether to fold the reformat into the in-progress commit or
   make a separate "Fix Java checkstyle" commit (matches the repo's existing
   history for bot-triggered formatting-only commits).

## Out of scope

- UI / TypeScript formatting — use `yarn pretty` / ESLint flow (see AGENTS.md
  UI section).
- Python formatting — use `make py_format` (black + isort + pycln).

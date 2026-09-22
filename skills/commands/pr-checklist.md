---
name: pr-checklist
description: Walk the OpenMetadata PR template — linked issue, design, tests + coverage, UI recording, manual tests — then draft and open the PR
argument-hint: "[branch name or PR number — defaults to current branch]"
---

Invoke the PR checklist skill to gather every required section of `.github/pull_request_template.md` and produce a fully-filled PR body before opening (or updating) the PR.

Skill tool: skill: "openmetadata-skills:pr-checklist"

If the user provided a branch name or PR number as an argument, pass it to the skill. Otherwise default to the current branch diffed against `origin/main`.

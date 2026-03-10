---
name: connector-review
description: Review an OpenMetadata connector PR or implementation against golden standards
argument-hint: "[PR number, branch name, or connector path]"
---

Invoke the connector review skill to perform a comprehensive code review.

Skill tool: skill: "openmetadata-skills:connector-review"

If the user provided a PR number, branch name, or connector path as an argument, pass it to the skill. The skill will determine the review mode (Full, Incremental, or Specialized) based on the input.

---
name: load-standards
description: Load OpenMetadata connector development standards into context
argument-hint: "[optional: specific standard name like 'testing' or 'database']"
---

Invoke the load-standards skill to load all or specific connector development standards.

Skill tool: skill: "openmetadata-skills:load-standards"

If the user specified a particular standard (e.g., "testing", "database", "schema"), load only that standard. Otherwise, load all standards.

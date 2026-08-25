---
name: scaffold-connector
description: Scaffold a new OpenMetadata connector with JSON Schema, Python boilerplate, and AI implementation context
argument-hint: "[connector name or description]"
---

Invoke the connector building skill to scaffold a new connector.

Skill tool: skill: "openmetadata-skills:scaffold-connector"

If the user provided a connector name or description as an argument, pass it to the skill. Otherwise, the skill will guide the user through interactive prompts.

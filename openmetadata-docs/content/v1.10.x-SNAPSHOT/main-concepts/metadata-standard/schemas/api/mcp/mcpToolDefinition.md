---
title: mcpToolDefinition
slug: /main-concepts/metadata-standard/schemas/api/mcp/mcptooldefinition
---

# MCP Tool Definition

*Definition of a tool available in the Model Context Protocol*

## Properties

- **`name`** *(string)*: Name of the tool.
- **`description`** *(string)*: Description of what the tool does.
- **`parameters`**: Definition of tool parameters. Refer to *#/definitions/toolParameters*.
## Definitions

- **`toolParameters`** *(object)*: Tool parameter definitions.
  - **`type`** *(string)*: Type of parameter schema. Default: `object`.
  - **`properties`** *(object)*: Parameter properties. Can contain additional properties.
    - **Additional Properties**: Refer to *#/definitions/toolParameter*.
  - **`required`** *(array)*: List of required parameters.
    - **Items** *(string)*
- **`toolParameter`** *(object)*: Individual tool parameter definition.
  - **`type`** *(string)*: Type of parameter. Must be one of: `['string', 'number', 'integer', 'boolean', 'array', 'object']`.
  - **`description`** *(string)*: Description of the parameter.
  - **`enum`** *(array)*: Possible enum values for this parameter.
    - **Items**
  - **`default`**: Default value for this parameter.


Documentation file automatically generated at 2025-08-12 05:39:47.683420+00:00.

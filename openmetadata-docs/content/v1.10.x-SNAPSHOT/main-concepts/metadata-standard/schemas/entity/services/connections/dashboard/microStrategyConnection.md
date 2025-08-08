---
title: microStrategyConnection
slug: /main-concepts/metadata-standard/schemas/entity/services/connections/dashboard/microstrategyconnection
---

# MicroStrategyConnection

*MicroStrategy Connection Config*

## Properties

- **`type`**: Service Type. Refer to *#/definitions/microStrategyType*. Default: `MicroStrategy`.
- **`username`** *(string)*: Username to connect to MicroStrategy. This user should have privileges to read all the metadata in MicroStrategy.
- **`password`** *(string)*: Password to connect to MicroStrategy.
- **`hostPort`** *(string)*: Host and Port of the MicroStrategy instance.
- **`projectName`** *(string)*: MicroStrategy Project Name.
- **`loginMode`** *(string)*: Login Mode for Microstrategy's REST API connection. You can authenticate with one of the following authentication modes: `Standard (1)`, `Anonymous (8)`. Default will be `Standard (1)`. If you're using demo account for Microstrategy, it will be needed to authenticate through loginMode `8`. Default: `1`.
- **`dashboardFilterPattern`**: Regex to exclude or include dashboards that matches the pattern. Refer to *../../../../type/filterPattern.json#/definitions/filterPattern*.
- **`chartFilterPattern`**: Regex exclude or include charts that matches the pattern. Refer to *../../../../type/filterPattern.json#/definitions/filterPattern*.
- **`dataModelFilterPattern`**: Regex exclude or include data models that matches the pattern. Refer to *../../../../type/filterPattern.json#/definitions/filterPattern*.
- **`projectFilterPattern`**: Regex to exclude or include projects that matches the pattern. Refer to *../../../../type/filterPattern.json#/definitions/filterPattern*.
- **`supportsMetadataExtraction`**: Refer to *../connectionBasicType.json#/definitions/supportsMetadataExtraction*.
## Definitions

- **`microStrategyType`** *(string)*: MicroStrategy service type. Must be one of: `['MicroStrategy']`. Default: `MicroStrategy`.


Documentation file automatically generated at 2025-08-08 15:20:07.536378+00:00.

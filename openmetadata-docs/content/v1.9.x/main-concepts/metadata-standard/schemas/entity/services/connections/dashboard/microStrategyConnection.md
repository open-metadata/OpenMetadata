---
title: microStrategyConnection | Official Documentation
description: Configure MicroStrategy dashboard connections with supported schema for structured ingestion and detailed visualization metadata tracking.
slug: /main-concepts/metadata-standard/schemas/entity/services/connections/dashboard/microstrategyconnection
---

# MicroStrategyConnection

*MicroStrategy Connection Config*

## Properties

- **`type`**: Service Type. Refer to *[#/definitions/microStrategyType](#definitions/microStrategyType)*. Default: `"MicroStrategy"`.
- **`username`** *(string)*: Username to connect to MicroStrategy. This user should have privileges to read all the metadata in MicroStrategy.
- **`password`** *(string, format: password)*: Password to connect to MicroStrategy.
- **`hostPort`** *(string, format: uri)*: Host and Port of the MicroStrategy instance.
- **`projectName`** *(string)*: MicroStrategy Project Name.
- **`loginMode`** *(string)*: Login Mode for Microstrategy's REST API connection. You can authenticate with one of the following authentication modes: `Standard (1)`, `Anonymous (8)`. Default will be `Standard (1)`. If you're using demo account for Microstrategy, it will be needed to authenticate through loginMode `8`. Default: `"1"`.
- **`supportsMetadataExtraction`**: Refer to *[../connectionBasicType.json#/definitions/supportsMetadataExtraction](#/connectionBasicType.json#/definitions/supportsMetadataExtraction)*.
## Definitions

- **`microStrategyType`** *(string)*: MicroStrategy service type. Must be one of: `["MicroStrategy"]`. Default: `"MicroStrategy"`.


Documentation file automatically generated at 2025-01-15 09:05:41.923720+00:00.

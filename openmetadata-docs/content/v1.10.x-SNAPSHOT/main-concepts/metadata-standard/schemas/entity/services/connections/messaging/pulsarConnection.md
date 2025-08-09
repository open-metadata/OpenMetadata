---
title: pulsarConnection
slug: /main-concepts/metadata-standard/schemas/entity/services/connections/messaging/pulsarconnection
---

# PulsarConnection

*Pulsar Connection Config*

## Properties

- **`type`**: Service Type. Refer to *#/definitions/pulsarType*. Default: `Pulsar`.
- **`topicFilterPattern`**: Regex to only fetch topics that matches the pattern. Refer to *../../../../type/filterPattern.json#/definitions/filterPattern*.
- **`supportsMetadataExtraction`**: Refer to *../connectionBasicType.json#/definitions/supportsMetadataExtraction*.
## Definitions

- **`pulsarType`** *(string)*: Pulsar service type. Must be one of: `['Pulsar']`. Default: `Pulsar`.


Documentation file automatically generated at 2025-08-08 15:20:07.536378+00:00.

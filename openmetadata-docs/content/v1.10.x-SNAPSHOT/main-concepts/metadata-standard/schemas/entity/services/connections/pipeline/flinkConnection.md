---
title: flinkConnection
slug: /main-concepts/metadata-standard/schemas/entity/services/connections/pipeline/flinkconnection
---

# FlinkConnection

*Flink Metadata Connection Config*

## Properties

- **`type`**: Service Type. Refer to *#/definitions/FlinkType*. Default: `Flink`.
- **`hostPort`** *(string)*: Pipeline Service Management/UI URI. Default: `https://api.flink.com`.
- **`verifySSL`**: Refer to *../../../../security/ssl/verifySSLConfig.json#/definitions/verifySSL*. Default: `no-ssl`.
- **`sslConfig`**: Refer to *../../../../security/ssl/verifySSLConfig.json#/definitions/sslConfig*.
- **`pipelineFilterPattern`**: Regex exclude pipelines. Refer to *../../../../type/filterPattern.json#/definitions/filterPattern*.
- **`supportsMetadataExtraction`**: Refer to *../connectionBasicType.json#/definitions/supportsMetadataExtraction*.
## Definitions

- **`FlinkType`** *(string)*: Service type. Must be one of: `['Flink']`. Default: `Flink`.


Documentation file automatically generated at 2025-08-12 05:39:47.683420+00:00.

---
title: flinkConnection
slug: /main-concepts/metadata-standard/schemas/entity/services/connections/pipeline/flinkconnection
---

# FlinkConnection

*Flink Metadata Connection Config*

## Properties

- **`type`**: Service Type. Refer to *[#/definitions/FlinkType](#definitions/FlinkType)*. Default: `"Flink"`.
- **`hostPort`** *(string, format: uri)*: Pipeline Service Management/UI URI. Default: `"https://api.flink.com"`.
- **`verifySSL`**: Refer to *[../../../../security/ssl/verifySSLConfig.json#/definitions/verifySSL](#/../../../security/ssl/verifySSLConfig.json#/definitions/verifySSL)*. Default: `"no-ssl"`.
- **`sslConfig`**: Refer to *[../../../../security/ssl/verifySSLConfig.json#/definitions/sslConfig](#/../../../security/ssl/verifySSLConfig.json#/definitions/sslConfig)*.
## Definitions

- **`FlinkType`** *(string)*: Service type. Must be one of: `["Flink"]`. Default: `"Flink"`.


Documentation file automatically generated at 2025-01-15 09:05:41.923720+00:00.

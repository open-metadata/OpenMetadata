---
title: grafanaConnection
slug: /main-concepts/metadata-standard/schemas/entity/services/connections/dashboard/grafanaconnection
---

# GrafanaConnection

*Grafana Connection Config*

## Properties

- **`type`**: Service Type. Refer to *#/definitions/grafanaType*. Default: `Grafana`.
- **`hostPort`** *(string)*: URL to the Grafana instance.
- **`apiKey`** *(string)*: Service Account Token to authenticate to the Grafana APIs. Use Service Account Tokens (format: glsa_xxxx) for authentication. Legacy API Keys are no longer supported by Grafana as of January 2025. Both self-hosted and Grafana Cloud are supported. Requires Admin role for full metadata extraction.
- **`verifySSL`** *(boolean)*: Boolean marking if we need to verify the SSL certs for Grafana. Default to True. Default: `True`.
- **`dashboardFilterPattern`**: Regex to exclude or include dashboards that matches the pattern. Refer to *../../../../type/filterPattern.json#/definitions/filterPattern*.
- **`chartFilterPattern`**: Regex exclude or include charts that matches the pattern. Refer to *../../../../type/filterPattern.json#/definitions/filterPattern*.
- **`pageSize`** *(integer)*: Page size for pagination in API requests. Default is 100. Minimum: `1`. Default: `100`.
- **`supportsMetadataExtraction`**: Refer to *../connectionBasicType.json#/definitions/supportsMetadataExtraction*.
## Definitions

- **`grafanaType`** *(string)*: Grafana service type. Must be one of: `['Grafana']`. Default: `Grafana`.


Documentation file automatically generated at 2025-08-12 05:39:47.683420+00:00.

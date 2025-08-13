---
title: Restcatalogconnection | Official Documentation
description: Get started with restcatalogconnection. Setup instructions, features, and configuration details inside.
slug: /main-concepts/metadata-standard/schemas/entity/services/connections/database/iceberg/restcatalogconnection
---

# RestCatalogConnection

*Iceberg REST Catalog configuration.*

## Properties

- **`uri`** *(string, format: uri)*: Uri to the REST catalog. Example: 'http://rest-catalog/ws/'.
- **`credential`** *(object)*: OAuth2 credential to use when initializing the catalog. Cannot contain additional properties.
  - **`clientId`** *(string, format: password)*: OAuth2 Client ID.
  - **`clientSecret`** *(string, format: password)*: OAuth2 Client Secret.
- **`token`** *(string, format: password)*: Berarer token to use for the 'Authorization' header.
- **`ssl`**: SSL Configuration details. Refer to *[../../common/sslCertPaths.json](#/../common/sslCertPaths.json)*.
- **`sigv4`** *(object)*: Sign requests to the REST Server using AWS SigV4 protocol.
  - **`signingRegion`** *(string)*: AWS Region to use when SigV4 signs a request.
  - **`signingName`** *(string)*: The service signing name to use when SigV4 signs a request.
- **`fileSystem`**: Refer to *[./icebergFileSystem.json](#icebergFileSystem.json)*.


Documentation file automatically generated at 2025-01-15 09:05:41.923720+00:00.

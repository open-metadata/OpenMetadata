---
title: restCatalogConnection
slug: /main-concepts/metadata-standard/schemas/entity/services/connections/database/iceberg/restcatalogconnection
---

# RestCatalogConnection

*Iceberg REST Catalog configuration.*

## Properties

- **`uri`** *(string)*: Uri to the REST catalog. Example: 'http://rest-catalog/ws/'.
- **`credential`** *(object)*: OAuth2 credential to use when initializing the catalog. Cannot contain additional properties.
  - **`clientId`** *(string)*: OAuth2 Client ID.
  - **`clientSecret`** *(string)*: OAuth2 Client Secret.
- **`token`** *(string)*: Berarer token to use for the 'Authorization' header.
- **`ssl`**: SSL Configuration details. Refer to *../../common/sslCertPaths.json*.
- **`sigv4`** *(object)*: Sign requests to the REST Server using AWS SigV4 protocol.
  - **`signingRegion`** *(string)*: AWS Region to use when SigV4 signs a request.
  - **`signingName`** *(string)*: The service signing name to use when SigV4 signs a request.
- **`fileSystem`**: Refer to *./icebergFileSystem.json*.


Documentation file automatically generated at 2025-08-12 05:39:47.683420+00:00.

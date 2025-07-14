---
title: Iceberg Catalog | OpenMetadata Iceberg Catalog Configuration
description: Get started with icebergcatalog. Setup instructions, features, and configuration details inside.
slug: /main-concepts/metadata-standard/schemas/entity/services/connections/database/iceberg/icebergcatalog
---

# IcebergCatalog

*Iceberg Catalog configuration.*

## Properties

- **`name`** *(string)*: Catalog Name.
- **`connection`**: Catalog connection configuration, depending on your catalog type.
  - **One of**
    - : Refer to *[./hiveCatalogConnection.json](#hiveCatalogConnection.json)*.
    - : Refer to *[./restCatalogConnection.json](#restCatalogConnection.json)*.
    - : Refer to *[./glueCatalogConnection.json](#glueCatalogConnection.json)*.
    - : Refer to *[./dynamoDbCatalogConnection.json](#dynamoDbCatalogConnection.json)*.
- **`databaseName`** *(string)*: Custom Database Name for your Iceberg Service. If not set it will be 'default'.
- **`warehouseLocation`** *(string)*: Warehouse Location. Used to specify a custom warehouse location if needed.


Documentation file automatically generated at 2025-01-15 09:05:41.923720+00:00.

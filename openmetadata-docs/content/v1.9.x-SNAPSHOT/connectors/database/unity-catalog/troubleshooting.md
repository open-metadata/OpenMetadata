---
title: Unity Catalog Connector Troubleshooting
description: Resolve Unity Catalog connector issues quickly with `brandName`'scomprehensive troubleshooting guide. Fix common errors, configuration problems, and c...
slug: /connectors/database/unity-catalog/troubleshooting
---

{% partial file="/v1.9/connectors/troubleshooting.md" /%}

## Unity Catalog connection details

```
source:
  type: unitycatalog
  serviceName: local_unity_catalog
  serviceConnection:
    config:
      catalog: hive_metastore
      databaseSchema: default
      token: <databricks token>
      hostPort: localhost:443
      connectionArguments:
        http_path: <http path of databricks cluster>
  sourceConfig:
    config:
      type: DatabaseMetadata
sink:
  type: metadata-rest
  config: {}
workflowConfig:
  openMetadataServerConfig:
    hostPort: http://localhost:8585/api
    authProvider: no-auth
```

Here are the steps to get `hostPort`, `token` and `http_path`.

First login to Azure Databricks and from side bar select SQL Warehouse (In SQL section)


{% image
src="/images/v1.9/connectors/unitycatalog/select-sql-warehouse.png"
alt="Select Sql Warehouse"
caption="Select Sql Warehouse" /%}


Now click on sql Warehouse from the SQL Warehouses list.


{% image
src="/images/v1.9/connectors/unitycatalog/Open-sql-warehouse.png"
alt="Open Sql Warehouse"
caption="Open Sql Warehouse" /%}


Now inside that page go to Connection details section.
In this page Server hostname and Port is your `hostPort`, HTTP path is your `http_path`.



{% image
src="/images/v1.9/connectors/unitycatalog/Connection-details.png"
alt="Connection details"
caption="Connection details" /%}


In Connection details section page click on Create a personal access token.

{% image
src="/images/v1.9/connectors/unitycatalog/Open-create-token-page.png"
alt="Open create token"
caption="Open create token" /%}



Now In this page you can create new `token`.


{% image
src="/images/v1.9/connectors/unitycatalog/Generate-token.png"
alt="Generate token"
caption="Generate token" /%}


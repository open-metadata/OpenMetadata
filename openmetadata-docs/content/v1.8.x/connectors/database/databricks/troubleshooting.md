---
title: Databricks Connector Troubleshooting
slug: /connectors/database/databricks/troubleshooting
---

{% partial file="/v1.8/connectors/troubleshooting.md" /%}

## Databricks connection details

```
source:
  type: databricks
  serviceName: local_databricks
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
src="/images/v1.8/connectors/databricks/select-sql-warehouse.png"
alt="Select Sql Warehouse"
caption="Select Sql Warehouse" /%}


Now click on sql Warehouse from the SQL Warehouses list.


{% image
src="/images/v1.8/connectors/databricks/Open-sql-warehouse.png"
alt="Open Sql Warehouse"
caption="Open Sql Warehouse" /%}


Now inside that page go to Connection details section.
In this page Server hostname and Port is your `hostPort`, HTTP path is your `http_path`.



{% image
src="/images/v1.8/connectors/databricks/Connection-details.png"
alt="Connection details"
caption="Connection details" /%}


In Connection details section page click on Create a personal access token.

{% image
src="/images/v1.8/connectors/databricks/Open-create-tocken-page.png"
alt="Open create tocken"
caption="Open create tocken" /%}



Now In this page you can create new `token`.


{% image
src="/images/v1.8/connectors/databricks/Generate-token.png"
alt="Generate tocken"
caption="Generate tocken" /%}


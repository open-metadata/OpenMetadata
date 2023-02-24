---
title: Databricks Connector Troubleshooting
slug: /connectors/database/databricks/troubleshooting
---

# Troubleshooting

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

<div className="w-100 flex justify-center">
<Image
  src="/images/openmetadata/connectors/databricks/select-sql-warehouse.webp"
  alt="Select Sql Warehouse"
  caption="Select Sql Warehouse"
/>
</div>

Now click on sql Warehouse from the SQL Warehouses list.

<div className="w-100 flex justify-center">
<Image
  src="/images/openmetadata/connectors/databricks/Open-sql-warehouse.webp"
  alt="Open Sql Warehouse"
  caption="Open Sql Warehouse"
/>
</div>

Now inside that page go to Connection details section.
In this page Server hostname and Port is your `hostPort`, HTTP path is your `http_path`.

<div className="w-100 flex justify-center">
<Image
  src="/images/openmetadata/connectors/databricks/Connection-details.webp"
  alt="Connection details"
  caption="Connection details"
/>
</div>

In Connection details section page click on Create a personal access token.

<div className="w-100 flex justify-center">
<Image
  src="/images/openmetadata/connectors/databricks/Open-create-tocken-page.webp"
  alt="Open create tocken"
  caption="Open create tocken"
/>
</div>

Now In this page you can create new `token`.

<div className="w-100 flex justify-center">
<Image
  src="/images/openmetadata/connectors/databricks/Generate-token.webp"
  alt="Generate tocken"
  caption="Generate tocken"
/>
</div>

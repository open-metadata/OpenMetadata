# DatabricksPipeline

In this section, we provide guides and references to use the Databricks Pipeline connector. You can view the full documentation for DatabricksPipeline [here](https://docs.open-metadata.org/connectors/pipeline/databrickspipeline).

## Requirements

To learn more about the Databricks Connection Details (`hostPort`,`token`, `http_path`) information visit these [docs](https://docs.open-metadata.org/connectors/database/databricks/troubleshooting).

You can find further information on the Databricks Pipeline connector in the [docs](https://docs.open-metadata.org/connectors/pipeline/databrickspipeline).

## Connection Details

$$section
### Host Port $(id="hostPort")
Host and port of the Databricks service. This should be specified as a string in the format `hostname:port`. E.g., `adb-xyz.azuredatabricks.net:443`.
$$

$$section
### Token $(id="token")
Generated Token to connect to Databricks. E.g., `dapw488e89a7176f7eb39bbc718617891564`.
$$

$$section
### Connection Timeout $(id="connectionTimeout")
Connection timeout in seconds. The default value is 120 seconds if not specified.
$$

$$section
### Warehouse ID $(id="warehouseId")
Databricks warehouse ID. If not provided, lineage will NOT be extracted. E.g., `abc123def456`.
You can find your warehouse ID On the warehouse details page under the `Properties` tab.
The token user will need `SELECT` privilege on `system.access.table_lineage` and `system.access.column_lineage` tables.
$$

$$section
### HTTP Path $(id="httpPath")
Databricks compute resources URL. E.g., `/sql/1.0/warehouses/xyz123`.
$$

$$section
### Connection Arguments $(id="connectionArguments")
Additional connection arguments such as security or protocol configs that can be sent to service during connection.
$$

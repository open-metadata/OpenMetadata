# DatabricksPipeline

In this section, we provide guides and references to use the Databricks Pipeline connector. You can view the full documentation for DatabricksPipeline <a href="https://docs.open-metadata.org/connectors/pipeline/databrickspipeline" target="_blank">here</a>.

## Requirements

To learn more about the Databricks Connection Details (`hostPort`,`token`, `http_path`) information visit these <a href="https://docs.open-metadata.org/connectors/database/databricks/troubleshooting" target="_blank">docs</a>.

You can find further information on the Databricks Pipeline connector in the <a href="https://docs.open-metadata.org/connectors/pipeline/databrickspipeline" target="_blank">docs</a>.

## Lineage Requirements

To enable lineage extraction for Databricks pipelines, the user associated with the provided token must have `SELECT` privileges on the following system tables:

- `system.access.table_lineage` - Required for table-level lineage information
- `system.access.column_lineage` - Required for column-level lineage information

Without these permissions, the lineage extraction step will fail with an access error. Ensure your Databricks workspace administrator has granted the necessary permissions to the user whose token is being used for the connection.


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
### HTTP Path $(id="httpPath")
Databricks compute resources URL. E.g., `/sql/1.0/warehouses/xyz123`.
$$

$$section
### Connection Arguments $(id="connectionArguments")
Additional connection arguments such as security or protocol configs that can be sent to service during connection.
$$

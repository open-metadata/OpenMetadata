# Post-Upgrade Steps

### Reindex

{% partial file="/v1.2/deployment/reindex.md" /%}

Since this is required after the upgrade, we want to reindex `All` the entities.

### (Optional) Update your OpenMetadata Ingestion Client

If you are running the ingestion workflows **externally** or using a custom Airflow installation, you need to make sure that the Python Client you use is aligned
with the OpenMetadata server version.

For example, if you are upgrading the server to the version `x.y.z`, you will need to update your client with

```bash
pip install openmetadata-ingestion[<plugin>]==x.y.z
```

The `plugin` parameter is a list of the sources that we want to ingest. An example would look like this `openmetadata-ingestion[mysql,snowflake,s3]==1.2.0`.
You will find specific instructions for each connector [here](/connectors).

Moreover, if working with your own Airflow deployment - not the `openmetadata-ingestion` image - you will need to upgrade
as well the `openmetadata-managed-apis` version:

```bash
pip install openmetadata-managed-apis==x.y.z
```

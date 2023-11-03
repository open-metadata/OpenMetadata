# OpenMetadata Airflow Provider

This package brings:
- Lineage Backend
- Lineage Operator
- OpenMetadata Hook

Note that this is configured as an entrypoint in the `setup.py`:

```python
entry_points={
    "apache_airflow_provider": [
        "provider_info = airflow_provider_openmetadata:get_provider_config"
    ],
},
```

Therefore, any metadata changes that should be discoverable by Airflow need to be passed in `get_provider_config`.

More information about that on Airflow's [docs](https://airflow.apache.org/docs/apache-airflow-providers/index.html?utm_cta=website-events-featured-summit#creating-your-own-providers).

## How to use the OpenMetadataHook

In the Airflow UI you can create a new OpenMetadata connection.

Then, load it as follows:

```python
from airflow_provider_openmetadata.hooks.openmetadata import OpenMetadataHook

openmetadata_hook = OpenMetadataHook(openmetadata_conn_id="om_id")  # The ID you provided
server_config = openmetadata_hook.get_conn()
```

## How to use the OpenMetadataLineageOperator

```python
from airflow_provider_openmetadata.lineage.operator import OpenMetadataLineageOperator

OpenMetadataLineageOperator(
    task_id='lineage_op',
    depends_on_past=False,
    server_config=server_config,
    service_name="your-airflow-service",
    only_keep_dag_lineage=True,
)
```

You can get the `server_config` variable using the `OpenMetadataHook` as shown above, or create it
directly:

```python
from metadata.generated.schema.entity.services.connections.metadata.openMetadataConnection import (
    OpenMetadataConnection,
)
from metadata.generated.schema.security.client.openMetadataJWTClientConfig import (
    OpenMetadataJWTClientConfig,
)

server_config = OpenMetadataConnection(
    hostPort="http://localhost:8585/api",
    authProvider="openmetadata",
    securityConfig=OpenMetadataJWTClientConfig(
        jwtToken="<token>"
    ),
)
```

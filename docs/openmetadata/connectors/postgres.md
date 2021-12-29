---
description: This guide will help install Postgres connector and run manually
---

# Postgres

{% hint style="info" %}
**Prerequisites**

OpenMetadata is built using Java, DropWizard, Jetty, and MySQL.

1. Python 3.7 or above
{% endhint %}

## Install from PyPI

{% tabs %}
{% tab title="Install Using PyPI" %}
```bash
pip install 'openmetadata-ingestion[postgres]'
```
{% endtab %}
{% endtabs %}

## Run Manually

```bash
metadata ingest -c ./examples/workflows/postgres.json
```

## Configuration

{% code title="postgres.json" %}
```javascript
{
  "source": {
    "type": "postgres",
    "config": {
      "username": "openmetadata_user",
      "password": "openmetadata_password",
      "host_port": "localhost:5432",
      "database": "pagila",
      "service_name": "local_postgres",
      "data_profiler_enabled": "true",
      "data_profiler_offset": "0",
      "data_profiler_limit": "50000"
    }
  },
 ...
```
{% endcode %}

1. **username** - pass the Postgres username.
2. **password** - the password for the Postgres username.
3. **service\_name** - Service Name for this Postgres cluster. If you added the Postgres cluster through OpenMetadata UI, make sure the service name matches the same.
4. **schema\_filter\_pattern** - It contains includes, excludes options to choose which pattern of schemas you want to ingest into OpenMetadata.
5. **table\_filter\_pattern** - It contains includes, excludes options to choose which pattern of tables you want to ingest into OpenMetadata.
6. **database -** Database name from where data is to be fetched.
7. **data\_profiler\_enabled** - Enable data-profiling (Optional). It will provide you the newly ingested data.
8. **data\_profiler\_offset** - Specify offset.
9. **data\_profiler\_limit** - Specify limit.

## Publish to OpenMetadata

Below is the configuration to publish Postgres data into the OpenMetadata service.

Add `metadata-rest` sink along with `metadata-server` config

{% code title="postgres.json" %}
```javascript
{
  "source": {
    "type": "postgres",
    "config": {
      "username": "openmetadata_user",
      "password": "openmetadata_password",
      "host_port": "localhost:5432",
      "database": "pagila",
      "service_name": "local_postgres",
      "data_profiler_enabled": "true",
      "data_profiler_offset": "0",
      "data_profiler_limit": "50000"
    }
  },
  "sink": {
    "type": "metadata-rest",
    "config": {}
  },
  "metadata_server": {
    "type": "metadata-server",
    "config": {
      "api_endpoint": "http://localhost:8585/api",
      "auth_provider_type": "no-auth"
    }
  }
}
```
{% endcode %}

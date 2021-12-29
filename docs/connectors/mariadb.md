---
description: This guide will help install MariaDB connector and run manually
---

# MariaDB

{% hint style="info" %}
**Prerequisites**

OpenMetadata is built using Java, DropWizard, Jetty, and MySQL.

1. Python 3.7 or above
{% endhint %}

### Install from PyPI

{% tabs %}
{% tab title="Install Using PyPI" %}
```bash
pip install 'openmetadata-ingestion[mysql]'
```
{% endtab %}
{% endtabs %}

### Run Manually

```bash
metadata ingest -c ./examples/workflows/mariadb.json
```

### Configuration

{% code title="mariadb.json" %}
```javascript
{
  "source": {
    "type": "mariadb",
    "config": {
      "username": "openmetadata_user",
      "password": "openmetadata_password",
      "database": "openmetadata_db",
      "service_name": "local_mysql",
      "table_filter_pattern": {
        "excludes": ["demo.*","orders.*"]
      },
      "schema_filter_pattern": {
        "excludes": ["mysql.*", "information_schema.*", "performance_schema.*", "sys.*"]
      }
    }
  },
 ...
```
{% endcode %}

1. **username** - pass the MariaDB username.
2. **password** - password for the username
3. **service\_name** - Service Name for this MariaDB cluster. If you added MariaDB cluster through OpenMetadata UI, make sure the service name matches the same.
4. **table\_filter\_pattern** - It contains includes, excludes options to choose which pattern of tables you want to ingest into OpenMetadata.
5. **schema\_filter\_pattern** - It contains includes, excludes options to choose which pattern of schemas you want to ingest into OpenMetadata.
6. **data\_profiler\_enabled** - Enable data-profiling (Optional). It will provide you the newly ingested data.
7. **data\_profiler\_offset** - Specify offset.
8. **data\_profiler\_limit** - Specify limit.

## Publish to OpenMetadata

Below is the configuration to publish MariaDB data into the OpenMetadata service.

Add optionally `pii` processor and `metadata-rest` sink along with `metadata-server` config

{% code title="mariadb.json" %}
```javascript
{
  "source": {
    "type": "mariadb",
    "config": {
      "username": "openmetadata_user",
      "password": "openmetadata_password",
      "database": "openmetadata_db",
      "service_name": "local_mysql",
      "table_filter_pattern": {
        "excludes": ["demo.*","orders.*"]
      },
      "schema_filter_pattern": {
        "excludes": ["information_schema.*"]
      }
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

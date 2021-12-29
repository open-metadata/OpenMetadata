---
description: This guide will help install MySQL connector and run manually
---

# MySQL

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
metadata ingest -c ./examples/workflows/mysql.json
```

### Configuration

{% code title="mysql.json" %}
```javascript
{
  "source": {
    "type": "mysql",
    "config": {
      "username": "openmetadata_user",
      "password": "openmetadata_password",
      "database": "openmetadata_db",
      "service_name": "local_mysql",
      "data_profiler_enabled": "true",
      "data_profiler_offset": "0",
      "data_profiler_limit": "50000",
      "table_filter_pattern": {
        "excludes": ["demo.*","orders.*"]
      },
      "schema_filter_pattern": {
        "excludes": ["information_schema.*"]
      }
    }
  },
 ...
```
{% endcode %}

1. **username** - pass the MySQL username. We recommend creating a user with read-only permissions to all the databases in your MySQL installation
2. **password** - password for the username
3. **service\_name** - Service Name for this MySQL cluster. If you added MySQL cluster through OpenMetadata UI, make sure the service name matches the same.
4. **table\_filter\_pattern** - It contains includes, excludes options to choose which pattern of tables you want to ingest into OpenMetadata.
5. **schema\_filter\_pattern** - It contains includes, excludes options to choose which pattern of schemas you want to ingest into OpenMetadata.
6. **data\_profiler\_enabled** - Enable data-profiling (Optional). It will provide you the newly ingested data.
7. **data\_profiler\_offset** - Specify offset.
8. **data\_profiler\_limit** - Specify limit.

## Publish to OpenMetadata

Below is the configuration to publish MySQL data into the OpenMetadata service.

Add `metadata-rest` sink along with `metadata-server` config

{% code title="mysql.json" %}
```javascript
{
  "source": {
    "type": "mysql",
    "config": {
      "username": "openmetadata_user",
      "password": "openmetadata_password",
      "database": "openmetadata_db",
      "service_name": "local_mysql",
      "data_profiler_enabled": "true",
      "data_profiler_offset": "0",
      "data_profiler_limit": "50000",
      "table_filter_pattern": {
        "excludes": ["demo.*","orders.*"]
      },
      "schema_filter_pattern": {
        "excludes": ["mysql.*", "information_schema.*", "performance_schema.*", "sys.*"]
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

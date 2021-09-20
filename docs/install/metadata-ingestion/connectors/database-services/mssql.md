---
description: This guide will help install MsSQL connector and run manually
---

# MSSQL

{% hint style="info" %}
**Prerequisites**

OpenMetadata is built using Java, DropWizard, Jetty, and MySQL.

1. Python 3.7 or above
{% endhint %}

### Install from PyPI or Source

{% tabs %}
{% tab title="Install Using PyPI" %}
```bash
pip install 'openmetadata-ingestion[mssql]'
```
{% endtab %}
{% endtabs %}

## Run Manually

```bash
metadata ingest -c ./examples/workflows/mssql.json
```

### Configuration

{% code title="mssql.json" %}
```javascript
{
  "source": {
    "type": "mssql",
    "config": {
      "host_port": "localhost:1433",
      "service_name": "local_mssql",
      "database": "catalog_test",
      "query": "select top 50 * from {}.{}",
      "username": "sa",
      "password": "test!Password",
      "filter_pattern": {
        "excludes": ["catalog_test.*"]
      }
    }
  },
 ...
```
{% endcode %}

1. **username** - pass the mssql username.
2. **password** - the password for the mssql username.
3. **service\_name** - Service Name for this mssql cluster. If you added the mssql cluster through OpenMetadata UI, make sure the service name matches the same.
4. **host\_port** - Hostname and Port number where the service is being initialized.
5. **filter\_pattern** - It contains includes, excludes options to choose which pattern of datasets you want to ingest into OpenMetadata
6. **database** - Database name from where data is to be fetched from.

## Publish to OpenMetadata

Below is the configuration to publish mssql data into the OpenMetadata service.

Add Optionally `pii` processor and `metadata-rest-tables` sink along with `metadata-server` config

{% code title="mssql.json" %}
```javascript
{
  "source": {
    "type": "mssql",
    "config": {
      "host_port": "localhost:1433",
      "service_name": "local_mssql",
      "database": "catalog_test",
      "query": "select top 50 * from {}.{}",
      "username": "sa",
      "password": "test!Password",
      "filter_pattern": {
        "excludes": ["catalog_test.*"]
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
  },
  "cron": {
    "minute": "*/5",
    "hour": null,
    "day": null,
    "month": null,
    "day_of_week": null
  }
}

 ...
```
{% endcode %}


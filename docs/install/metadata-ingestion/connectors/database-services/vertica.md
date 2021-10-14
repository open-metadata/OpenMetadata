---
description: This guide will help install Vertica Usage connector and run manually
---

# Vertica Usage

{% hint style="info" %}
**Prerequisites**

OpenMetadata is built using Java, DropWizard, Jetty, and MySQL.

1. Python 3.7 or above
2. OpenMetadata Server up and running
{% endhint %}

### Install from PyPI or Source

{% tabs %}
{% tab title="Install Using PyPI" %}
```bash
pip install 'openmetadata-ingestion[vertica]'
```
{% endtab %}
{% endtabs %}

## Run Manually

```bash
metadata ingest -c ./examples/workflows/vertica.json
```

### Configuration

{% code title="vertica.json" %}
```javascript
{
  "source": {
    "type": "vertica",
    "config": {
      "username": "openmetadata_user",
      "password": "openmetadata_password",
      "database": "openmetadata_db",
      "service_name": "local_vertica",
      "filter_pattern": {
        "excludes": []
      }
    }
  },
```
{% endcode %}

1. **username **- pass the Vertica username.
2. **password** - password for the username.
3. **service_name** - Service Name for this Vertica cluster. If you added Vertica cluster through OpenMetadata UI, make sure the service name matches the same.
4. **filter_pattern** - It contains includes, excludes options to choose which pattern of datasets you want to ingest into OpenMetadata

### Publish to OpenMetadata

Below is the configuration to publish Vertica Usage data into the OpenMetadata service.

Add Optionally `query-parser` processor, `table-usage` stage  and`metadata-usage` bulk\_sink along with `metadata-server` config

{% code title="vertica.json" %}
```javascript
{
  "source": {
    "type": "vertica",
    "config": {
      "username": "openmetadata_user",
      "password": "openmetadata_password",
      "database": "openmetadata_db",
      "service_name": "local_vertica",
      "filter_pattern": {
        "excludes": []
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

---
description: This guide will help install Vertica connector and run manually
---

# Vertica

{% hint style="info" %}
**Prerequisites**

OpenMetadata is built using Java, DropWizard, Jetty, and MySQL.

1. Python 3.7 or above
{% endhint %}

### Install from PyPI

{% tabs %}
{% tab title="Install Using PyPi" %}
```javascript
pip install 'openmetadata-ingestion[vertica]'
```
{% endtab %}
{% endtabs %}

### Run Manually

```javascript
metadata ingest -c ./examples/workflows/vertica.json
```

### Configurationvertica.json

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
 ...
```
{% endcode %}

1. \*\*username \*\*- pass the Vertica username.
2. **password** - password for the username.
3. **service\_name** - Service Name for this Vertica cluster. If you added Vertica cluster through OpenMetadata UI, make sure the service name matches the same.
4. **filter\_pattern** - It contains includes, excludes options to choose which pattern of datasets you want to ingest into OpenMetadata

### Publish to OpenMetadata

Below is the configuration to publish MySQL data into the OpenMetadata service.

Add `metadata-rest` sink along with `metadata-server` config

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

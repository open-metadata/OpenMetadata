---
description: This guide will help install Superset connector and run manually
---

# Superset

{% hint style="info" %}
**Prerequisites**

OpenMetadata is built using Java, DropWizard, Jetty, and MySQL.

1. Python 3.7 or above
{% endhint %}

### Install from PyPI or Source

{% tabs %}
{% tab title="Install Using PyPI" %}
```bash
pip install 'openmetadata-ingestion[superset]'
```
{% endtab %}
{% endtabs %}

### Run Manually

```bash
metadata ingest -c ./pipelines/superset.json
```

### Configuration

{% code title="superset.json" %}
```javascript
{
  "source": {
    "type": "superset",
    "config": {
      "url": "http://localhost:8088",
      "username": "admin",
      "password": "admin",
      "service_name": "local_superset"
    }
  },
 ...
```
{% endcode %}

1. **username** - pass the Superset username.
2. **password** - password for the username.
3. **url** - superset connector url
4. **service\_name** - Service Name for this Superset cluster. If you added Superset cluster through OpenMetadata UI, make sure the service name matches the same.
5. **filter\_pattern** - It contains includes, excludes options to choose which pattern of datasets you want to ingest into OpenMetadata

## Publish to OpenMetadata

Below is the configuration to publish Superset data into the OpenMetadata service.

Add optionally `pii` processor and `metadata-rest-tables` sink along with `metadata-server` config

{% code title="superset.json" %}
```javascript
{
  "source": {
    "type": "superset",
    "config": {
      "url": "http://localhost:8088",
      "username": "admin",
      "password": "admin",
      "service_name": "local_superset"
    }
  },
  "sink": {
    "type": "metadata-rest",
    "config": {
    }
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
```
{% endcode %}


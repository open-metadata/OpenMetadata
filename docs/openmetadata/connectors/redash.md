---
description: This guide will help install Redash connector and run manually
---

# Redash

{% hint style="info" %}
**Prerequisites**

OpenMetadata is built using Java, DropWizard, Jetty, and MySQL.

1. Python 3.7 or above
{% endhint %}

### Install from PyPI

{% tabs %}
{% tab title="Install Using PyPI" %}
```bash
pip install 'openmetadata-ingestion[redash]'
```
{% endtab %}
{% endtabs %}

## Run Manually

```bash
metadata ingest -c ./examples/workflows/redash.json
```

### Configuration

{% code title="redash.json" %}
```javascript
{
  "source": {
    "type": "redash",
    "config": {
      "api_key": "api_key",
      "uri": "http://localhost:5000",
      "service_name": "redash"
    }
  },
```
{% endcode %}

1. **api\_key** - pass the Redash generated api key.
2. **uri** - pass the URI (host:port).
3. **service\_name** - Service Name for this Redash cluster. If you added the Redash cluster through OpenMetadata UI, make sure the service name matches the same.
4. **filter\_pattern** - It contains includes, excludes options to choose which pattern of datasets you want to ingest into OpenMetadata.

### Publish to OpenMetadata

Below is the configuration to publish Redash data into the OpenMetadata service.

Add Optionally`pii` processor and `metadata-rest` sink along with `metadata-server` config

{% code title="redash.json" %}
```javascript
{
  "source": {
    "type": "redash",
    "config": {
      "api_key": "api_key",
      "uri": "http://localhost:5000",
      "service_name": "redash"
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

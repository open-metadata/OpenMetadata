---
description: This guide will help install Presto connector and run manually
---

# Presto

{% hint style="info" %}
**Prerequisites**

1. Python 3.7 or above
2. OpenMetadata Server up and running
{% endhint %}

### Install from PyPI

{% tabs %}
{% tab title="Install Using PyPI" %}
```bash
pip install 'openmetadata-ingestion[presto]'
```
{% endtab %}
{% endtabs %}

## Run Manually

```bash
metadata ingest -c ./examples/workflows/presto.json
```

### Configuration

{% code title="presto.json" %}
```javascript
  "source": {
    "type": "presto",
    "config": {
      "service_name": "local_presto",
      "host_port": "192.168.1.32:8080",
      "database": "default"
    }
  }, ...
```
{% endcode %}

1. **username** - this is an optional configuration if you are using username/password with presto. Please use these fields to configure them
2. **password** - password for the username
3. **host\_port** - host and port of the Presto cluster
4. **service\_name** - Service Name for this Presto cluster. If you added the Presto cluster through OpenMetadata UI, make sure the service name matches the same.
5. **table\_filter\_pattern** - It contains includes, excludes options to choose which pattern of tables you want to ingest into OpenMetadata.
6. **schema\_filter\_pattern** - It contains includes, excludes options to choose which pattern of schemas you want to ingest into OpenMetadata.

## Publish to OpenMetadata

Below is the configuration to publish Presto data into the OpenMeatadata service.

add `metadata-rest` sink along with `metadata-server` config

{% code title="presto.json" %}
```javascript
{
  "source": {
    "type": "presto",
    "config": {
      "service_name": "local_presto",
      "host_port": "192.168.1.32:8080",
      "database": "default"
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
  }
}
```
{% endcode %}

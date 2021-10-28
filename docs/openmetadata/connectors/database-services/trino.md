---
description: This guide will help install Trino connector and run manually
---

# Trino

{% hint style="info" %}
**Prerequisites**

1. Python 3.7 or above
2. OpenMetadata Server up and running
   {% endhint %}

### Install from PyPI or Source

{% tabs %}
{% tab title="Install Using PyPI" %}

```bash
pip install 'openmetadata-ingestion[trino]'
```

{% endtab %}
{% endtabs %}

## Run Manually

```bash
metadata ingest -c ./examples/workflows/trino.json
```

### Configuration

{% code title="trino.json" %}

```javascript
{
  "source": {
    "type": "trino",
    "config": {
      "service_name": "local_trino",
      "host_port": "localhost:8080",
      "catalog": "system"
    }
  }, ...
```

{% endcode %}

1. **username** - this is an optional configuration if you are using username/password with trino. Please use these fields to configure them
2. **password** - password for the username
3. **host_port** - host and port of the Trino cluster
4. **service_name** - Service Name for this Trino cluster. If you added the Trino cluster through OpenMetadata UI, make sure the service name matches the same.
5. **filter_pattern** - It contains includes, excludes options to choose which pattern of datasets you want to ingest into OpenMetadata

## Publish to OpenMetadata

Below is the configuration to publish Trino data into the OpenMeatadata service.

add `metadata-rest-tables` sink along with `metadata-server` config

{% code title="trino.json" %}

```javascript
{
  "source": {
    "type": "trino",
    "config": {
      "service_name": "local_trino",
      "host_port": "localhost:8080",
      "catalog": "system"
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

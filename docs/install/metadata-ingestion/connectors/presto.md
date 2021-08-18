---
description: This guide will help install Presto connector and run manually
---

# Presto

{% hint style="info" %}
**Prerequisites**

1. Python 3.7 or above
2. OpenMetadata Server up and running
{% endhint %}

### Install from PyPI or Source

{% tabs %}
{% tab title="Build from source " %}
```bash
# checkout OpenMetadata
git clone https://github.com/open-metadata/OpenMetadata.git
cd OpenMetadata/ingestion
python3 -m venv env
source env/bin/activate
pip install '.[presto]'
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
      "service_type": "Presto",
      "host_port": "192.168.1.32:8080",
      "database": "default"
      "username": "username" (optional)
      "password": "password" (optional)
    }
  }, ...
```
{% endcode %}

1. **username** - this is optional configuration, If you are using username/password with presto. Please use these fields to configure them
2. **password** - password for the username
3. **host\_port** - host and port of the Presto cluster
4. **service\_name** - Service Name for this Presto cluster. If you added Presto cluster through OpenMetadata UI, make sure the service name matches the same.
5. **filter\_pattern** - It contains includes, excludes options to choose which pattern of datasets you want to ingest into OpenMetadata

## Publish to OpenMetadata

Below is the configuration to publish Presto data into the OpenMeatadata service.

add `metadata-rest-tables` sink along with `metadata-server` config

{% code title="presto.json" %}
```javascript
{
  "source": {
    "type": "presto",
    "config": {
      "service_name": "local_presto",
      "service_type": "Presto",
      "host_port": "192.168.1.32:8080",
      "database": "default"
    }
  },
  "processor": {
    "type": "pii",
    "config": {
      "api_endpoint": "http://localhost:8585/api"
    }
  },
  "sink": {
    "type": "metadata-rest-tables",
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


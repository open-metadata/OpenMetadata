---
description: This guide will help install
---

# PII

### Install from PyPI

{% tabs %}
{% tab title="Install from PyPI" %}
```javascript
pip install 'openmetadata-ingestion[pii-processor]'
```
{% endtab %}
{% endtabs %}

### Configuration

```javascript
  "processor": {
    "type": "query-parser",
    "config": {
      "filter": ""
    }
  },
```

### Publish to OpenMetadata

{% hint style="info" %}
We can use this in different [Database Services](../database-services/)
{% endhint %}

Below is the configuration to publish MySQL data into the OpenMetadata service.

Add optionally `pii` processor and `metadata-rest-tables` sink along with `metadata-server` config

Following is the example for mysql.json

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
      "filter_pattern": {
        "excludes": ["mysql.*", "information_schema.*", "performance_schema.*", "sys.*"]
      }
    }
  },
  "processor": {
    "type": "query-parser",
    "config": {
      "filter": ""
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

```
{% endcode %}

### Run Manually

```javascript
metadata ingest -c ./examples/workflows/mysql.json
```


---
description: This guide will help process the data using different pipelines
---

# PII

### Install from PyPI

{% tabs %}
{% tab title="Install from PyPI" %}
```javascript
pip install 'openmetadata-ingestion[pii-processor]'
python -m spacy download en_core_web_sm
```
{% endtab %}
{% endtabs %}

### Configuration

```javascript
  "processor": {
    "type": "pii",
    "config": {}
  },
```

### Publish to OpenMetadata

{% hint style="info" %}
We can use this in different [Database Services](broken-reference)
{% endhint %}

Below is the configuration to publish MySQL data into the OpenMetadata service.

Add optionally `pii` processor and `metadata-rest` sink along with `metadata-server` config

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
      "data_profiler_enabled": "true",
      "data_profiler_offset": "0",
      "data_profiler_limit": "50000",
      "filter_pattern": {
        "excludes": ["mysql.*", "information_schema.*", "performance_schema.*", "sys.*"]
      }
    }
  },
  "processor": {
    "type": "pii",
    "config": {}
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

### Run Manually

```javascript
metadata ingest -c ./examples/workflows/mysql.json
```

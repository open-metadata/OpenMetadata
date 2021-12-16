---
description: >-
  This guide will help install ElasticSearch connector and run manually to index
  the metadata stored in OpenMetadata.
---

# ElasticSearch

{% hint style="info" %}
**Prerequisites**

OpenMetadata is built using Java, DropWizard, Jetty, and MySQL.

1. Python 3.7 or above
{% endhint %}

### Install from PyPI

{% tabs %}
{% tab title="Install Using PyPI" %}
```bash
pip install 'openmetadata-ingestion[elasticsearch]'
```
{% endtab %}
{% endtabs %}

## Run Manually

```bash
metadata ingest -c ./examples/workflows/metadata_to_es.json
```

### Configuration

{% code title="metadata_to_es.json" %}
```javascript
 "sink": {
    "type": "elasticsearch",
    "config": {
      "index_tables": "true",
      "index_topics": "true",
      "index_dashboards": "true",
      "es_host": "localhost",
      "es_port": 9200
    }
...
```
{% endcode %}

### Publish to OpenMetadata

Below is the configuration to publish Elastic Search data into the OpenMetadata service.

{% code title="metadata_to_es.json" %}
```javascript
{
  "source": {
    "type": "metadata",
    "config": {
      "include_tables": "true",
      "include_topics": "true",
      "include_dashboards": "true",
      "limit_records": 10
    }
  },
  "sink": {
    "type": "elasticsearch",
    "config": {
      "index_tables": "true",
      "index_topics": "true",
      "index_dashboards": "true",
      "es_host": "localhost",
      "es_port": 9200
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

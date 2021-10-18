---
description: This guide will help install Kafka connector and run manually
---

# Kafka

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
pip install 'openmetadata-ingestion[kafka]'
python -m spacy download en_core_web_sm
```
{% endtab %}
{% endtabs %}

### Run Manually

```bash
metadata ingest -c ./pipelines/confluent_kafka.json
```

### Configuration

{% code title="confluent_kafka.json" %}
```javascript
{
  "source": {
    "type": "kafka",
    "config": {
      "service_name": "local_kafka",
      "bootstrap_servers": "192.168.1.32:9092",
      "schema_registry_url": "http://192.168.1.32:8081",
      "filter_pattern": {
        "excludes": ["_confluent.*"]
      }
    }
  },
 ...
```
{% endcode %}

1. **service_name** - Service Name for this Kafka cluster. If you added Kafka cluster through OpenMetadata UI, make sure the service name matches the same.
2. **filter_pattern** - It contains includes, excludes options to choose which pattern of datasets you want to ingest into OpenMetadata

## Publish to OpenMetadata

Below is the configuration to publish Kafka data into the OpenMetadata service.

Add optionally `pii` processor and `metadata-rest-tables` sink along with `metadata-server` config

{% code title="confluent_kafka.json" %}
```javascript
{
  "source": {
    "type": "kafka",
    "config": {
      "service_name": "local_kafka",
      "bootstrap_servers": "192.168.1.32:9092",
      "schema_registry_url": "http://192.168.1.32:8081",
      "filter_pattern": {
        "excludes": ["_confluent.*"]
      }
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

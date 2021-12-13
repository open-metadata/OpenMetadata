---
description: This guide will help install the MlFlow connector and run it manually
---

# MlFlow

{% hint style="info" %}
**Prerequisites**

OpenMetadata is built using Java, DropWizard, Jetty, and MySQL.

1. Python 3.7 or above
{% endhint %}

### Install from PyPI

{% tabs %}
{% tab title="Install Using PyPI" %}
```bash
pip install 'openmetadata-ingestion[mlflow]'
```
{% endtab %}
{% endtabs %}

### Run Manually

```bash
metadata ingest -c ./examples/workflows/mlflow.json
```

### Configuration

{% code title="mlflow.json" %}
```javascript
{
  "source": {
    "type": "mlflow",
    "config": {
      "tracking_uri": "http://localhost:5000",
      "registry_uri": "mysql+pymysql://mlflow:password@localhost:3307/experiments"
    }
 ...
```
{% endcode %}

1. **tracking\_uri** - MlFlow server containing the tracking information of runs and experiments ([docs](https://mlflow.org/docs/latest/tracking.html#)).
2. **registry\_uri** - Backend store where the Tracking Server stores experiment and run metadata ([docs](https://mlflow.org/docs/latest/tracking.html#id14)).

## Publish to OpenMetadata

Below is the configuration to publish MlFlow data into the OpenMetadata service.

Add optionally `pii` processor and `metadata-rest` sink along with `metadata-server` config

{% code title="mlflow.json" %}
```javascript
{
  "source": {
    "type": "mlflow",
    "config": {
      "tracking_uri": "http://localhost:5000",
      "registry_uri": "mysql+pymysql://mlflow:password@localhost:3307/experiments"
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

---
description: This guide will help install BigQuery connector and run manually
---

# BigQuery

## BigQuery

{% hint style="info" %}
**Prerequisites**

OpenMetadata is built using Java, DropWizard, Jetty, and MySQL.

1. Python 3.7 or above
{% endhint %}

### Install from PyPI or Source

{% tabs %}
{% tab title="Install Using PyPI" %}
```bash
pip install 'openmetadata-ingestion[bigquery]'
```
{% endtab %}
{% tab title="Build from source " %}
```bash
# checkout OpenMetadata
git clone https://github.com/open-metadata/OpenMetadata.git
cd OpenMetadata/ingestion
python3 -m venv env
source env/bin/activate
pip install '.[bigquery]'
```
{% endtab %}
{% endtabs %}

## Run Manually

```bash
export GOOGLE_APPLICATION_CREDENTIALS="$PWD/pipelines/creds/bigquery-cred.json"
metadata ingest -c ./pipelines/bigquery.json
```

## Configuration


---
description: This guide will help install BigQuery connector and run manually
---

# BigQuery

## BigQuery

{% hint style="info" %}
**Prerequisites**

OpenMetadata is built using Java, DropWizard, Jetty, and MySQL.

1. Python 3.7 or above
2. Create and activate python env

   ```bash
   python3 -m venv env
   source env/bin/activate
   ```
{% endhint %}

## Install

```bash
export GOOGLE_APPLICATION_CREDENTIALS="$PWD/pipelines/creds/bigquery-cred.json"
pip install '.[bigquery]'
```

## Run Manually

```bash
metadata ingest -c ./pipelines/bigquery.json
```

## Configuration


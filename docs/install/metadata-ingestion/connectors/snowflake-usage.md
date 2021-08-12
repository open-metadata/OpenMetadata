---
description: This guide will help install Snowflake Usage connector and run manually
---

# Snowflake Usage

## Snowflake Usage

{% hint style="info" %}
**Prerequisites**

OpenMetadata is built using Java, DropWizard, Jetty, and MySQL.

1. Python 3.7 or above
{% endhint %}

## Install from PyPI or Source

{% tabs %}
{% tab title="Install Using PyPI" %}
```bash
pip install 'openmetadata-ingestion[snowflake-usage]'
```
{% endtab %}
{% tab title="Build from source " %}
```bash
# checkout OpenMetadata
git clone https://github.com/open-metadata/OpenMetadata.git
cd OpenMetadata/ingestion
python3 -m venv env
source env/bin/activate
pip install '.[snowflake-usage]'
```
{% endtab %}
{% endtabs %}


## Run Manually

```bash
metadata ingest -c ./pipelines/snowflake_usage.json
```

## Configuration


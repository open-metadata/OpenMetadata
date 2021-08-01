---
description: This guide will help install Snowflake Usage connector and run manually
---

# Snowflake Usage

## Snowflake Usage

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
pip install '.[snowflake-usage]'
```

## Run Manually

```bash
metadata ingest -c ./pipelines/snowflake_usage.json
```

## Configuration


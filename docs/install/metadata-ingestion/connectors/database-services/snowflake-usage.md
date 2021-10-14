---
description: This guide will help install Snowflake Usage connector and run manually
---

# Snowflake Usage

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
pip install 'openmetadata-ingestion[snowflake-usage]'
```
{% endtab %}
{% endtabs %}

## Run Manually

```bash
metadata ingest -c ./examples/workflows/snowflake_usage.json
```

### Configuration

{% code title="snowflake\_usage.json" %}
```javascript
{
  "source": {
    "type": "snowflake-usage",
    "config": {
      "host_port": "account.region.service.snowflakecomputing.com",
      "username": "username",
      "password": "strong_password",
      "database": "SNOWFLAKE_SAMPLE_DATA",
      "account": "account_name",
      "service_name": "snowflake",
      "duration": 2
    }
  },
```
{% endcode %}

1. **username** - pass the Snowflake username.
2. **password** - the password for the Snowflake username.
3. **service\_name** - Service Name for this Snowflake cluster. If you added the Snowflake cluster through OpenMetadata UI, make sure the service name matches the same.
4. **filter\_pattern** - It contains includes, excludes options to choose which pattern of datasets you want to ingest into OpenMetadata.
5. **database -** Database name from where data is to be fetched.

### Publish to OpenMetadata

Below is the configuration to publish Snowflake Usage data into the OpenMetadata service.

Add Optionally `query-parser` processor, `table-usage` stage  and`metadata-usage` bulk\_sink along with `metadata-server` config

{% code title="snowflake\_usage.json" %}
```javascript
{
  "source": {
    "type": "snowflake-usage",
    "config": {
      "host_port": "account.region.service.snowflakecomputing.com",
      "username": "username",
      "password": "strong_password",
      "database": "SNOWFLAKE_SAMPLE_DATA",
      "account": "account_name",
      "service_name": "snowflake",
      "duration": 2
    }
  },
  "processor": {
    "type": "query-parser",
    "config": {
      "filter": ""
    }
  },
  "stage": {
    "type": "table-usage",
    "config": {
      "filename": "/tmp/snowflake_usage"
    }
  },
  "bulk_sink": {
    "type": "metadata-usage",
    "config": {
      "filename": "/tmp/snowflake_usage"
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


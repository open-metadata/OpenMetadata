---
description: This guide will help install Redshift Usage connector and run manually
---

# Redshift Usage

{% hint style="info" %}
**Prerequisites**

OpenMetadata is built using Java, DropWizard, Jetty, and MySQL.

1. Python 3.7 or above
{% endhint %}

### Install from PyPI or Source

{% tabs %}
{% tab title="Install Using PyPI" %}
```bash
pip install 'openmetadata-ingestion[redshift-usage]'
```
{% endtab %}

{% tab title="Build from source " %}
```bash
# checkout OpenMetadata
git clone https://github.com/open-metadata/OpenMetadata.git
cd OpenMetadata/ingestion
python3 -m venv env
source env/bin/activate
pip install '.[redshift-usage]'
```
{% endtab %}
{% endtabs %}

## Run Manually

```bash
metadata ingest -c ./examples/workflows/redshift_usage.json
```

### Configuration

{% code title="redshift\_usage.json" %}
```javascript
{
  "source": {
    "type": "redshift-usage",
    "config": {
      "host_port": "cluster.user.region.redshift.amazonaws.com:5439",
      "username": "username",
      "password": "password",
      "database": "warehouse",
      "where_clause": "and q.label != 'metrics' and q.label != 'health' and q.label != 'cmstats'",
      "service_name": "aws_redshift",
      "service_type": "Redshift",
      "duration": 2
    }
  },
 ...
```
{% endcode %}

1. **username** - pass the Redshift username. We recommend creating a user with read-only permissions to all the databases in your Redshift installation
2. **password** - password for the username
3. **service\_name** - Service Name for this Redshift cluster. If you added Redshift cluster through OpenMetadata UI, make sure the service name matches the same.
4. **filter\_pattern** - It contains includes, excludes options to choose which pattern of datasets you want to ingest into OpenMetadata

## Publish to OpenMetadata

Below is the configuration to publish Redshift Usage data into openmetadata

Add optional `query-parser` processor, `table-usage` stage and `metadata-usage` bulk\_sink along with `metadata-server` config

{% code title="redshift\_usage.json" %}
```javascript
{
  "source": {
    "type": "redshift-usage",
    "config": {
      "host_port": "cluster.user.region.redshift.amazonaws.com:5439",
      "username": "username",
      "password": "password",
      "database": "warehouse",
      "where_clause": "and q.label != 'metrics' and q.label != 'health' and q.label != 'cmstats'",
      "service_name": "aws_redshift",
      "service_type": "Redshift",
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
      "filename": "/tmp/redshift_usage"
    }
  },
  "bulk_sink": {
    "type": "metadata-usage",
    "config": {
      "filename": "/tmp/redshift_usage"
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


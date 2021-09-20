---
description: This guide will help install Redshift connector and run manually
---

# Redshift

{% hint style="info" %}
**Prerequisites**

OpenMetadata is built using Java, DropWizard, Jetty, and MySQL.

1. Python 3.7 or above
{% endhint %}

## Install from PyPI <a id="install-from-pypi-or-source"></a>

```javascript
pip install 'openmetadata-ingestion[redshift]'
```

## Run Manually <a id="run-manually"></a>

```javascript
metadata ingest -c ./examples/workflows/redshift.json
```

## Configuration

{% code title="redshift.json" %}
```javascript
{
  "source": {
    "type": "redshift",
    "config": {
      "host_port": "cluster.name.region.redshift.amazonaws.com:5439",
      "username": "username",
      "password": "strong_password",
      "database": "warehouse",
      "service_name": "aws_redshift",
      "filter_pattern": {
        "excludes": ["information_schema.*", "[\\w]*event_vw.*"]
      }
    },
...
```
{% endcode %}

1. **username** - pass the Redshift username.
2. **password** - the password for the Redshift username.
3. **service\_name** - Service Name for this Redshift cluster. If you added the Redshift cluster through OpenMetadata UI, make sure the service name matches the same.
4. **filter\_pattern** - It contains includes, excludes options to choose which pattern of datasets you want to ingest into OpenMetadata.
5. **database -** Database name from where data is to be fetched.‌

## Publish to OpenMetadata <a id="publish-to-openmetadata"></a>

Below is the configuration to publish Redshift data into the OpenMetadata service.‌

Add Optionally `pii` processor and `metadata-rest-tables` sink along with `metadata-server` config

{% code title="redshift.json" %}
```javascript
{
  "source": {
    "type": "redshift",
    "config": {
      "host_port": "cluster.name.region.redshift.amazonaws.com:5439",
      "username": "username",
      "password": "strong_password",
      "database": "warehouse",
      "service_name": "aws_redshift",
      "filter_pattern": {
        "excludes": ["information_schema.*", "[\\w]*event_vw.*"]
      }
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


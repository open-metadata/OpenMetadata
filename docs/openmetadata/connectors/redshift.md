---
description: This guide will help install Redshift connector and run manually
---

# Redshift

{% hint style="info" %}
**Prerequisites**

OpenMetadata is built using Java, DropWizard, Jetty, and MySQL.

1. Python 3.7 or above
2. OpenMetadata Server up and running

{% endhint %}

## Install from PyPI <a href="install-from-pypi-or-source" id="install-from-pypi-or-source"></a>

```bash
pip install 'openmetadata-ingestion[redshift]'
```

## Run Manually <a href="run-manually" id="run-manually"></a>

```bash
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
      "data_profiler_enabled": "true",
      "data_profiler_offset": "0",
      "data_profiler_limit": "50000",
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
6. **data\_profiler\_enabled** - Enable data-profiling (Optional). It will provide you the newly ingested data.
7. **data\_profiler\_offset** - Specify offset.
8. **data\_profiler\_limit** - Specify limit.

## Publish to OpenMetadata <a href="publish-to-openmetadata" id="publish-to-openmetadata"></a>

Below is the configuration to publish Redshift data into the OpenMetadata service.‌

Add `metadata-rest` sink along with `metadata-server` config

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
      "data_profiler_enabled": "true",
      "data_profiler_offset": "0",
      "data_profiler_limit": "50000",
      "filter_pattern": {
        "excludes": ["information_schema.*", "[\\w]*event_vw.*"]
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

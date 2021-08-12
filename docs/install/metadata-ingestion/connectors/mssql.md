---
description: This guide will help install MsSQL connector and run manually
---

# MSSQL

## MSSQL

{% hint style="info" %}
**Prerequisites**

OpenMetadata is built using Java, DropWizard, Jetty, and MySQL.

1. Python 3.7 or above
{% endhint %}


### Install from PyPI or Source

{% tabs %}
{% tab title="Install Using PyPI" %}
```bash
pip install 'openmetadata-ingestion[mssql]'
```
{% endtab %}
{% tab title="Build from source " %}
```bash
# checkout OpenMetadata
git clone https://github.com/open-metadata/OpenMetadata.git
cd OpenMetadata/ingestion
python3 -m venv env
source env/bin/activate
pip install '.[mssql]'
```
{% endtab %}
{% endtabs %}

## Run Manually

```bash
metadata ingest -c ./pipelines/mssql.json
```

## Configuration

{% code title="mssql.json" %}
```javascript
{
  "source": {
    "type": "mssql",
    "config": {
      "host_port": "localhost:1433",
      "service_name": "local_mssql",
      "service_type": "MSSQL",
      "database":"catalog_test",
      "username": "sa",
      "password": "test!Password",
      "include_pattern": {
        "allow": ["catalog_test.*"]
      }
    }
  },
 ...
```
{% endcode %}

1. **username** - pass the mssql username.
2. **password** - password for the mssql username.
3. **service\_name** - Service Name for this mssql cluster. If you added mssql cluster through OpenMetadata UI, make sure the service name matches the same.
4. **host\_port** - Hostname and Port number where the service is being initialised.
5. **table\_pattern** - It contains allow, deny options to choose which pattern of datasets you want to ingest into OpenMetadata.
6. **database** - \_\*\*\_Database name from where data is to be fetched from.

## Publish to OpenMetadata
Below is the configuration to publish mssql data into openmetadata

Add Optional ```pii-tags``` processor 
and ```metadata-rest-tables``` sink along with ```metadata-server``` config

{% code title="mssql.json" %}
```javascript
{
  "source": {
    "type": "mssql",
    "config": {
      "host_port": "localhost:1433",
      "service_name": "local_mssql",
      "service_type": "MSSQL",
      "database":"catalog_test",
      "username": "sa",
      "password": "test!Password",
      "include_pattern": {
        "excludes": ["catalog_test.*"]
      }
    }
  },
  "processor": {
    "type": "pii-tags",
    "config": {
    }
  },
  "sink": {
    "type": "metadata-rest-tables",
    "config": {
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
 ...
```
{% endcode %}


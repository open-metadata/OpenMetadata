---
description: This guide will help install MySQL connector and run manually
---

# MySQL

{% hint style="info" %}
**Prerequisites**

OpenMetadata is built using Java, DropWizard, Jetty, and MySQL.

1. Python 3.7 or above
{% endhint %}

### Install from PyPI or Source

{% tabs %}
{% tab title="Install Using PyPI" %}
```bash
pip install 'openmetadata-ingestion[mysql]'
python -m spacy download en_core_web_sm
```
{% endtab %}

{% tab title="Build from source " %}
```bash
# checkout OpenMetadata
git clone https://github.com/open-metadata/OpenMetadata.git
cd OpenMetadata/ingestion
python3 -m venv env
source env/bin/activate
pip install '.[mysql]'
```
{% endtab %}
{% endtabs %}

### Run Manually

```bash
metadata ingest -c ./pipelines/mysql.json
```

### Configuration

{% code title="mysql.json" %}
```javascript
{
  "source": {
    "type": "mysql",
    "config": {
      "username": "openmetadata_user",
      "password": "openmetadata_password",
      "service_name": "local_mysql",
      "filter_pattern": {
        "deny": ["mysql.*", "information_schema.*"]
      }
    }
  },
 ...
```
{% endcode %}

1. **username** - pass the MySQL username. We recommend creating a user with read-only permissions to all the databases in your MySQL installation
2. **password** - password for the username
3. **service\_name** - Service Name for this MySQL cluster. If you added MySQL cluster through OpenMetadata UI, make sure the service name matches the same.
4. **filter\_pattern** - It contains includes, excludes options to choose which pattern of datasets you want to ingest into OpenMetadata

## Publish to OpenMetadata

Below is the configuration to publish MySQL data into the OpenMetadata service.

Add optionally `pii` processor and `metadata-rest-tables` sink along with `metadata-server` config

{% code title="mysql.json" %}
```javascript
{
  "source": {
    "type": "mysql",
    "config": {
      "username": "openmetadata_user",
      "password": "openmetadata_password",
      "service_name": "local_mysql",
      "service_type": "MySQL",
      "filter_pattern": {
        "excludes": ["mysql.*", "information_schema.*"]
      }
    }
  },
  "processor": {
    "type": "pii",
    "config": {
      "api_endpoint": "http://localhost:8585/api"
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
```
{% endcode %}


---
description: This guide will help install Athena connector and run manually
---

# Athena

{% hint style="info" %}
**Prerequisites**

OpenMetadata is built using Java, DropWizard, Jetty, and MySQL.

1. Python 3.7 or above
{% endhint %}

### Install from PyPI or Source

{% tabs %}
{% tab title="Install Using PyPI" %}
```bash
pip install 'openmetadata-ingestion[athena]'
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
pip install '.[athena]'
```
{% endtab %}
{% endtabs %}

### Configuration

{% code title="athena.json" %}
```javascript
{
  "source": {
    "type": "athena",
    "config": {
      "host_port":"host_port",
      "username": "openmetadata_user",
      "password": "openmetadata_password",
      "service_name": "local_athena",
      "service_type": "Athena"
    }
  },
 ...
```
{% endcode %}

1. **username** - pass the Athena username. We recommend creating a user with read-only permissions to all the databases in your Athena installation
2. **password** - password for the username
3. **service\_name** - Service Name for this Athena cluster. If you added the Athena cluster through OpenMetadata UI, make sure the service name matches the same.
4. **filter\_pattern** - It contains includes, excludes options to choose which pattern of datasets you want to ingest into OpenMetadata

## Publish to OpenMetadata

Below is the configuration to publish Athena data into the OpenMetadata service.

Add optionally `pii` processor and `metadata-rest-tables` sink along with `metadata-server` config

{% code title="athena.json" %}
```javascript
{
  "source": {
    "type": "athena",
    "config": {
      "host_port":"host_port",
      "username": "openmetadata_user",
      "password": "openmetadata_password",
      "service_name": "local_athena",
      "service_type": "Athena"
    }
  },
  "processor": {
    "type": "pii",
    "config": {
      "api_endpoint": "http://localhost:8585/api"
    }
  },
  "sink": {
    "type": "metadata-rest",
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


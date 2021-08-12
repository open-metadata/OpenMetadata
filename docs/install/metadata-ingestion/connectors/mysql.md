---
description: This guide will help install MySQL connector and run manually
---

# MySQL

## MySQL

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

### Install from PyPI or Source

{% tabs %}
{% tab title="Install Using PyPI" %}
```bash
pip install 'openmetadata-ingestion[mysql]'
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
      "include_pattern": {
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
4. **table\_pattern** - It contains allow, deny options to choose which pattern of datasets you want to ingest into OpenMetadata

## Publish to OpenMetadata

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
      "include_pattern": {
        "excludes": ["mysql.*", "information_schema.*"]
      }
    }
  },
  "processor": {
    "type": "pii-tags",
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



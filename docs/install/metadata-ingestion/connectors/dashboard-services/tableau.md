---
description: This guide will help install Tableau connector and run manually
---

# Tableau

{% hint style="info" %}
**Prerequisites**

OpenMetadata is built using Java, DropWizard, Jetty, and MySQL.

1. Python 3.7 or above
{% endhint %}

### Install from PyPI or Source

{% tabs %}
{% tab title="Install Using PyPI" %}
```bash
pip install 'openmetadata-ingestion[tableau]'
```
{% endtab %}
{% endtabs %}

### Run Manually

```bash
metadata ingest -c ./pipelines/tableau.json
```

### Configuration

{% code title="tableau.json" %}
```javascript
{
  "source": {
    "type": "tableau",
    "config": {
      "username": "username",
      "password": "password",
      "service_name": "local_tableau",
      "server": "server_address",
      "site_name": "site_name",
      "site_url": "site_url",
      "api_version": "api version",
      "env": "env"
    }
  },
 ...
```
{% endcode %}

1. **username** - pass the Tableau username.
2. **password** - password for the username.
3. **server** - address of the server.
4. **site\_name** - pass the site name.
5. **site\_url** - pass the tableau connector url.
6. **api\_version** - pass an api version.
7. **service\_name** - Service Name for this Tableau cluster. If you added Tableau cluster through OpenMetadata UI, make sure the service name matches the same.
8. **filter\_pattern** - It contains includes, excludes options to choose which pattern of datasets you want to ingest into OpenMetadata

## Publish to OpenMetadata

Below is the configuration to publish Tableau data into the OpenMetadata service.

Add optionally `pii` processor and `metadata-rest-tables` sink along with `metadata-server` config

{% code title="tableau.json" %}
```javascript
{
  "source": {
    "type": "tableau",
    "config": {
      "username": "username",
      "password": "password",
      "service_name": "local_tableau",
      "server": "server_address",
      "site_name": "site_name",
      "site_url": "site_url",
      "api_version": "api version",
      "env": "env"
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


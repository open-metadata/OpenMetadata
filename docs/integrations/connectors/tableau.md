---
description: This guide will help install Tableau connector and run manually
---

# Tableau

{% hint style="info" %}
**Prerequisites**

OpenMetadata is built using Java, DropWizard, Jetty, and MySQL.

1. Python 3.7 or above
{% endhint %}

### Install from PyPI

{% tabs %}
{% tab title="Install Using PyPI" %}
```bash
pip3 install 'openmetadata-ingestion[tableau]'
```
{% endtab %}
{% endtabs %}

### Run Manually

```bash
metadata ingest -c ./examples/workflows/tableau.json
```

### Configuration

{% code title="tableau.json" %}
```javascript
{
  "source": {
    "type": "tableau",
    "serviceName": "local_tableau",
    "serviceConnection": {
      "config": {
        "type": "Tableau",
        "username": "username",
        "password": "password",
        "env": "tableau_prod",
        "hostPort": "http://localhost",
        "siteName": "site_name",
        "apiVersion": "api_version",
        "personalAccessTokenName": "personal_access_token_name",
        "personalAccessTokenSecret": "personal_access_token_secret",
        "dbServiceName": "local_bigquery"
      }
    },
    "sourceConfig": {
      "config": {
        "dashboardFilterPattern": {},
        "chartFilterPattern": {}
      }
    }
  }
```
{% endcode %}

1. **username** - pass the Tableau username.
2. **password** - password for the username.
3. **personalAccessTokenSecret** - \*\*\*\* pass the personal access token secret
4. **personalAccessTokenName** - pass the personal access token name
5. **server** - address of the server.
6. **siteName** - pass the site name.
7. **siteUrl** - pass the tableau connector url.
8. **apiVersion** - pass an api version.
9. **dbServiceName -** Database Service Name in order to add data lineage.
10. **service\_name** - Service Name for this Tableau cluster. If you added Tableau cluster through OpenMetadata UI, make sure the service name matches the same.
11. **dashboardFilterPattern** - It contains includes, excludes options to choose which pattern of datasets you want to ingest into OpenMetadata

## Publish to OpenMetadata

Below is the configuration to publish Tableau data into the OpenMetadata service.

Add `metadata-rest` sink along with `metadata-server` config

{% code title="tableau.json" %}
```javascript
{
  "source": {
    "type": "tableau",
    "serviceName": "local_tableau",
    "serviceConnection": {
      "config": {
        "type": "Tableau",
        "username": "username",
        "password": "password",
        "env": "tableau_prod",
        "hostPort": "http://localhost",
        "siteName": "site_name",
        "apiVersion": "api_version",
        "personalAccessTokenName": "personal_access_token_name",
        "personalAccessTokenSecret": "personal_access_token_secret",
        "dbServiceName": "local_bigquery"
      }
    },
    "sourceConfig": {
      "config": {
        "dashboardFilterPattern": {},
        "chartFilterPattern": {}
      }
    }
  },
  "sink": {
    "type": "metadata-rest",
    "config": {}
  },
  "workflowConfig": {
    "openMetadataServerConfig": {
      "hostPort": "http://localhost:8585/api",
      "authProvider": "no-auth"
    }
  }
}
```
{% endcode %}

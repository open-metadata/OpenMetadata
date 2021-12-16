---
description: This guide will help install Metabase connector and run manually
---

# Metabase

{% hint style="info" %}
**Prerequisites**

OpenMetadata is built using Java, DropWizard, Jetty, and MySQL.

1. Python 3.7 or above
   {% endhint %}

### Install from PyPI

{% tabs %}
{% tab title="Install Using PyPI" %}
```bash
pip install 'openmetadata-ingestion[metabase]'
```
{% endtab %}
{% endtabs %}

## Run Manually

```bash
metadata ingest -c ./examples/workflows/metabase.json
```

### Configuration

{% code title="metabase.json" %}
```javascript
{
  "source": {
    "type": "metabase",
    "config": {
      "username": "username",
      "password": "password",
      "host_port": "host:port",
      "service_name": "local_metabase",
      "database_service_name": "Optional - Create Lineage by adding relevant Database Service Name"
    }
  }
...
```
{% endcode %}

1. **username** - pass the Metabase Client ID.
2. **password** - the password for the Metabase Client Secret.
3. **host\_port** - Hostname and Port number where the service is being initialized.
4. **service\_name** - Service Name for this Metabase cluster. If you added the Metabase cluster through OpenMetadata UI, make sure the service name matches the same.
5. **filter\_pattern** - It contains includes, excludes options to choose which pattern of datasets you want to ingest into OpenMetadata.

### Publish to OpenMetadata

Below is the configuration to publish Metabase data into the OpenMetadata service.

Add `metadata-rest` sink along with `metadata-server` config

{% code title="Metabase.json" %}
```javascript
{
  "source": {
    "type": "metabase",
    "config": {
      "username": "username",
      "password": "password",
      "host_port": "host:port",
      "service_name": "local_metabase",
      "database_service_name": "Optional - Create Lineage by adding relevant Database Service Name"
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

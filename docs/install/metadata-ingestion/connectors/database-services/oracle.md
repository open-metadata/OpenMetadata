---
description: This guide will help install Oracle connector and run manually
---

# Oracle

{% hint style="info" %}
**Prerequisites**

OpenMetadata is built using Java, DropWizard, Jetty, and MySQL.

1. Python 3.7 or above
2. OpenMetadata Server up and running
{% endhint %}

### Install from PyPI or Source

{% tabs %}
{% tab title="Install Using PyPI" %}
```bash
pip install 'openmetadata-ingestion[oracle]'
```
{% endtab %}
{% endtabs %}

### Configuration

{% code title="oracle.json" %}
```javascript
{
  "source": {
    "type": "oracle",
    "config": {
      "host_port":"host_port",
      "username": "openmetadata_user",
      "password": "openmetadata_password",
      "service_name": "local_oracle",
      "service_type": "Oracle"
    }
  },
 ...
```
{% endcode %}

1. **username** - pass the Oracle username. We recommend creating a user with read-only permissions to all the databases in your Oracle installation
2. **password** - password for the username
3. **service\_name** - Service Name for this Oracle cluster. If you added Oracle cluster through OpenMetadata UI, make sure the service name matches the same.
4. **filter\_pattern** - It contains includes, excludes options to choose which pattern of datasets you want to ingest into OpenMetadata

## Publish to OpenMetadata

Below is the configuration to publish Oracle data into the OpenMetadata service.

Add optionally `pii` processor and `metadata-rest-tables` sink along with `metadata-server` config

{% code title="oracle.json" %}
```javascript
{
  "source": {
    "type": "oracle",
    "config": {
      "host_port":"host_port",
      "username": "openmetadata_user",
      "password": "openmetadata_password",
      "service_name": "local_oracle",
      "service_type": "Oracle"
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
  }
}
```
{% endcode %}


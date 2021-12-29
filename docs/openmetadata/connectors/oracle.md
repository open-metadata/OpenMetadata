---
description: This guide will help install Oracle connector and run manually
---

# Oracle

{% hint style="info" %}
**Prerequisites**

OpenMetadata is built using Java, DropWizard, Jetty, and MySQL.

1. Python 3.7 or above
2. Oracle Client Libraries (ref: Click here to [download Oracle Client Libraries](https://help.ubuntu.com/community/Oracle%20Instant%20Client))
{% endhint %}

### Install from PyPI

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
        "host_port":"host:1521",
        "username": "pdbadmin",
        "password": "password",
        "service_name": "local_oracle",
        "service_type": "Oracle",
        "oracle_service_name": "ORCLPDB1"
    }
  },
...
```
{% endcode %}

1. **username** - pass the Oracle username. We recommend creating a user with read-only permissions to all the databases in your Oracle installation
2. **password** - password for the username
3. **host\_port** - Host Port where Oracle Instance is initiated
4. **service\_name** - Service Name for this Oracle cluster. If you added Oracle cluster through OpenMetadata UI, make sure the service name matches the same.
5. **oracle\_service\_name -** Oracle Service Name (TNS alias)
6. **table\_filter\_pattern** - It contains includes, excludes options to choose which pattern of tables you want to ingest into OpenMetadata.
7. **schema\_filter\_pattern** - It contains includes, excludes options to choose which pattern of schemas you want to ingest into OpenMetadata.

## Publish to OpenMetadata

Below is the configuration to publish Oracle data into the OpenMetadata service.

Add `metadata-rest` sink along with `metadata-server` config

{% code title="oracle.json" %}
```javascript
{
  "source": {
    "type": "oracle",
    "config": {
      "host_port": "host:1521",
      "username": "pdbadmin",
      "password": "password",
      "service_name": "local_oracle",
      "service_type": "Oracle",
      "oracle_service_name": "ORCLPDB1"
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

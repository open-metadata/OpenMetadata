---
description: This guide will help install Salesforce connector and run manually
---

# Salesforce

{% hint style="info" %}
**Prerequisites**

OpenMetadata is built using Java, DropWizard, Jetty, and MySQL.

1. Python 3.7 or above
{% endhint %}

### Install from PyPI

{% tabs %}
{% tab title="Install Using PyPI" %}
```bash
pip install 'openmetadata-ingestion[salesforce]'
```
{% endtab %}
{% endtabs %}

### Run Manually

```bash
metadata ingest -c ./examples/workflows/salesforce.json
```

### Configuration

{% code title="salesforce.json" %}
```javascript
{
  "source": {
    "type": "salesforce",
    "config": {
      "username": "username",
      "password": "password",
      "security_token": "secuirty_token",
      "service_name": "local_salesforce",
      "scheme": "salesforce",
      "sobject_name": "Salesforce Object Name"
    }
  },
 ...
```
{% endcode %}

1. **username** - pass the Salesforce username.
2. **password** - password for the username.
3. **security\_token** - pass the security token.
4. **sobject\_name** - pass the salesforce object name.
5. **service\_name** - Service Name for this Salesforce cluster. If you added Salesforce cluster through OpenMetadata UI, make sure the service name matches the same.
6. **table\_filter\_pattern** - It contains includes, excludes options to choose which pattern of tables you want to ingest into OpenMetadata.
7. **schema\_filter\_pattern** - It contains includes, excludes options to choose which pattern of schemas you want to ingest into OpenMetadata.

## Publish to OpenMetadata

Below is the configuration to publish Salesforce data into the OpenMetadata service.

Add `metadata-rest` sink along with `metadata-server` config

{% code title="salesforce.json" %}
```javascript
{
  "source": {
    "type": "salesforce",
    "config": {
      "username": "username",
      "password": "password",
      "security_token": "secuirty_token",
      "service_name": "local_salesforce",
      "scheme": "salesforce",
      "sobject_name": "Salesforce Object Name"
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

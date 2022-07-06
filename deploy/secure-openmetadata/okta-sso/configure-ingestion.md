---
description: This is a guide to configure Ingestion Connectors with security.
---

# Configure Ingestion

## Add Metadata Authentication for Connectors

All Connectors have the **workflowConfig** section. Pass the public/private key pair generated in step 1 in [Create Service Application](create-service-application.md) as privateKey

{% code title="Connector Config for MySQL Connector:" %}
```javascript
{
...
"workflowConfig": { 
    "openMetadataServerConfig": {
      "hostPort": "http://localhost:8585/api",
      "authProvider": "okta",
      "securityConfig": {
        "clientId": "{CLIENT_ID - SPA APP}",   
        "orgURL": "{ISSUER_URL}/v1/token",
        "privateKey": "{public/private keypair}",
        "email": "{email}",
        "scopes": [
          "token"
         ]
      }
    }
  }
...
}
```
{% endcode %}

* **authProvider** - Okta
* **clientId** - Use the CLIENT\_ID for the service application that was created using curl command.
* **orgURL** - It is the same as the ISSUER\_URL with v1/token. It is recommended to use a separate authorization server for different applications, rather than using the default authorization server.
* **privateKey** - Use the Public/Private Key Pair that was generated while [Creating the Service Application](create-service-application.md). When copy-pasting the keys ensure that there are no additional codes and that it is a JSON compatible string.

![](<../../../.gitbook/assets/image (45) (1).png>)

* **email** - Enter the email address
* **scopes** - Add the details of the scope created in the Authorization Server. Enter the name of the default scope created.

{% hint style="warning" %}
Ensure that you configure the workflowConfig section on all of the connector configs if you are ingesting into a secured OpenMetadata Server.
{% endhint %}

## Example

Here's an example on adding the authentication details in the ingestion connectors. Ensure that the **privateKey** is added in a single line under `workflowConfig` when trying to ingest the data using a JSON config file.

```json
{
  "source": {
    "type": "sample-data",
    "serviceName": "sample_data",
    "serviceConnection": {
      "config": {
        "type": "SampleData",
        "sampleDataFolder": "./examples/sample_data"
      }
    },
    "sourceConfig": {}
  },
  "sink": {
    "type": "metadata-rest",
    "config": {}
  },
  "workflowConfig": {
    "openMetadataServerConfig": {
      "hostPort": "http://localhost:8585/api",
      "authProvider": "okta",
      "securityConfig": {
        "clientId": "{CLIENT_ID - SPA APP}",   
        "orgURL": "{ISSUER_URL}/v1/token",
        "privateKey": "{public/private keypair}",
        "email": "{email}",
        "scopes": [
          "token"
         ]
      }
    }
  }
}
```

---
description: This is a guide to configure Ingestion Connectors with security.
---

# Configure Ingestion

## Add Metadata Authentication for Connectors

All Connectors have the **workflowConfig** section. Pass the JSON file generated in [Create Service Account](../auth0-sso/create-service-account.md) as clientSecret.

{% code title="Connector Config for MySQL Connector:" %}
```javascript
{
...
"workflowConfig": { 
    "openMetadataServerConfig": {
      "hostPort": "http://localhost:8585/api",
      "authProvider": "azure",
      "securityConfig": {
        "clientSecret": "{your_client_secret}",   
        "authority": "{your_authority_url}"    
        "clientId": "{your_client_id}",
        "scopes": [
          {your_scopes}
         ]
       }
    }
  }
...
}
```
{% endcode %}

* **clientID:** The Application (Client) ID is displayed in the Overview section of the registered application.
* **authority:** When passing the details for authority, the `Tenant ID` is added to the URL as shown below. https://login.microsoftonline.com/TenantID

![](<../../../../.gitbook/assets/image (71) (1) (1).png>)

* **clientSecret:** The clientSecret can be accessed from the Certificates & secret section of the application.

![](<../../../.gitbook/assets/image (22) (1) (1) (1) (1) (1).png>)

{% hint style="warning" %}
Ensure that you configure the workflowConfig section on all of the connector configs if you are ingesting into a secured OpenMetadata Server.
{% endhint %}

## Example

Here's an example on adding the authentication details in the ingestion connectors. Ensure that the **clientSecret** is added in a single line under `workflowConfig` when trying to ingest the data using a JSON config file.

```javascript
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
      "authProvider": "azure",
      "securityConfig": {
        "clientSecret": "{your_client_secret}",   
        "authority": "{your_authority_url}"    
        "clientId": "{your_client_id}",
        "scopes": [
          {your_scopes}
         ]
       }
    }
  }
}
```

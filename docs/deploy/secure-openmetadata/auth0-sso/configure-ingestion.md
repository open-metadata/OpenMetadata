---
description: This is a guide to configure Ingestion Connectors with security.
---

# Configure Ingestion

## Add Metadata Authentication for Connectors

All Connectors have the **workflowConfig** section. Pass the JSON file generated in [Create Service Account](create-service-account.md) as secretKey

{% code title="Connector Config for MySQL Connector:" %}
```javascript
{
...
"workflowConfig": { 
    "openMetadataServerConfig": {
      "hostPort": "http://localhost:8585/api",
      "authProvider": "auth0",
      "securityConfig": {
        "clientId": "{your_client_id}",
        "secretKey": "{your_client_secret}",
        "domain": "{your_domain}"    
      }
    }
  }
...
}
```
{% endcode %}

{% hint style="warning" %}
Ensure that you configure the workflowConfig section on all of the connector configs if you are ingesting into a secured OpenMetadata Server.
{% endhint %}

## Example

Here's an example on adding the authentication details in the ingestion connectors. Ensure that the **secretKey** is added in a single line under `workflowConfig` when trying to ingest the data using a JSON config file.

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
    "authProvider": "auth0",
    "clientId": "EKuIYiHmATRF0GrGlnYBLmPIY68KKKnX",
    "secretKey": "XVTY-nBV0-7BmlPGL5rJxRllWevV57X7RNZZUN8098og6QcXCL6c_09a-2cdQXez",
    "domain": "dxv-am-oxtha.us.auth0.com"
    }
  }
}
```

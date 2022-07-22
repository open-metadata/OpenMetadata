---
description: This is a guide to configure Ingestion Connectors with security.
---

# Configure Ingestion

## Add Metadata Authentication for Connectors

All Connectors have the **workflowConfig** section. Pass the JSON file generated in [Create Service Account](../google-sso-1/create-service-account.md) as secretKey

{% code title="Connector Config for MySQL Connector:" %}
```javascript
{
...
"workflowConfig": { 
    "openMetadataServerConfig": {
      "hostPort": "http://localhost:8585/api",
      "authProvider": "custom-oidc",
      "securityConfig": {
        "secretKey": "/Users/JohnDoe/Code/catalog/ingestion/pipelines/custom-name-320505-17b19fc14416.json"
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
      "authProvider": "custom-oidc",
      "securityConfig": {
        "secretKey": "/Users/JohnDoe/Code/catalog/ingestion/pipelines/custom-name-320505-17b19fc14416.json"
       }
    }
  }
}
```

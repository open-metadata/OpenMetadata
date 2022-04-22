---
description: This is a guide to configure Ingestion Connectors with security.
---

# Configure Ingestion

## Add Metadata Authentication for Connectors

All Connectors have **metadata\_server** config. Pass the JSON file generated in [Create Service Account](create-service-account.md) as secret\_key

{% code title="Connector Config for MySQL Connector:" %}
```javascript
{
...
   "metadata_server": {
    "type": "metadata-server",
    "config": {
      "api_endpoint": "http://localhost:8585/api",
    "auth_provider_type": "google",
    "secret_key": "/Users/JohnDoe/Code/catalog/ingestion/pipelines/custom-name-320505-17b19fc14416.json"
    }
  },
...
}
```
{% endcode %}

{% hint style="warning" %}
Ensure that you configure the metadata\_server section on all of the connector configs if you are ingesting into a secured OpenMetadata Server.
{% endhint %}

## Example

Here's an example on adding the authentication details in the ingestion connectors. Ensure that the **secret\_key** is added in a single line under `metadata_server` when trying to ingest the data using a JSON config file.

```javascript
{
    "source": {
      "type": "sample-data",
      "config": {
        "sample_data_folder": "./examples/sample_data"
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
              "auth_provider_type": "google",
              "secret_key": "/Users/JohnDoe/Code/catalog/ingestion/pipelines/custom-name-320505-17b19fc14416.json"
      }
    }
  }
```

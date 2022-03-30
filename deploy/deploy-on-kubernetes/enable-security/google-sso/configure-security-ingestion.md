---
description: This is a guide to configure Ingestion Connectors with security.
---

# Configure Ingestion

## Add Metadata Authentication for Connectors

All Connectors have **metadata\_server** config. Pass the JSON file generated in [Create Service Account](../../../deploy-on-bare-metal/enable-security/google-sso/create-ingestion-service-account.md) as secret\_key

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
Make sure you configure the metadata\_server section on all of the connector configs if you are ingesting into a secured OpenMetadataSever
{% endhint %}

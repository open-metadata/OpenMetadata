---
description: This is a guide to configure Ingestion Connectors with security.
---

# Configure Ingestion

## Add Metadata Authentication for Connectors

All Connectors have **metadata\_server** config. Pass the JSON file generated in [Create Service Account](https://github.com/StreamlineData/catalog/tree/3d53fa7c645ea55f846b06d0210ac63f8c38463f/docs/install/security/google-sso/create-ingestion-service-account.md) as secret\_key

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


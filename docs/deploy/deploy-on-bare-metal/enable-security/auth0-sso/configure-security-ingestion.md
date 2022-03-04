---
description: This is a guide to configure Ingestion Connectors with security.
---

# Configure Ingestion

## Add Metadata Authentication for Connectors

All Connectors have **metadata\_server** config. Pass the JSON file generated in [Create Service Account](create-ingestion-service-account.md) as secret\_key

{% code title="Connector Config for MySQL Connector:" %}
```javascript
{
...
   "metadata_server": {
    "type": "metadata-server",
    "config": {
      "api_endpoint": "http://localhost:8585/api",
    "auth_provider_type": "auth0",
    "client_id": "{your_client_id}",
    "secret_key": "{your_client_secret}",
    "domain": "{your_domain}"    
    }
  },
...
}
```
{% endcode %}

{% hint style="warning" %}
Make sure you configure the metadata\_server section on all of the connector configs if you are ingesting into a secured OpenMetadataSever
{% endhint %}


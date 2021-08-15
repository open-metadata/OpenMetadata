---
description: This is a guide to configure Ingestion Connectors with security.
---

# Configure Ingestion

## Add Metadata Authentication for Connectors

All Connectors have **metadata\_server** config. Pass the public/private keypair generated in step 1 in [Create Service Account](https://github.com/StreamlineData/catalog/tree/3d53fa7c645ea55f846b06d0210ac63f8c38463f/docs/install/security/okta-ss0/create-ingestion-service-account.md) as secret\_key

{% code title="Connector Config for MySQL Connector:" %}
```javascript
{
...
   "metadata_server": {
    "type": "metadata-server",
    "config": {
      "api_endpoint": "http://localhost:8585/api",
    "auth_provider_type": "okta",
    "client_id": "{client_id}",
    "org_url": "{okta_domain}",
    "email": "{email}",
    "private_key": "{public/private keypair}"
    }
  },
...
}
```
{% endcode %}

{% hint style="warning" %}
Make sure you configure the metadata\_server section on all of the connector configs if you are ingesting into a secured OpenMetadataSever
{% endhint %}


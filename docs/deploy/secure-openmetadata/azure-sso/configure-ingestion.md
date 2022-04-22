---
description: This is a guide to configure Ingestion Connectors with security.
---

# Configure Ingestion

## Add Metadata Authentication for Connectors

All Connectors have **metadata\_server** config. Pass the JSON file generated in [Create Service Account](../auth0-sso/create-service-account.md) as secret\_key

{% code title="Connector Config for MySQL Connector:" %}
```javascript
{
...
 "metadata_server": {
      "type": "metadata-server",
      "config": {
        "api_endpoint": "http://localhost:8585/api",
        "auth_provider_type": "azure",
        "client_id": "{your_client_id}",
        "authority":"{your_authority_url}",
        "secret_key":"{your_client_secret}",
        "scopes": [
            {your_scopes}
        ]
      }
...
}
```
{% endcode %}

* **client\_id:** The Application (Client) ID is displayed in the Overview section of the registered application.
* **authority:** When passing the details for authority, the `Tenant ID` is added to the URL as shown below. https://login.microsoftonline.com/TenantID

![](<../../../.gitbook/assets/image (26).png>)

* **secret\_key:** The secret\_key can be accessed from the Certificates & secret section of the application.

![](<../../../.gitbook/assets/image (74).png>)

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
        "auth_provider_type": "azure",
        "client_id": "5x5550c9-abcd-4d84-e8gh-a7e712346m5",
        "authority":"https://login.microsoftonline.com/c11234b7c-b1b2-9854-0mn1-56abh3dea295",
        "secret_key":"wS37Q~w31vXcdKlbIhueKdfKTeXBppL8cq4W",
        "scopes": [
            "api://5x5550c9-abcd-4d84-e8gh-a7e712346m5/.default"
        ]
      }
    }
  }
```

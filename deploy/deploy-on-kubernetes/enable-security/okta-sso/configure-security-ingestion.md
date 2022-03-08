---
description: This is a guide to configure Ingestion Connectors with security.
---

# Copy of Configure Ingestion

## Add Metadata Authentication for Connectors

All Connectors have **metadata\_server** config. Pass the public/private key pair generated in step 1 in [Create Service Account](../../../deploy-on-bare-metal/enable-security/okta-sso/create-ingestion-service-account.md) as secret\_key

{% code title="Connector Config for MySQL Connector:" %}
```javascript
{
...
   "metadata_server": {
    "type": "metadata-server",
    "config": {
      "api_endpoint": "http://localhost:8585/api",
    "auth_provider_type": "okta",
    "client_id": "{CLIENT_ID - SPA APP}",
    "org_url": "{ISSUER_URL}/v1/token",
    "private_key": "{public/private keypair}"
    "email": "{email}",
    "scopes": [
     "token"
     ]
    }
  },
...
}
```
{% endcode %}

* **auth\_provider\_type** - Okta
* **client\_id** - Use the CLIENT\_ID for the service application that was created using curl command.&#x20;
* **org\_url **_**** -_ It is the same as the __ ISSUER\_URL with v1/token. It is recommended to use a separate authorization server for different applications, rather than using the default authorization server.
* **private\_key** - Use the Public/Private Key Pair that was generated while [Creating the Service Application](../../../deploy-on-bare-metal/enable-security/okta-sso/create-ingestion-service-account.md). When copy-pasting the keys ensure that there are no additional codes and that it is a JSON compatible string.

![](<../../../../docs/.gitbook/assets/image (45).png>)

* **email** - Enter the email address
* **scopes** - Add the details of the scope created in the Authorization Server. Enter the name of the default scope created.

{% hint style="warning" %}
Make sure you configure the metadata\_server section on all of the connector configs if you are ingesting into a secured OpenMetadataServer
{% endhint %}

## Example

Here's an example on adding the authentication details in the ingestion connectors. Ensure that the **private key** is added in a single line under `metadata_server` when trying to ingest the data using a JSON config file.

```json
{
  "source": {
    "type": "bigquery",
    "config": {
      "service_name": "gcp_bigquery",
      "schema_filter_pattern": {
        "includes": [
          "sdoh_cms_dual_eligible_enrollment"
        ]
      }
    }
  },
  "sink": {
    "type": "metadata-rest",
    "config": {
      "api_endpoint": "http://localhost:8585/api"
    }
  },
  "metadata_server": {
    "type": "metadata-server",
    "config": {
      "api_endpoint": "http://localhost:8585/api",
      "auth_provider_type": "okta",
      "client_id": "0oa3ych62pOhHz5m75d7",
      "org_url": "https://dev-83408225.okta.com/oauth2/aus3yd11n4v16X8MO5d7/v1/token",
      "private_key": "{    'p': 'xr51wRsX6Tt90kBTTRjqEuO7XxW3tarSJT_v9n6bPRupzvhsjRrQFhoTmYQwLJy4uoxtyi7T9E86MxMQHUDnmnAJpEeen-18qGf3GAw7EJBTFMQl2ulueeRW_UnLknZUjjuA2gOO06TI7kugnMjjuUzEpzrU-9yGgCYGFYVwr7M',    'kty': 'RSA',    'q': 'rw6BY9JI2cMHkN634g4h2W1dZ2EdgCBuVFkGp1k4HtZKkvnCZ8PEMSO_jEmi-nEZzhi828becuVoih53KHJGbcZM5gnHFJ1WAxIltY-R7E68BwvYZMA403LAk6Vy7GQAtNY0t_8FrPz34NXnL_6vlRoDZo1Wr--TwJP9aAOSfzU',    'd': 'RaOXAguYxXI2P4A_GPJTGAPSkuuZCjLPsVo2C_36BjA07iPtvZapNr8U4lVhVSVrE3r4fF9zheMoCw45aF7olCGTgCnoftTDXXVXPXQgHhgNCneCT71gZG73LCHOzIEb5rAltbwLmb14seE-XgpjtBDw5HTEAUHceLdUvnrkssQnUXdlegl92-ejbT8Yl2yI9Pr13H1-NioNAVy_Zp9xVz7XUGGTPhrjQ0RfxAcUZ0NOmJiSODQ9zwxjJy8zUWCOTUv0Wqd5m_Rvm7EcHO6AI-kJwiiAszox-XoPSe6uyerAzChUcmIIfFxTv1Ap7INhAqLjk-5iV9sjHGxTousjMQ',    'e': 'AQAB',    'use': 'sig',    'kid': 'AnvSV9YhIkw2c8A1Qw075xc8QVZvq8VFIB5a50-RS7M',    'qi': 'EFijMG9GN5T6bckCejV120NNrPDwQ6-KwbtjyKMJF_XDO0wOdyIUv-UCqd_-SeNSqw0rstr38GLYqR1dNkw1CxO9a4CzxR1KWR47GC6IjGlJMOKU3I24fJklRtklsRM6SqzBdEAP6gnjLdaRykxPlzkWOA8zx_1rGOo6dUBjd1k',    'dp': 'RfUzBAdiclHjp0fHSsMzWfTZts2xPfxkPoJ0GGNWh7seGeGubDj8-FqzfX1fa8S67ceSufGj4EKnLOVP7cwz-lPnwPEI8CirkagO_WMIw3raE9w7qwQyRCvRRxVb2DFY8DwXziYkd3Fw3Ri375hzOH3CV09JO2LT4XYA_EBdeys',    'alg': 'RS256',    'dq': 'PV0LVC95ZAQumcTIlpA3o1zn2f479hboNd8DKxRmTMD3YS_1yqPgGQ2b7pQ9cibFUe5v_WZnwcTS8V-ei2oLcB2MBTM2Ou6wIOFyoINUNo6e8KVhVGfhQ5W9FcRwVZb0fG9-CWV22t3OEl1I7hUL_Wsh-AfhdEi59U6rDJP7_WU',    'n': 'h-d1XOpTd0tUVxM-zvavUcHoDcTIgIZdTvHFScbfVBmjMtpTWP7Y7z8hyACjRrfHt7fDUJtEY8LwLQ4DzQTXHhEafvtLPvYfNfY_ak6uxQN0TWy6HuL09dNqu3HtWy_sDmxfm8EDOwbFzNFdEq60eTZzo2gmlqW1pfwMDvBGW-LcjrxQ7HSQ2DvdV5DJNGkv-dtmdEwLe6NLgOsJBP3R2YgP6krqUQyU7CHu2CNCfBDf6f9DfXQAExCe0dSPNOD5mu9SCIyhhp2EnYEq9jc7Xm9ul_Mr00R0Wlb7L4mS2GSucLeiGa6MuaKPtCsYyZE-j4yYVLnAyw_U7qOy1JQtDw'}",
      "email": "ayush@open-metadata.org",
      "scopes": [
        "token"
      ]
    }
  }
}
```

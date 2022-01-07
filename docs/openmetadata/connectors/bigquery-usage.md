---
description: This guide will help install BigQuery Usage connector and run manually
---

# BigQuery Usage

{% hint style="info" %}
**Prerequisites**

OpenMetadata is built using Java, DropWizard, Jetty, and MySQL.

1. Python 3.7 or above
{% endhint %}

### Install from PyPI

{% tabs %}
{% tab title="Install Using PyPI" %}
```bash
pip install 'openmetadata-ingestion[bigquery-usage]'
```
{% endtab %}
{% endtabs %}

## Run Manually

```bash
metadata ingest -c ./examples/workflows/bigquery_usage.json
```

### Configuration

{% code title="bigquery-creds.json (boilerplate)" %}
```javascript
{
  "type": "service_account",
  "project_id": "project_id",
  "private_key_id": "private_key_id",
  "private_key": "",
  "client_email": "gcpuser@project_id.iam.gserviceaccount.com",
  "client_id": "",
  "auth_uri": "https://accounts.google.com/o/oauth2/auth",
  "token_uri": "https://oauth2.googleapis.com/token",
  "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
  "client_x509_cert_url": ""
}
```
{% endcode %}

{% code title="bigquery_usage.json" %}
```javascript
{
  "source": {
    "type": "bigquery-usage",
    "config": {
      "project_id": "project_id",
      "host_port": "https://bigquery.googleapis.com",
      "username": "gcpuser@project_id.iam.gserviceaccount.com",
      "service_name": "gcp_bigquery",
      "duration": 2,
      "options": {
        "credentials_path": "examples/creds/bigquery-cred.json"
      }
    }
  },
```
{% endcode %}

1. **username** - pass the Bigquery username.
2. **password** - the password for the Bigquery username.
3. **service\_name** - Service Name for this Bigquery cluster. If you added the Bigquery cluster through OpenMetadata UI, make sure the service name matches the same.
4. **schema\_filter\_pattern** - It contains includes, excludes options to choose which pattern of schemas you want to ingest into OpenMetadata.
5. **table\_filter\_pattern** - It contains includes, excludes options to choose which pattern of tables you want to ingest into OpenMetadata.
6. **database -** Database name from where data is to be fetched.

### Publish to OpenMetadata

Below is the configuration to publish Bigquery data into the OpenMetadata service.

Add optionally`query-parser` processor, `table-usage` stage and `metadata-usage` bulk\_sink along with `metadata-server` config

{% code title="bigquery_usage.json" %}
```javascript
{
  "source": {
    "type": "bigquery-usage",
    "config": {
      "project_id": "project_id",
      "host_port": "https://bigquery.googleapis.com",
      "username": "gcpuser@project_id.iam.gserviceaccount.com",
      "service_name": "gcp_bigquery",
      "duration": 2,
      "options": {
        "credentials_path": "examples/creds/bigquery-cred.json"
      }
    }
  },
  "processor": {
    "type": "query-parser",
    "config": {
      "filter": ""
    }
  },
  "stage": {
    "type": "table-usage",
    "config": {
      "filename": "/tmp/bigquery_usage"
    }
  },
  "bulk_sink": {
    "type": "metadata-usage",
    "config": {
      "filename": "/tmp/bigquery_usage"
    }
  },
  "metadata_server": {
    "type": "metadata-server",
    "config": {
      "api_endpoint": "http://localhost:8585/api",
      "auth_provider_type": "no-auth"
    }
  }
}

```
{% endcode %}

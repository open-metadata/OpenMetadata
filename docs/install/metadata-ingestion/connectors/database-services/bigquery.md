---
description: This guide will help install BigQuery connector and run manually
---

# BigQuery

{% hint style="info" %}
**Prerequisites**

OpenMetadata is built using Java, DropWizard, Jetty, and MySQL.

1. Python 3.7 or above
2. OpenMetadata Server up and running
{% endhint %}

### Install from PyPI or Source

{% tabs %}
{% tab title="Install Using PyPI" %}
```bash
pip install 'openmetadata-ingestion[bigquery]'
```
{% endtab %}
{% endtabs %}

## Run Manually

```bash
export GOOGLE_APPLICATION_CREDENTIALS="$PWD/examples/creds/bigquery-cred.json"
metadata ingest -c ./examples/workflows/bigquery.json
```

### Configuration

{% code title="bigquery-creds.json \(boilerplate\)" %}
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

{% code title="bigquery.json" %}
```javascript
{
  "source": {
    "type": "bigquery",
    "config": {
      "project_id": "project_id",
      "host_port": "bigquery.googleapis.com",
      "username": "username",
      "service_name": "gcp_bigquery",
      "options": {
        "credentials_path": "examples/creds/bigquery-cred.json"
      },
      "filter_pattern": {
        "excludes": [
          "[\\w]*cloudaudit.*",
          "[\\w]*logging_googleapis_com.*",
          "[\\w]*clouderrorreporting.*"
        ]
      }
    }
  },
```
{% endcode %}

1. **username** - pass the Bigquery username.
2. **password** - the password for the Bigquery username.
3. **service\_name** - Service Name for this Bigquery cluster. If you added the Bigquery cluster through OpenMetadata UI, make sure the service name matches the same.
4. **filter\_pattern** - It contains includes, excludes options to choose which pattern of datasets you want to ingest into OpenMetadata.
5. **database -** Database name from where data is to be fetched.

### Publish to OpenMetadata

Below is the configuration to publish Bigquery data into the OpenMetadata service.

Add Optionally`pii` processor and `metadata-rest-tables` sink along with `metadata-server` config

{% code title="bigquery.json" %}
```javascript
{
  "source": {
    "type": "bigquery",
    "config": {
      "project_id": "project_id",
      "host_port": "bigquery.googleapis.com",
      "username": "username",
      "service_name": "gcp_bigquery",
      "options": {
        "credentials_path": "examples/creds/bigquery-cred.json"
      },
      "filter_pattern": {
        "excludes": [
          "[\\w]*cloudaudit.*",
          "[\\w]*logging_googleapis_com.*",
          "[\\w]*clouderrorreporting.*"
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
      "auth_provider_type": "no-auth"
    }
  },
  "cron": {
    "minute": "*/5",
    "hour": null,
    "day": null,
    "month": null,
    "day_of_week": null
  }
}

```
{% endcode %}


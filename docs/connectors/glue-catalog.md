---
description: This guide will help install Glue connector and run manually
---

# Glue Catalog

{% hint style="info" %}
**Prerequisites**

OpenMetadata is built using Java, DropWizard, Jetty, and MySQL.

1. Python 3.7 or above
{% endhint %}

### Install from PyPI

{% tabs %}
{% tab title="Install Using PyPI" %}
```bash
pip install 'openmetadata-ingestion[glue]'
```
{% endtab %}
{% endtabs %}

### Run Manually

```bash
metadata ingest -c ./examples/workflows/glue.json
```

### Configuration

{% code title="glue.json" %}
```javascript
{
  "source": {
    "type": "glue",
    "config": {
      "aws_access_key_id": "aws_access_key_id",
      "aws_secret_access_key": "aws_secret_access_key",
      "db_service_name": "local_glue_db",
      "pipeline_service_name": "local_glue_pipeline",
      "region_name": "region_name",
      "endpoint_url": "endpoint_url",
      "service_name": "local_glue"
    }
  },
...
```
{% endcode %}

1. **aws\_access\_key\_id** - Access Key for AWS.
2. **aws\_secret\_access\_key** - Secret Key for AWS.
3. **db\_service\_name** - Service Name for this Glue Database cluster.
4. **pipeline\_service\_name** - Service Name for this Glue Pipeline cluster.
5. **region\_name** - AWS account region.
6. **endpoint\_url** - Service Endpoints from [AWS](https://docs.aws.amazon.com/general/latest/gr/glue.html).

## Publish to OpenMetadata

Below is the configuration to publish Glue data into the OpenMetadata service.

Add `metadata-rest` sink along with `metadata-server` config

{% code title="glue.json" %}
```javascript
{
  "source": {
    "type": "glue",
    "config": {
      "aws_access_key_id": "aws_access_key_id",
      "aws_secret_access_key": "aws_secret_access_key",
      "db_service_name": "local_glue_db",
      "pipeline_service_name": "local_glue_pipeline",
      "region_name": "region_name",
      "endpoint_url": "endpoint_url",
      "service_name": "local_glue"
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
      "auth_provider_type": "no-auth"
    }
  }
}
```
{% endcode %}

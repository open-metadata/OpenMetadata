---
description: This guide will help install Hive connector and run manually
---

# Hive

{% hint style="info" %}
**Prerequisites**

1. Python 3.7 or above
2. Library: **libsasl2-dev** Hive connector uses `pyhive` to connect and fetch metadata. Pyhive has python sasl dependency and which requires libsasl2-dev to be installed. In some cases, you may need to set LD\_LIBRARY\_PATH to point to where libsasl2-dev is installed. Please check on how to install libsasl2 for your Linux Distro.
{% endhint %}

### Install from PyPI

{% tabs %}
{% tab title="Install Using PyPI" %}
```bash
#install hive-sasl library
sudo apt-get install libsasl2-dev
pip install 'openmetadata-ingestion[hive]'
```
{% endtab %}
{% endtabs %}

### Configuration

{% code title="hive.json" %}
```javascript
{
  "source": {
    "type": "hive",
    "config": {
      "service_name": "local_hive",
      "host_port": "localhost:10000",
      "data_profiler_enabled": "true",
      "data_profiler_offset": "0",
      "data_profiler_limit": "50000"
    }
  },
  ...
```
{% endcode %}

1. **service\_name** - Service Name for this Hive cluster. If you added the Hive cluster through OpenMetadata UI, make sure the service name matches the same.
2. **filter\_pattern** - It contains includes, excludes options to choose which pattern of datasets you want to ingest into OpenMetadata
3. **data\_profiler\_enabled** - Enable data-profiling (Optional). It will provide you the newly ingested data.
4. **data\_profiler\_offset** - Specify offset.
5. **data\_profiler\_limit** - Specify limit.

## Publish to OpenMetadata

Below is the configuration to publish Hive data into the OpenMetadata service.

Add optionally `pii` processor and `metadata-rest` sink along with `metadata-server` config

{% code title="hive.json" %}
```javascript
{
  "source": {
    "type": "hive",
    "config": {
      "service_name": "local_hive",
      "host_port": "localhost:10000",
      "data_profiler_enabled": "true",
      "data_profiler_offset": "0",
      "data_profiler_limit": "50000"
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

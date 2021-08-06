---
description: This guide will help install MsSQL connector and run manually
---

# MSSQL

## MSSQL

{% hint style="info" %}
**Prerequisites**

OpenMetadata is built using Java, DropWizard, Jetty, and MySQL.

1. Python 3.7 or above
2. Create and activate python env

   ```bash
   python3 -m venv env
   source env/bin/activate
   ```
{% endhint %}

\*\*\*\*

## Install

```bash
pip install '.[mssql]'
```

## Run Manually

```bash
metadata ingest -c ./pipelines/mssql.json
```

## Configuration

{% code title="mssql.json" %}
```javascript
{
  "source": {
    "type": "mssql",
    "config": {
      "host_port": "localhost:1433",
      "service_name": "local_mssql",
      "service_type": "MSSQL",
      "database":"catalog_test",
      "username": "sa",
      "password": "test!Password",
      "include_pattern": {
        "allow": ["catalog_test.*"]
      }
    }
  },
 ...
```
{% endcode %}

1. **username** - pass the mssql username.
2. **password** - password for the mssql username.
3. **service\_name** - Service Name for this mssql cluster. If you added mssql cluster through OpenMetadata UI, make sure the service name matches the same.
4. **host\_port** - Hostname and Port number where the service is being initialised.
5. **table\_pattern** - It contains allow, deny options to choose which pattern of datasets you want to ingest into OpenMetadata.
6. **database** - \_\*\*\_Database name from where data is to be fetched from.


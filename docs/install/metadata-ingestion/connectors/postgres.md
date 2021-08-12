---
description: This guide will help install Postgres connector and run manually
---

# Postgres

## Postgres

{% hint style="info" %}
**Prerequisites**

OpenMetadata is built using Java, DropWizard, Jetty, and MySQL.

1. Python 3.7 or above
{% endhint %}

### Install from PyPI or Source

{% tabs %}
{% tab title="Install Using PyPI" %}
```bash
pip install 'openmetadata-ingestion[postgres]'
```
{% endtab %}
{% tab title="Build from source " %}
```bash
# checkout OpenMetadata
git clone https://github.com/open-metadata/OpenMetadata.git
cd OpenMetadata/ingestion
python3 -m venv env
source env/bin/activate
pip install '.[postgres]'
```
{% endtab %}
{% endtabs %}



### Run Manually

```bash
metadata ingest -c ./pipelines/postgres.json
```

### Configuration

{% code title="postgres.json" %}
```javascript
{
  "source": {
    "type": "postgres",
    "config": {
      "username": "openmetadata_user",
      "password": "openmetadata_password",
      "host_port": "localhost:5432",
      "database": "pagila",
      "service_name": "local_postgres",
      "service_type": "POSTGRES",
      "include_pattern": {
        "deny": ["pg_openmetadata.*[a-zA-Z0-9]*","information_schema.*[a-zA-Z0-9]*"]      }
    }
  },
 ...
```
{% endcode %}

1. **username** - pass the Postgres username.
2. **password** - password for the Postgres username.
3. **service\_name** - Service Name for this Postgres cluster. If you added the Postgres cluster through OpenMetadata UI, make sure the service name matches the same.
4. **table\_pattern** - It contains allow, deny options to choose which pattern of datasets you want to ingest into OpenMetadata.
5. **database -** Database name from where data is to be fetched.


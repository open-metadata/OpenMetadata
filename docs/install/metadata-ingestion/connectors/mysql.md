---
description: This guide will help install MySQL connector and run manually
---

# MySQL

## MySQL

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

### Install

```bash
pip install '.[mysql]'
```

### Run Manually

```bash
metadata ingest -c ./pipelines/mysql.json
```

### Configuration

{% code title="mysql.json" %}
```javascript
{
  "source": {
    "type": "mysql",
    "config": {
      "username": "openmetadata_user",
      "password": "openmetadata_password",
      "service_name": "local_mysql",
      "include_pattern": {
        "deny": ["mysql.*", "information_schema.*"]
      }
    }
  },
 ...
```
{% endcode %}

1. **username** - pass the MySQL username. We recommend creating a user with read-only permissions to all the databases in your MySQL installation
2. **password** - password for the username
3. **service\_name** - Service Name for this MySQL cluster. If you added MySQL cluster through OpenMetadata UI, make sure the service name matches the same.
4. **table\_pattern** - It contains allow, deny options to choose which pattern of datasets you want to ingest into OpenMetadata


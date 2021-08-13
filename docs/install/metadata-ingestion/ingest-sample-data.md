---
description: This guide will help you to ingest sample data
---

# Ingest Sample Data

## Sample Data

{% hint style="info" %}
**Prerequisites**

OpenMetadata is built using Java, DropWizard, Jetty, and MySQL.

1. Python 3.7 or above
2. Create and activate python env

   ```bash

   ```
{% endhint %}

### Install from PyPI or Source

{% tabs %}
{% tab title="Install Using PyPI" %}
```bash
pip install 'openmetadata-ingestion[sample-tables, elasticsearch]'
```
{% endtab %}

{% tab title="Build from source " %}
```bash
# checkout OpenMetadata
git clone https://github.com/open-metadata/OpenMetadata.git
cd OpenMetadata/ingestion
python3 -m venv env
source env/bin/activate
pip install '.[sample-tables, elasticsearch]'
```
{% endtab %}
{% endtabs %}

### Ingest sample tables and users

```bash
metadata ingest -c ./pipelines/sample_tables.json
metadata ingest -c ./pipelines/sample_users.json
```

### Index Sample Data into ElasticSearch

Start Elastic Search Docker:

```bash
docker run -p 9200:9200 -p 9300:9300 -e "discovery.type=single-node" docker.elastic.co/elasticsearch/elasticsearch:7.10.2
```

Index sample data in ElasticSearch:

```bash
metadata ingest -c ./pipelines/metadata_to_es.json
```


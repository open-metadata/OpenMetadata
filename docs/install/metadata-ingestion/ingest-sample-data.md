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
   python3 -m venv env
   source env/bin/activate
   ```
{% endhint %}

### Build from source or PyPI

{% tabs %}
{% tab title="Build from source " %}
```bash
# checkout OpenMetadata
git clone https://github.com/open-metadata/OpenMetadata.git
cd OpenMetadata/ingestion
```
{% endtab %}

{% tab title="Install Using PyPI" %}

{% endtab %}
{% endtabs %}

### Ingest sample tables and users

```bash
pip install '.[sample-tables]'
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
pip install '.[elasticsearch]'
metadata ingest -c ./pipelines/metadata_to_es.json
```


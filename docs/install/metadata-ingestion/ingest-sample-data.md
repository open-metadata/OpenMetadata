---
description: This guide will help you to ingest sample data
---

# Ingest Sample Data

## Sample Data

We have created some sample data to take OpenMetadata for a spin without integrating with real data sources. The goal of sample data is to give a taste of what OpenMetadata can do with your real data.

{% hint style="info" %}
**Prerequisites**

OpenMetadata is built using Java, DropWizard, Jetty, and MySQL.

1. Python 3.7 or above
{% endhint %}

### Install from PyPI

{% tabs %}
{% tab title="Install Using PyPI" %}
```bash
Download the latest OpenMetadata release from here 
https://github.com/open-metadata/OpenMetadata/releases
tar zxvf openmetadata-0.4.0.tar.gz
cd openmetadata-0.4.0/ingestion
python3 -m venv env 
python3 -m pip install 'openmetadata-ingestion[sample-data, elasticsearch]'
```
{% endtab %}
{% endtabs %}

### Ingest using Sample Pipelines consisting of

Sample Data, Tables, Usage, Users, Topics, and Dashboards.

```bash
metadata ingest -c ./pipelines/sample_data.json
metadata ingest -c ./pipelines/sample_usage.json
metadata ingest -c ./pipelines/sample_users.json
```

### Index Sample Data into ElasticSearch

Start Elastic Search Docker:

{% hint style="warning" %}
The below command starts Elasticsearch docker that stores the indexed data in memory. If you stop the container it will lose any data on restart. Please re-run the metadata\_to\_es workflow again to index the data upon starting the container.
{% endhint %}

```bash
docker run -p 9200:9200 -p 9300:9300 -e "discovery.type=single-node" docker.elastic.co/elasticsearch/elasticsearch:7.10.2
```

Index sample data in ElasticSearch:

```bash
cd OpenMetadata/ingestion
metadata ingest -c ./pipelines/metadata_to_es.json
```


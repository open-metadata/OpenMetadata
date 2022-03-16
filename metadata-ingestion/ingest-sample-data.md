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

### Run OpenMetadata Server

Please refer to the [Run OpenMetadata ](../docs/overview/try-openmetadata/run-openmetadata/#install-on-your-local-machine)section to run the server manually or using [Docker](../docs/overview/try-openmetadata/run-openmetadata/#run-docker).

### Install from PyPI

{% tabs %}
{% tab title="Install Using PyPI" %}
```bash
python3 -m pip install 'openmetadata-ingestion[sample-data, elasticsearch]'
```
{% endtab %}
{% endtabs %}

### Ingest using Sample Pipelines consisting of

Sample Data, Tables, Usage, Users, Topics, and Dashboards.

```bash
#Make sure the OpenMetadata Server is up and running
cd openmetadata-0.6.0/ingestion
metadata ingest -c ./pipelines/sample_data.json
metadata ingest -c ./pipelines/sample_usage.json
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
#Make sure the OpenMetadata Server is up and running
cd openmetadata-0.6.0/ingestion
metadata ingest -c ./pipelines/metadata_to_es.json
```

---
description: This guide will help install ElasticSearch connector and run manually
---

# ElasticSearch

## ElasticSearch

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

## Install

```bash
docker run -p 9200:9200 -p 9300:9300 -e "discovery.type=single-node" docker.elastic.co/elasticsearch/elasticsearch:7.10.2
pip install '.[elasticsearch]
```

## Run Manually

```bash
metadata ingest -c ./pipelines/metadata_to_es.json
```

## Configuration


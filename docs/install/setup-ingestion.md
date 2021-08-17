---
description: This guide will help you setup the Ingestion framework and connectors
---

# Setup Ingestion

Ingestion is a data ingestion library, which is inspired by [Apache Gobblin](https://gobblin.apache.org/). It could be used in an orchestration framework\(e.g. Apache Airflow\) to build data for OpenMetadata.

{% hint style="info" %}
**Prerequisites**

* Python &gt;= 3.8.x
{% endhint %}

## Install on your Dev

### Install Dependencies

```text
cd ingestion
python3 -m venv env
source env/bin/activate
./ingestion_dependency.sh
```

You only need to run above command once.

### Known Issues

#### Fix MySQL lib

```text
 sudo ln -s /usr/local/mysql/lib/libmysqlclient.21.dylib /usr/local/lib/libmysqlclient.21.dylib
```

### Run Ingestion Connectors

#### Generate Redshift Data

```text
source env/bin/activate
metadata ingest -c ./pipelines/redshift.json
```

#### Generate Redshift Usage Data

```text
 source env/bin/activate
 metadata ingest -c ./pipelines/redshift_usage.json
```

#### Generate Sample Tables

```text
 source env/bin/activate
 metadata ingest -c ./pipelines/sample_tables.json
```

#### Generate Sample Users

```text
 source env/bin/activate
 metadata ingest -c ./pipelines/sample_users.json
```

#### Ingest MySQL data to Metadata APIs

```text
 source env/bin/activate
 metadata ingest -c ./pipelines/mysql.json
```

#### Ingest Bigquery data to Metadata APIs

```text
 source env/bin/activate
 export GOOGLE_APPLICATION_CREDENTIALS="$PWD/examples/creds/bigquery-cred.json"
 metadata ingest -c ./pipelines/bigquery.json
```

#### Index Metadata into ElasticSearch

#### Run ElasticSearch docker

```text
 docker run -p 9200:9200 -p 9300:9300 -e "discovery.type=single-node" docker.elastic.co/elasticsearch/elasticsearch:7.10.2
```

#### Run ingestion connector

```text
 source env/bin/activate
 metadata ingest -c ./pipelines/metadata_to_es.json
```

## Install using Docker

### Run Ingestion docker

The OpenMetadata should be up and running before you run the docker on the system.

```text
docker build -t ingestion .
docker run --network="host" -t ingestion
```

### Run ElasticSearch docker

Run the command to start ElasticSearch docker

```text
docker run -p 9200:9200 -p 9300:9300 -e "discovery.type=single-node" docker.elastic.co/elasticsearch/elasticsearch:7.10.2
```

## Test - Integration

Run the command to start integration tests

```text
source env/bin/activate
cd tests/integration/
pytest -c /dev/null {folder-name} 
#pytest -c /dev/null mysql
```

## Design

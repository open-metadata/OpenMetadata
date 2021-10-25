---
This guide will help you setup the Ingestion framework and connectors
---

![Python version 3.8+](https://img.shields.io/badge/python-3.8%2B-blue)

OpenMetadata Ingesiton is a simple framework to build connectors and ingest metadata of various systems through OpenMetadata APIs. It could be used in an orchestration framework(e.g. Apache Airflow) to ingest metadata.
**Prerequisites**

- Python &gt;= 3.8.x

### Install From PyPI

```text
python3 -m pip install --upgrade pip wheel setuptools openmetadata-ingestion
python3 -m spacy download en_core_web_sm
```

### Install Ingestion Connector Dependencies

Click here to go to [Ingestion Connector's Documentation](https://docs.open-metadata.org/install/metadata-ingestion)

#### Generate Redshift Data

```text
metadata ingest -c ./pipelines/redshift.json
```

#### Generate Redshift Usage Data

```text
metadata ingest -c ./pipelines/redshift_usage.json
```

#### Generate Sample Tables

```text
metadata ingest -c ./pipelines/sample_tables.json
```

#### Generate Sample Users

```text
metadata ingest -c ./pipelines/sample_users.json
```

#### Ingest MySQL data to Metadata APIs

```text
metadata ingest -c ./pipelines/mysql.json
```

#### Ingest Bigquery data to Metadata APIs

```text
export GOOGLE_APPLICATION_CREDENTIALS="$PWD/pipelines/creds/bigquery-cred.json"
metadata ingest -c ./pipelines/bigquery.json
```

#### Index Metadata into ElasticSearch

#### Run ElasticSearch docker

```text
docker run -p 9200:9200 -p 9300:9300 -e "discovery.type=single-node" docker.elastic.co/elasticsearch/elasticsearch:7.10.2
```

#### Run ingestion connector

```text
metadata ingest -c ./pipelines/metadata_to_es.json
```

## Generated sources

We are using `datamodel-codegen` to get some `pydantic` classes inside the `generated` module from the JSON Schemas defining the API and Entities.

This tool bases the class name on the `title` of the JSON Schema (vs. Java POJO, which uses the file name). Note that this convention is important for us, as having a standardized approach in creating the titles helps us create generic code capable of tackling multiple Type Variables.

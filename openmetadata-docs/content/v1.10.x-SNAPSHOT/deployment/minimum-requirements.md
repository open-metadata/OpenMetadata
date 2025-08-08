---
title: Minimum Requirements | Official Documentation
description: Review system requirements including OS, CPU, memory, and dependencies to ensure a successful and stable deployment.
slug: /deployment/minimum-requirements
collate: false
---

# Minimum Hardware Requirements

OpenMetadata requires either MySQL or PostgreSQL as Backend Database and ElasticSearch or OpenSearch as Search Engine. 

Please refer to the [architecture section](/developers/architecture) for more details.

We recommend the following for the Production Grade OpenMetadata Installation -

## MySQL or PostgreSQL as Database

Our minimum specs recommendation for MySQL / PostgreSQL as database deployment is 
- 4 vCPUs
- 16 GiB Memory
- 100 GiB Storage

These settings apply as well when using managed instances, such as AWS RDS or GCP CloudSQL or Azure Flexible Servers.

### Software Requirements

OpenMetadata currently supports -

- MySQL version 8.0.0 or higher
- PostgreSQL version 12.0 or higher

## ElasticSearch or OpenSearch as Search Instance

Our minimum specs recommendation for ElasticSearch / OpenSearch deployment is
- 2 vCPUs
- 8 GiB Memory
- 100 GiB Storage (per node)
- Master / Worker Nodes with atleast 1 Master and 2 Worker Nodes

### Software Requirements

OpenMetadata currently supports -

- ElasticSearch version 8.X till 8.11.4
- OpenSearch version 2.19

These settings apply as well when using managed instances, such as AWS OpenSearch Service or Elastic Cloud on GCP, AWS, Azure.

## Apache Airflow as Ingestion Instance

Our minimum specs recommendation for Apache Airflow is
- 4 vCPU
- 16 GiB Memory
- 100 GiB Storage for Airflow Dags and Logs

### Software Requirements

OpenMetadata currently supports -
- Airflow version 2.10.5

Learn more about how to deploy and manage the ingestion workflows [here](/deployment/ingestion).

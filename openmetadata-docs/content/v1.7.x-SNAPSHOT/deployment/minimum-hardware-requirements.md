---
title: Minimum Hardware Requirements
slug: /deployment/minimum-hardware-requirements
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

## ElasticSearch or OpenSearch as Search Instance

Our minimum specs recommendation for ElasticSearch / OpenSearch deployment is
- 2 vCPUs
- 8 GiB Memory
- 100 GiB Storage (per node)
- Master / Worker Nodes with atleast 1 Master and 2 Worker Nodes

These settings apply as well when using managed instances, such as AWS OpenSearch Service or Elastic Cloud on GCP, AWS, Azure.

---
title: Docker Deployment
slug: /deployment/docker
---

# Docker Deployment

Deploying OpenMetadata in Docker is a great start! Take a look at our
[Quickstart](/quick-start/local-deployment) guide to learn how to get OpenMetadata
up and running locally in less than 7 minutes!

If those steps are already done, you might want to bind Docker Volumes
for data persistence. Learn how to do so [here](/deployment/docker/volumes).

To test out your security integration, check out how to 
[Enable Security](/deployment/docker/security).

## Changing ports

<Note>

To make changes to the `docker-compose.yaml` file you will need to download it from the release page [here](https://github.com/open-metadata/OpenMetadata/releases). The latest version is at the top of the page
</Note>

This docker deployment is powered by `docker compose`, and uses the `docker-compose.yml` files shipped during 
each release [example](https://github.com/open-metadata/OpenMetadata/releases/tag/0.11.4-release).

As with the [Docker Volumes](/deployment/docker/volumes), you might want to tune a bit the compose file to modify
the default ports.

We are shipping the OpenMetadata server and UI at `8585`, and the ingestion container (Airflow) at `8080`. You can
take a look at the official Docker [docs](https://docs.docker.com/compose/compose-file/#ports). As an example, You could
update the ports to serve Airflow at `1234` with:

```yaml
ports:
  - "1234:8080"
```

## Run OpenMetadata with AWS Services

If you are running OpenMetadata in AWS, it is recommended to use [Amazon RDS](https://docs.aws.amazon.com/rds/index.html) and [Amazon OpenSearch Service](https://docs.aws.amazon.com/opensearch-service/?id=docs_gateway).

We support 

- Amazon RDS (MySQL) engine version upto 8.0.29
- Amazon OpenSearch (ElasticSearch) engine version upto 7.1 or Amazon OpenSearch engine version upto 1.3
- Amazon RDS (PostgreSQL) engine version upto 14.2-R1

For Production Systems, we recommend Amazon RDS to be in Multiple Availibility Zones. For Amazon OpenSearch (or ElasticSearch) Service, we recommend Multiple Availibility Zones with minimum 3 Master Nodes.

Once you have the RDS and OpenSearch Services Setup, you can update the environment variables below for OpenMetadata Docker Compose backed systems to connect with Database and ElasticSearch.

```
# MySQL Environment Variables
DB_DRIVER_CLASS='com.mysql.cj.jdbc.Driver'
DB_SCHEME='mysql'
DB_USE_SSL='true'
MYSQL_USER_PASSWORD='<YOUR_RDS_USER_PASSWORD>'
DB_SCHEME='mysql'
MYSQL_HOST='<YOUR_RDS_HOST_NAME>'
MYSQL_USER='<YOUR_RDS_USER_NAME>'
MYSQL_DATABASE='<YOUR_RDS_DATABASE_NAME>'
MYSQL_PORT='<YOUR_RDS_PORT>'
# ElasticSearch Environment Variables
ELASTICSEARCH_SOCKET_TIMEOUT_SECS='60'
ELASTICSEARCH_USER='<ES_USERNAME>'
ELASTICSEARCH_CONNECTION_TIMEOUT_SECS='5'
ELASTICSEARCH_PORT='443'
ELASTICSEARCH_SCHEME='https'
ELASTICSEARCH_BATCH_SIZE='10'
ELASTICSEARCH_HOST='vpc-<random_characters>.<aws_region>.es.amazonaws.com'
ELASTICSEARCH_PASSWORD='<ES_PASSWORD>'
```

Replace the environment variables values with the RDS and OpenSearch Service ones and then provide this environment variable file as part of docker compose command.

```
docker compose --env-file ./config/.env.prod up -d openmetadata_server
```

# Production Deployment

If you are planning on going to PROD, we also recommend taking a look at the following
deployment strategies:

<InlineCalloutContainer>
  <InlineCallout
    color="violet-70"
    icon="storage"
    bold="Deploy on Bare Metal"
    href="/deployment/bare-metal"
  >
    Deploy OpenMetadata directly using the binaries.
  </InlineCallout>
  <InlineCallout
    color="violet-70"
    icon="fit_screen"
    bold="Deploy on Kubernetes"
    href="/deployment/kubernetes"
  >
    Deploy and scale with Kubernetes
  </InlineCallout>
</InlineCalloutContainer>

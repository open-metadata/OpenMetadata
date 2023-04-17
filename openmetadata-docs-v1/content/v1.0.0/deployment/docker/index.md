---
title: Docker Deployment
slug: /deployment/docker
---

# Docker Deployment
Deploying OpenMetadata in Docker is a great start! 
Before starting with the deployment make sure you follow all the below Prerequisites.
## Prerequisites
### Docker (version 20.10.0 or greater)
[Docker](https://docs.docker.com/get-started/overview/) is an open-source platform for developing, shipping, and running applications. It enables you to separate your applications from your infrastructure, so you can deliver software quickly using OS-level virtualization. It helps deliver software in packages called Containers.

To check what version of Docker you have, please use the following command.
```commandline
docker --version
```

If you need to install Docker, please visit [Get Docker](https://docs.docker.com/get-docker/).
### Docker Compose (version v2.2.3 or greater)
The Docker compose package enables you to define and run multi-container Docker applications. The compose command integrates compose functions into the Docker platform, making them available from the Docker command-line interface ( CLI). The Python packages you will install in the procedure below use compose to deploy OpenMetadata.

- **MacOS X**: Docker on MacOS X ships with compose already available in the Docker CLI.
- **Linux**: To install compose on Linux systems, please visit the Docker CLI command documentation and follow the
  instructions.

To verify that the docker compose command is installed and accessible on your system, run the following command.

```commandline
docker compose version
```

Upon running this command you should see output similar to the following.

```commandline
Docker Compose version v2.2.3
```

### Install Docker Compose Version 2 on Linux

Follow the instructions [here](https://docs.docker.com/compose/cli-command/#install-on-linux) to install docker compose version 2

1. Run the following command to download the current stable release of Docker Compose
    ```
    DOCKER_CONFIG=${DOCKER_CONFIG:-$HOME/.docker}

    mkdir -p $DOCKER_CONFIG/cli-plugins 
    curl -SL https://github.com/docker/compose/releases/download/v2.2.3/docker-compose-linux-x86_64 -o
    $DOCKER_CONFIG/cli-plugins/docker-compose
    ```
    
   This command installs Compose V2 for the active user under $HOME directory. To install Docker Compose for all users
   on your system, replace` ~/.docker/cli-plugins` with `/usr/local/lib/docker/cli-plugins`.

2. Apply executable permissions to the binary
    ```
    chmod +x $DOCKER_CONFIG/cli-plugins/docker-compose 
    ```
3. Test your installation
    ```
    docker compose version
    > Docker Compose version v2.2.3
    ```

## Steps for Deploying OpenMetadata using Docker 

- First download the docker-compose.yml file from the release page [here](https://github.com/open-metadata/OpenMetadata/releases). The latest version is at the top of the page
  - Deploying with MySQL:  Download `docker-compose.yml` file from the above link.
  - Deploying with PostgreSQL: Download `docker-compose-postgres.yml` file from the above link.

- Create the directory for host volumes 
```commandline
mkdir -p $PWD/docker-volume/db-data
```

- Run the below command to deploy the OpenMetadata

```commandline
docker compose up --build -d 
```
This command will pull the docker images of Openmetadata for MySQL, OpenMetadat-Server, OpenMetadata-Ingestion and Elasticsearch.

Upon running this command you should see output similar to the following.
```commandline
+] Running 7/8
 ⠿ Network metadata_app_net                        Created                                                                                               0.2s
 ⠿ Volume "metadata_ingestion-volume-dag-airflow"  Created                                                                                               0.0s
 ⠿ Volume "metadata_ingestion-volume-dags"         Created                                                                                               0.0s
 ⠿ Volume "metadata_ingestion-volume-tmp"          Created                                                                                               0.0s
 ⠿ Container openmetadata_elasticsearch            Started                                                                                               5.9s
 ⠿ Container openmetadata_mysql                    Started                                                                                              38.3s
 ⠿ Container openmetadata_server                   Started                                                                                             124.8s
 ⠿ Container openmetadata_ingestion                Started                                                                                               0.3s
```

You can validate that all containers are up by running with command `docker ps`.

```commandline
❯ docker ps
CONTAINER ID   IMAGE                                                  COMMAND                  CREATED          STATUS                    PORTS                                                            NAMES
470cc8149826   openmetadata/server:0.13.2                            "./openmetadata-star…"   45 seconds ago   Up 43 seconds             3306/tcp, 9200/tcp, 9300/tcp, 0.0.0.0:8585-8586->8585-8586/tcp   openmetadata_server
63578aacbff5   openmetadata/ingestion:0.13.2                          "./ingestion_depende…"   45 seconds ago   Up 43 seconds             0.0.0.0:8080->8080/tcp                                           openmetadata_ingestion
9f5ee8334f4b   docker.elastic.co/elasticsearch/elasticsearch:7.10.2   "/tini -- /usr/local…"   45 seconds ago   Up 44 seconds             0.0.0.0:9200->9200/tcp, 0.0.0.0:9300->9300/tcp                   openmetadata_elasticsearch
08947ab3424b   openmetadata/db:0.13.2                                 "/entrypoint.sh mysq…"   45 seconds ago   Up 44 seconds (healthy)   3306/tcp, 33060-33061/tcp                                        openmetadata_mysql
```

In a few seconds, you should be able to access the OpenMetadata UI at [http://localhost:8585](http://localhost:8585)
## Port Mapping / Port Forwarding 

### For OpenMetadata-Server 
We are shipping the OpenMetadata server and UI at `8585`, and the ingestion container (Airflow) at `8080`. You can
change the port number's according to your requirement. As an example, You could
update the ports to serve OpenMetadata Server and UI  at port `80`

To achieve this 
- You just have to update the ports mapping of the openmetadata-server in the `docker-compose.yml` file under `openmetadata-server` docker service section.

```yaml
ports:
  - "80:8585"
```
- Once the port is updated if there are any containers running remove them first using `docker compose down` command and then  recreate the containers once again by below command 
```commandline
docker compose up --build -d 
```
### For Ingestion-Server
We are shipping the OpenMetadata server and UI at `8585`, and the ingestion container (Airflow) at `8080`. You can
change the port number's according to your requirement. As an example, You could
update the ports to serve Ingestion  Server and UI  at port `80`

To achieve this 
- You just have to update the ports mapping of the openmetadata-server in the `docker-compose.yml` file under `ingestion-server` docker service section.

```yaml
ports:
  - "80:8080"
```
- Also update the Airflow environment variable in openmetadata-server section 
 ```commandline
 AIRFLOW_HOST: '<AIRFLOW_HOST:-<AIRFLOW_HOST:80>'
 ```

- Once the port is updated if there are any containers running remove them first using `docker compose down` command and then  recreate the containers once again by below command 
```commandline
docker compose up --build -d 
```
## PROD Deployment of OpenMetadata Using Docker
If you are planning on going to PROD, we recommend to validate below points:
- MySQL and OpenSearch (ElasticSearch) are available.
- OpenMetadata-Server require the minimum configuration of 2vCPU and 6Memory (GiB)
- OpenMetadata-Ingestion require the minimum configuration of 2vCPU and 8Memory (GiB)
- We also recommend to bind Docker Volumes for data persistence. Minimum disk space required would be 128 Gib. Learn how to do so [here](/deployment/docker/volumes).
### Steps for Deploying Ingestion 
- Download the docker-compose.yml file from the release page [here](https://github.com/open-metadata/OpenMetadata/releases).
- Update the environment variables below for OpenMetadata-Ingestion Docker Compose backed systems to connect with Database. 
```
# MySQL Environment Variables for ingestion service
DB_HOST: '<DB_HOST_NAME>'
DB_PORT: '<DB_PORT>'
AIRFLOW_DB: '<AIRFLOW_DATABASE>'
AIRFLOW_DB_SCHEME: '<AIRFLOW_DB_SCHEME>'
DB_USER: '<AIRFLOW_DB_USER>'
DB_PASSWORD: '<AIRFLOW_DB_PASSWORD>'
```
Once the environment variables values with the RDS are updated then provide this environment variable file as part of docker compose command.

```
docker compose --env-file ./config/.env.prod up -d openmetadata_ingestion
```
### Steps for Deploying OpenMetadata-Server
- Download the docker-compose.yml file from the release page [here](https://github.com/open-metadata/OpenMetadata/releases).
- Update the environment variables below for OpenMetadata-Ingestion Docker Compose backed systems to connect with Database and ElasticSearch and Ingestion.
```
# MySQL Environment Variables
DB_DRIVER_CLASS='com.mysql.cj.jdbc.Driver'
DB_SCHEME='mysql'
DB_USE_SSL='true'
DB_USER_PASSWORD='<OPENMETADATA_DB_USER_PASSWORD>'
DB_HOST='<DB_HOST>'
DB_USER='<OPENMETADATA__USER_NAME>'
OM_DATABASE='<OPENMETADATA_DATABASE_NAME>'
DB_PORT='<DB_PORT>'
# ElasticSearch Environment Variables
ELASTICSEARCH_SOCKET_TIMEOUT_SECS='60'
ELASTICSEARCH_USER='<ELASTICSEARCH_USERNAME>'
ELASTICSEARCH_CONNECTION_TIMEOUT_SECS='5'
ELASTICSEARCH_PORT='443'
ELASTICSEARCH_SCHEME='https'
ELASTICSEARCH_BATCH_SIZE='10'
ELASTICSEARCH_HOST='<ELASTICSEARCH_HOST_URL>'
ELASTICSEARCH_PASSWORD='<ELASTICSEARCH_PASSWORD>'
# Ingestion or Airflow Environment Variables
AIRFLOW_HOST: '<AIRFLOW_HOST_URL>'
SERVER_HOST_API_URL: '<OPENMETADATA_HOST_URL_WITH_SCHEME/api>'
```
Once the environment variables values with the RDS are updated then provide this environment variable file as part of docker compose command.

```
docker compose --env-file ./config/.env.prod up -d openmetadata_server
```
## Run OpenMetadata with AWS Services

If you are running OpenMetadata in AWS, it is recommended to use [Amazon RDS](https://docs.aws.amazon.com/rds/index.html) and [Amazon OpenSearch Service](https://docs.aws.amazon.com/opensearch-service/?id=docs_gateway).

We support 

- Amazon RDS (MySQL) engine version upto 8.0.29
- Amazon OpenSearch (ElasticSearch) engine version upto 7.10 or Amazon OpenSearch engine version upto 1.3
- Amazon RDS (PostgreSQL) engine version upto 14.2-R1

For Production Systems, we recommend Amazon RDS to be in Multiple Availibility Zones. For Amazon OpenSearch (or ElasticSearch) Service, we recommend Multiple Availibility Zones with minimum 3 Master Nodes.

Once you have the RDS and OpenSearch Services Setup, you can update the environment variables below for OpenMetadata Docker Compose backed systems to connect with Database and ElasticSearch.

```
# MySQL Environment Variables
DB_DRIVER_CLASS='com.mysql.cj.jdbc.Driver'
DB_SCHEME='mysql'
DB_USE_SSL='true'
DB_USER_PASSWORD='<DATABASE_USER_PASSWORD>'
DB_HOST='<DATABASE_HOST_NAME>'
DB_USER='<DATABASE_USER_NAME>'
OM_DATABASE='<DATABASE_NAME>'
DB_PORT='<DATABASE_PORT>'
# ElasticSearch Environment Variables
ELASTICSEARCH_SOCKET_TIMEOUT_SECS='60'
ELASTICSEARCH_USER='<ELASTICSEARCH_USERNAME>'
ELASTICSEARCH_CONNECTION_TIMEOUT_SECS='5'
ELASTICSEARCH_PORT='443'
ELASTICSEARCH_SCHEME='https'
ELASTICSEARCH_BATCH_SIZE='10'
ELASTICSEARCH_HOST='<ELASTICSEARCH_HOST_URL>'
ELASTICSEARCH_PASSWORD='<ELASTICSEARCH_PASSWORD>'
```

Replace the environment variables values with the RDS and OpenSearch Service ones and then provide this environment variable file as part of docker compose command.

```
docker compose --env-file ./config/.env.prod up -d openmetadata_server
```

# Production Deployment

If you are planning on going to PROD, we also recommend taking a look at the following
other deployment  strategies:

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

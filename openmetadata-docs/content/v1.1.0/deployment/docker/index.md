---
title: Docker Deployment
slug: /deployment/docker
---

# Docker Deployment

This guide will help you setup the OpenMetadata Application using Docker Deployment.
Before starting with the deployment make sure you follow all the below Prerequisites.

## Docker Deployment Architecture
{% image src="/images/v1.1.0/deployment/docker/om_docker_architecture.png" alt="Docker Deployment Architecture" /%}

## Prerequisites

### Configure OpenMetadata to use External Database and Search Engine

For Production Deployment using Docker, we recommend to bring your own Databases and ElasticSearch Engine.

### Configure External Ingestion Service

OpenMetadata requires connectors to be scheduled to periodically fetch the metadata or you can use the OpenMetadata APIs to push the metadata as well
1. OpenMetadata Ingestion Framework is flexible to run on any orchestrator. However we built an ability to deploy and manage connectors as pipelines from the UI. This requires the Airflow container we ship. However, it is recommended to 
2. If your team prefers to run on any other orchestrator such as prefect, dagster or even github workflows. Please refer to our recent webinar on [How Ingestion Framework works](https://www.youtube.com/watch?v=i7DhG_gZMmE&list=PLa1l-WDhLreslIS_96s_DT_KdcDyU_Itv&index=10)

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

#### Install Docker Compose Version 2 on Linux

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

## Minimum Sizing Requirements

We recommend you to allocate openmetadata-server with minimum of 2vCPUs and 6 GiB Memory.

For External Services that openmetadata depends on -
- For the database, minimum 2 vCPUs and 2 GiB RAM (per instance) with 30 GiB of Storage Volume Attached (dynamic expansion up to 100 GiB)
- For Elasticsearch, minimum 2 vCPUs and 2 GiB RAM (per instance) with 30 GiB of Storage volume attached

## Steps for Deploying OpenMetadata using Docker 

### 1. Create a directory for OpenMetadata

Create a new directory for OpenMetadata and navigate into that directory.

```commandline
mkdir openmetadata-docker && cd openmetadata-docker
```

### 2. Download Docker Compose File from Github Release Branch

Download the Docker Compose files from Release Branch. Head over to `docker` > `docker-compose-openmetadata` directory and download or copy contents of Docker compose files available there.

For example, if we want to download Docker Compose file for Release version `1.1.0` -
- Will navigate to [Github Repository](https://github.com/open-metadata/OpenMetadata)
- Switch Branch to release version which will be `1.1.0`
- Browse to `docker` > `docker-compose-openmetadata` directory
- Download the Docker Compose and env files available in the directory

To do this via terminal, just run the below commands -

```commandline
wget https://github.com/open-metadata/OpenMetadata/blob/1.1.0/docker/docker-compose-openmetadata/docker-compose-openmetadata.yml
wget https://github.com/open-metadata/OpenMetadata/blob/1.1.0/docker/docker-compose-openmetadata/env-mysql
```

If you are looking for Docker compose file with PostgreSQL, the command to download relevant files will be

```commandline
wget https://github.com/open-metadata/OpenMetadata/blob/1.1.0/docker/docker-compose-openmetadata/docker-compose-openmetadata-postgres.yml
wget https://github.com/open-metadata/OpenMetadata/blob/1.1.0/docker/docker-compose-openmetadata/env-postgres
```

### 3. Update Environment Variables required for OpenMetadata

In the previous [step](#2-download-docker-compose-file-from-github-release-branch), we download two files, one is `docker-compose` and another is `environment file` required for docker compose.

Identify and update the environment variables in the file to prepare openmetadata configurations.

For example, we want to configure external database and search engine configurations. In that case, you will update the below section of environment variable file -

```bash
...
# Database configuration for MySQL
DB_DRIVER_CLASS="com.mysql.cj.jdbc.Driver"
DB_SCHEME="mysql"
DB_USE_SSL="true"
DB_USER="<SQL_DATABASE_USERNAME>"
DB_USER_PASSWORD="<SQL_DATABASE_PASSWORD>"
DB_HOST="<SQL_DATABASE_ENDPOINT>"
DB_PORT="<SQL_DATABASE_PORT>"
OM_DATABASE="<SQL_DATABASE_NAME>"
# ElasticSearch Configurations
ELASTICSEARCH_HOST= "<ELASTICSEARCH_ENDPOINT>"
ELASTICSEARCH_PORT="<ELASTICSEARCH_ENDPOINT_PORT>"
ELASTICSEARCH_SCHEME="<ELASTICSEARCH_ENDPOINT_SCHEME>"
ELASTICSEARCH_USER="<ELASTICSEARCH_USERNAME>"
ELASTICSEARCH_PASSWORD="<ELASTICSEARCH_PASSWORD>"
...
```

{% note noteType="Warning" %}

- When setting up environment file if your custom password includes any special characters then make sure to follow the steps [here](https://github.com/open-metadata/OpenMetadata/issues/12110#issuecomment-1611341650).

{% /note %}

### 4. Start the Docker Compose Services

Run the below command to deploy the OpenMetadata -

```bash
docker compose --env-file ./env-mysql up --detach
```

You can validate that all containers are up by running with command `docker ps`.

```commandline
❯ docker ps
CONTAINER ID   IMAGE                                                  COMMAND                  CREATED          STATUS                    PORTS                                                            NAMES
470cc8149826   openmetadata/server:1.0.0                             "./openmetadata-star…"   45 seconds ago   Up 43 seconds             3306/tcp, 9200/tcp, 9300/tcp, 0.0.0.0:8585-8586->8585-8586/tcp   openmetadata_server
```

In a few seconds, you should be able to access the OpenMetadata UI at [http://localhost:8585](http://localhost:8585)

## Port Mapping / Port Forwarding 

We are shipping the OpenMetadata server and UI at container port and host port `8585`. You can change the host port number according to your requirement. 
As an example, You could update the ports to serve OpenMetadata Server and UI  at port `80`

To achieve this -
- You just have to update the ports mapping of the openmetadata-server in the `docker-compose.yml` file under `openmetadata-server` docker service section.

```yaml
...
ports:
  - "80:8585"
...
```

- Once the port is updated if there are any containers running remove them first using `docker compose down` command and then recreate the containers once again by below command 

```commandline
docker compose up --detach
```

## Run OpenMetadata with a load balancer

You may put one or more OpenMetadata instances behind a load balancer for reverse proxying. To do this you will need to add one or more entries to the configuration file for your reverse proxy.

### Nginx

To use OpenMetadata behind an Nginx reverse proxy, add an entry resembling the following the http context of your Nginx configuration file for each OpenMetadata instance.

```
server {
    access_log /var/log/nginx/stage-reverse-access.log;
    error_log /var/log/nginx/stage-reverse-error.log;
    server_name stage.open-metadata.org;
    location / {
        proxy_pass http://127.0.0.1:8585;
    }
}
```

## Run OpenMetadata with AWS Services

If you are running OpenMetadata in AWS, it is recommended to use [Amazon RDS](https://docs.aws.amazon.com/rds/index.html) and [Amazon OpenSearch Service](https://docs.aws.amazon.com/opensearch-service/?id=docs_gateway).

We support 

- Amazon RDS (MySQL) engine version 8 or greater
- Amazon OpenSearch (ElasticSearch) engine version upto 7.10 or Amazon OpenSearch engine version upto 1.3
- Amazon RDS (PostgreSQL) engine version between 12 and 14.6

Note:-
    When using AWS Services the SearchType Configuration for elastic search should be `opensearch`, for both cases ElasticSearch and OpenSearch,
as you can see in the ElasticSearch configuration example.

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
SEARCH_TYPE = 'opensearch'
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

```bash
docker compose --env-file ./env-mysql up --detach
```

## Troubleshooting

### Java Memory Heap Issue

If your openmetadata Docker Compose logs speaks about the below issue -

```
Exception: java.lang.OutOfMemoryError thrown from the UncaughtExceptionHandler in thread "AsyncAppender-Worker-async-file-appender"
Exception in thread "pool-5-thread-1" java.lang.OutOfMemoryError: Java heap space
Exception in thread "AsyncAppender-Worker-async-file-appender" java.lang.OutOfMemoryError: Java heap space
Exception in thread "dw-46" java.lang.OutOfMemoryError: Java heap space
Exception in thread "AsyncAppender-Worker-async-console-appender" java.lang.OutOfMemoryError: Java heap space
```

This is due to the default JVM Heap Space configuration (1 GiB) being not enough for your workloads. In order to resolve this issue, head over to your custom openmetadata environment variable file and append the below environment variable

```
#environment variable file
OPENMETADATA_HEAP_OPTS="-Xmx2G -Xms2G"
```

The flag `Xmx` specifies the maximum memory allocation pool for a Java virtual machine (JVM), while `Xms` specifies the initial memory allocation pool.

Restart the OpenMetadata Docker Compose Application using `docker compose --env-file <my-env-file> -f docker-compose.yml up --detach` which will recreate the containers with new environment variable values you have provided.

## Security

Please follow our [Enable Security Guide](/deployment/docker/security) to configure security for your OpenMetadata
installation.

## Advanced

If you want to persist your data, prepare [Named Volumes](/deployment/docker/volumes) for the containers.

## Next Steps

1. Visit the [Features](/releases/features) overview page and explore the OpenMetadata UI.
2. Visit the [Connectors](/connectors) documentation to see what services you can integrate with
   OpenMetadata.
3. Visit the [API](/swagger.html) documentation and explore the rich set of OpenMetadata APIs.
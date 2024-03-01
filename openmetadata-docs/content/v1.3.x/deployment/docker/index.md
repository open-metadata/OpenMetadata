---
title: Docker Deployment
slug: /deployment/docker
---

# Docker Deployment

This guide will help you set up the OpenMetadata Application using Docker Deployment.
Before starting with the deployment make sure you follow all the below Prerequisites.

## Docker Deployment Architecture

{% image src="/images/v1.3/deployment/docker/om_docker_architecture.png" alt="Docker Deployment Architecture" /%}

## Prerequisites

### Configure OpenMetadata to use External Database and Search Engine

For Production Deployment using Docker, we recommend bringing your own Databases and ElasticSearch Engine and not rely on quickstart packages.

{% partial file="/v1.3/deployment/configure-external-orchestrator-for-ingestion-service.md" /%}

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

{% partial file="/v1.3/deployment/minimum-sizing-requirements.md" /%}

## Steps for Deploying OpenMetadata using Docker

### 1. Create a directory for OpenMetadata

Create a new directory for OpenMetadata and navigate into that directory.

```commandline
mkdir openmetadata-docker && cd openmetadata-docker
```

### 2. Download Docker Compose Files from GitHub Releases

Download the Docker Compose files from the [Latest GitHub Releases](https://github.com/open-metadata/OpenMetadata/releases/latest).

The Docker compose file name will be `docker-compose-openmetadata.yml`.

This docker compose file contains only the docker compose services for OpenMetadata Server. Bring up the dependencies as mentioned in the [prerequisites](#configure-openmetadata-to-use-external-database-and-search-engine) section.

You can also run the below command to fetch the docker compose file directly from the terminal -

```bash
wget https://github.com/open-metadata/OpenMetadata/releases/download/1.3.1-release/docker-compose-openmetadata.yml
```

### 3. Update Environment Variables required for OpenMetadata Dependencies

In the previous [step](#2.-download-docker-compose-files-from-github-releases), we download the `docker-compose` file.

Identify and update the environment variables in the file to prepare openmetadata configurations.

For MySQL Configurations, update the below environment variables -

```bash
...
# Database configuration for MySQL
DB_DRIVER_CLASS="com.mysql.cj.jdbc.Driver"
DB_SCHEME="mysql"
DB_PARAMS="allowPublicKeyRetrieval=true&useSSL=true&serverTimezone=UTC"
DB_USER="<SQL_DATABASE_USERNAME>"
DB_USER_PASSWORD="<SQL_DATABASE_PASSWORD>"
DB_HOST="<SQL_DATABASE_ENDPOINT>"
DB_PORT="<SQL_DATABASE_PORT>"
OM_DATABASE="<SQL_DATABASE_NAME>"
...
```

For ElasticSearch Configurations, update the below environment variables -

```bash
# ElasticSearch Configurations
SEARCH_TYPE="elasticsearch"
ELASTICSEARCH_HOST="<ELASTICSEARCH_ENDPOINT>"
ELASTICSEARCH_PORT="<ELASTICSEARCH_ENDPOINT_PORT>"
ELASTICSEARCH_SCHEME="<ELASTICSEARCH_ENDPOINT_SCHEME>"
ELASTICSEARCH_USER="<ELASTICSEARCH_USERNAME>"
ELASTICSEARCH_PASSWORD="<ELASTICSEARCH_PASSWORD>"
...
```

For OpenSearch Configurations, update the below environment variables -

```bash
# ElasticSearch Configurations
SEARCH_TYPE="opensearch"
ELASTICSEARCH_HOST="<OPENSEARCH_ENDPOINT>"
ELASTICSEARCH_PORT="<OPENSEARCH_ENDPOINT_PORT>"
ELASTICSEARCH_SCHEME="<OPENSEARCH_ENDPOINT_SCHEME>"
ELASTICSEARCH_USER="<OPENSEARCH_USERNAME>"
ELASTICSEARCH_PASSWORD="<OPENSEARCH_PASSWORD>"
...
```

For Ingestion Configurations, update the below environment variables -

```bash
PIPELINE_SERVICE_CLIENT_ENDPOINT="<INGESTION_ENDPOINT_URL_WITH_SCHEME>"
PIPELINE_SERVICE_CLIENT_HEALTH_CHECK_INTERVAL="300"
SERVER_HOST_API_URL="<OPENMETADATA_ENDPOINT_URL_WITH_SCHEME>/api"
PIPELINE_SERVICE_CLIENT_VERIFY_SSL="no-ssl"
PIPELINE_SERVICE_CLIENT_SSL_CERT_PATH=""
PIPELINE_SERVICE_CLIENT_CLASS_NAME="org.openmetadata.service.clients.pipeline.airflow.AirflowRESTClient"
PIPELINE_SERVICE_IP_INFO_ENABLED="false"
PIPELINE_SERVICE_CLIENT_HOST_IP=""
PIPELINE_SERVICE_CLIENT_SECRETS_MANAGER_LOADER="noop"
AIRFLOW_USERNAME="<AIRFLOW_UI_LOGIN_USERNAME>"
AIRFLOW_PASSWORD="<AIRFLOW_UI_LOGIN_PASSWORD>"
AIRFLOW_TIMEOUT="10"
AIRFLOW_TRUST_STORE_PATH=""
AIRFLOW_TRUST_STORE_PASSWORD=""
```

{% note noteType="Warning" %}

When setting up environment file if your custom password includes any special characters then make sure to follow the steps [here](https://github.com/open-metadata/OpenMetadata/issues/12110#issuecomment-1611341650).

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
470cc8149826   openmetadata/server:1.3.1                              "./openmetadata-star…"   45 seconds ago   Up 43 seconds             3306/tcp, 9200/tcp, 9300/tcp, 0.0.0.0:8585-8586->8585-8586/tcp   openmetadata_server
```

In a few seconds, you should be able to access the OpenMetadata UI at [http://localhost:8585](http://localhost:8585)

## Port Mapping / Port Forwarding

We are shipping the OpenMetadata server and UI at container port and host port `8585`. You can change the host port number according to your requirement.
As an example, You could update the ports to serve OpenMetadata Server and UI at port `80`

To achieve this -

- You just have to update the ports mapping of the openmetadata-server in the `docker-compose.yml` file under `openmetadata-server` docker service section.

```yaml
---
ports:
  - "80:8585"
```

- Once the port is updated if there are any containers running remove them first using `docker compose down` command and then recreate the containers once again by below command

```commandline
docker compose up --detach
```

## Run OpenMetadata with a load balancer

You may put one or more OpenMetadata instances behind a load balancer for reverse proxying. To do this you will need to add one or more entries to the configuration file for your reverse proxy.

### Nginx

To use OpenMetadata behind Nginx reverse proxy, add an entry resembling the following the http context of your Nginx configuration file for each OpenMetadata instance.

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
- Amazon OpenSearch (ElasticSearch) engine version up to 8.10.2 or Amazon OpenSearch engine version up to 2.7
- Amazon RDS (PostgreSQL) engine version 12 or greater

Note:-
When using AWS Services the SearchType Configuration for elastic search should be `opensearch`, for both cases ElasticSearch and OpenSearch,
as you can see in the ElasticSearch configuration example.

For Production Systems, we recommend Amazon RDS to be in Multiple Availability Zones. For Amazon OpenSearch (or ElasticSearch) Service, we recommend Multiple Availability Zones with minimum 3 Master Nodes.

Once you have the RDS and OpenSearch Services Setup, you can update the environment variables below for OpenMetadata Docker Compose backed systems to connect with Database and ElasticSearch.

```
# MySQL Environment Variables
DB_DRIVER_CLASS='com.mysql.cj.jdbc.Driver'
DB_SCHEME='mysql'
DB_PARAMS='allowPublicKeyRetrieval=true&useSSL=true&serverTimezone=UTC'
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

## Advanced

### Add Docker Volumes for OpenMetadata Server Compose Service

There are many scenarios where you would want to provide additional files to the OpenMetadata Server and serve while running the application. In such scenarios, it is recommended to provision docker volumes for OpenMetadata Application.

{%note noteType="Tip"%}

If you are not familiar with Docker Volumes with Docker Compose Services, Please refer to [official documentation](https://docs.docker.com/storage/volumes/#use-a-volume-with-docker-compose) for more information.

{%/note%}

For example, we would like to provide custom JWT Configuration Keys to be served to OpenMetadata Application. This requires the OpenMetadata Containers to have docker volumes sharing the private and public keys. Let's assume you have the keys available in `jwtkeys` directory in the same directory where your `docker-compose` file is available in the host machine.

We add the volumes section to mount the keys onto the docker containers create with docker compose as follows -

```yaml
services:
    openmetadata-server:
        ...
        volumes:
            - ./jwtkeys:/etc/openmetadata/jwtkeys
        ...
```

The above example uses [bind mounts](https://docs.docker.com/storage/bind-mounts/#use-a-bind-mount-with-compose) to share files and directories between host machine and openmetadata container.

Next, in your environment file, update the jwt configurations to use the right path from inside the container.

```bash
...
# JWT Configuration
RSA_PUBLIC_KEY_FILE_PATH="/etc/openmetadata/jwtkeys/public_key.der"
RSA_PRIVATE_KEY_FILE_PATH="/etc/openmetadata/jwtkeys/private_key.der"
...
```

Once the changes are updated, if there are any containers running remove them first using `docker compose down` command and then recreate the containers once again by below command

```commandline
docker compose up --detach
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

### PostgreSQL Issue permission denied to create extension "pgcrypto"

{% partial file="/v1.3/deployment/postgresql-issue-permission-denied-extension-pgcrypto.md" /%}

{%note%}

In the above command, replace `<openmetadata_psql_user>` with the sql user used by OpenMetadata Application to connect to PostgreSQL Database.

{%/note%}

## Security

Please follow our [Enable Security Guide](/deployment/docker/security) to configure security for your OpenMetadata
installation.

## Next Steps

1. Refer the [How-to Guides](/how-to-guides) for an overview of all the features in OpenMetadata.
2. Visit the [Connectors](/connectors) documentation to see what services you can integrate with
   OpenMetadata.
3. Visit the [API](/swagger.html) documentation and explore the rich set of OpenMetadata APIs.

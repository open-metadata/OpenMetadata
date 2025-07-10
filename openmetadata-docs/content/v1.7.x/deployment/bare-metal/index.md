---
title: Bare Metal Deployment
slug: /deployment/bare-metal
collate: false
---

# Deploy on Bare Metal

Requirements This guide assumes you have access to a command-line environment or shell such as bash, zsh, etc. or Linux
or Mac OS X or PowerShell on Microsoft Windows. This guide also assumes that your command-line environment has access to
the tar utility. Please review additional requirements listed in the subsections below.

## Java (version 21.0.0)

OpenMetadata is built using Java, DropWizard, and Jetty.

Type the following command to verify that you have a supported version of the Java runtime installed.

```commandline
java --version
```

To install Java or upgrade to Java 21 or greater, see the instructions for your operating system at [How do I install
Java?](https://java.com/en/download/help/download_options.html#mac).

## MySQL (version 8.0.0 or higher)

To install MySQL see the instructions for your operating system (OS) at [Installing and Upgrading MySQL](https://dev.mysql.com/doc/mysql-installation-excerpt/8.0/en/installing.html) 
or visit one of the following OS-specific guides.

- [Installing MySQL on Linux](https://dev.mysql.com/doc/mysql-installation-excerpt/8.0/en/linux-installation.html)
- [Installing MySQL on Windows](https://dev.mysql.com/doc/mysql-installation-excerpt/8.0/en/windows-installation.html)
- [Installing MySQL on MacOS](https://dev.mysql.com/doc/mysql-installation-excerpt/8.0/en/macos-installation.html)

{%note%}

Make sure to configure required databases and users for OpenMetadata. 

You can refer a sample script [here](https://github.com/open-metadata/OpenMetadata/blob/main/docker/mysql/mysql-script.sql).

{%/note%}

## Postgres (version 12.0 or higher)

To install Postgres see the instructions for your operating system (OS) at [Postgres Download](https://www.postgresql.org/download/) 
{%note%}

Make sure to configure required databases and users for OpenMetadata. 

You can refer a sample script [here](https://github.com/open-metadata/OpenMetadata/blob/main/docker/postgresql/postgres-script.sql).

{%/note%}


## Elasticsearch (version 8.X)

OpenMetadata supports ElasticSearch version up to 8.11.4. To install or upgrade Elasticsearch to a supported version please see the instructions for your operating system at 
[Installing ElasticSearch](https://www.elastic.co/guide/en/elasticsearch/reference/current/install-elasticsearch.html).

Please follow the instructions here to [install ElasticSearch](https://www.elastic.co/guide/en/elasticsearch/reference/7.13/setup.html).

If you are using AWS OpenSearch Service, OpenMetadata Supports AWS OpenSearch Service engine version up to 2.19. For more information on AWS OpenSearch Service, please visit the official docs [here](https://docs.aws.amazon.com/opensearch-service/latest/developerguide/what-is.html).

## Airflow or other workflow schedulers

OpenMetadata performs metadata ingestion using the Ingestion Framework. Learn more about how to deploy and manage
the ingestion workflows [here](/deployment/ingestion).

OpenMetadata versions have specific Airflow compatibility requirements to ensure seamless metadata ingestion. OpenMetadata 1.5 supports Airflow 2.9, 1.6.4 supports Airflow 2.9.3, and 1.6.5 supports Airflow 2.10.5. Ensure that your Airflow version aligns with your OpenMetadata deployment to maintain stability and functionality.

## Minimum Sizing Requirements

- Our minimum specs recommendation for the OpenMetadata Deployment (one replica) is 2 vCPUs and 4 Gigs with 20 Gigs of volume size if using persistent volumes for logs.
- For Elasticsearch, 2 vCPUs and 2 Gigs RAM (per instance) with 30 Gigs of Storage volume attached.
- For the database, 2 vCPUs and 2 Gigs RAM (per instance) with 30 Gigs of Storage Volume Attached (dynamic expansion up to 100 Gigs).

These settings apply as well when using managed instances, such as RDS or AWS OpenSearch.

# Procedure

## 1. Download the distribution

Visit the [releases page](https://github.com/open-metadata/OpenMetadata/releases/latest) and download the latest binary release.

Release binaries follow the naming convention of `openmetadata-x.y.z.tar.gz`. Where `x`, `y`, and `z` represent the 
major, minor, and patch release numbers.

## 2. Untar the release download

Once the tar file has downloaded, run the following command, updated if necessary for the version of OpenMetadata that you downloaded.

```commandline
tar -zxvf openmetadata-*.tar.gz
```

## 3. Navigate to the directory created

```commandline
cd openmetadata-*
```

Review and update the `openmetadata.yaml` configurations to match your environment. Specifically, consider aspects such
as the connection to the MySQL database or ElasticSearch. You can find more information about these configurations
[here](/deployment/configuration).

## 4. Prepare the OpenMetadata Database and Indexes

The command below will generate all the necessary tables and indexes in ElasticSearch.

{%note%}

Note that if there's any data in that database, this command will drop it!

{%/note%}

```commandline
./bootstrap/openmetadata-ops.sh drop-create
```

## 5. Start OpenMetadata

```commandline
./bin/openmetadata.sh start
```

We recommend configuring `serviced` to monitor the OpenMetadata command to restart in case of any failures.

## Run OpenMetadata with a load balancer

You may put one or more OpenMetadata instances behind a load balancer for reverse proxying.
To do this you will need to add one or more entries to the configuration file for your reverse proxy.

### Apache mod_proxy

To use the Apache mod_proxy module as a reverse proxy for load balancing, update the VirtualHost tag in your
Apache config file to resemble the following.

```xml
<VirtualHost *:80>
    <Proxy balancer://mycluster>
        BalancerMember http://127.0.0.1:8585 <!-- First OpenMetadata server -->
        BalancerMember http://127.0.0.2:8686 <!-- Second OpenMetadata server -->
    </Proxy>

    ProxyPreserveHost On

    ProxyPass / balancer://mycluster/
    ProxyPassReverse / balancer://mycluster/
</VirtualHost>
```

### Nginx

To use OpenMetadata behind an Nginx reverse proxy, add an entry resembling the following the http context of your Nginx
configuration file for each OpenMetadata instance.

```commandline
server {
    access_log /var/log/nginx/stage-reverse-access.log;
    error_log /var/log/nginx/stage-reverse-error.log;         
    server_name stage.open-metadata.org;
    location / {
        proxy_pass http://127.0.0.1:8585;
    }
}
```

## Run OpenMetadata with AWS Services or your hosted DB/ElasticSearch

If you are running OpenMetadata in AWS, it is recommended to use [Amazon RDS](https://docs.aws.amazon.com/rds/index.html) and [Amazon OpenSearch Service](https://docs.aws.amazon.com/opensearch-service/?id=docs_gateway).

We support 

- Amazon RDS (MySQL) engine version 8 or higher
- Amazon OpenSearch (ElasticSearch) engine version up to 8.11.4 or Amazon OpenSearch engine version up to 2.19
- Amazon RDS (PostgreSQL) engine version between 12 or higher

For Production Systems, we recommend Amazon RDS to be in Multiple Availability Zones. For Amazon OpenSearch (or ElasticSearch) Service, we recommend Multiple Availability Zones with minimum 3 Master Nodes.

Once you have the RDS and OpenSearch Services Setup, you can update the environment variables below for OpenMetadata bare metal systems to connect with Database and ElasticSearch.


Below are the environment variables for OpenMetadata Server

### Configure MySQL connection

```
# MySQL Environment Variables
DB_DRIVER_CLASS='com.mysql.cj.jdbc.Driver'
DB_SCHEME='mysql'
DB_PARAMS='allowPublicKeyRetrieval=true&useSSL=true&serverTimezone=UTC'
DB_USER='<YOUR_MYSQL_USER_NAME>'
DB_USER_PASSWORD='<YOUR_MYSQL_USER_PASSWORD>'
DB_HOST='<YOUR_MYSQL_HOST_NAME>'
DB_PORT='<YOUR_MYSQL_PORT>'
OM_DATABASE='<YOUR_MYSQL_DATABASE_NAME>'
```

### Configure Postgres Connection

```
# Postgres Environment Variables
DB_DRIVER_CLASS='org.postgresql.Driver'
DB_SCHEME='postgresql'
DB_PARAMS='allowPublicKeyRetrieval=true&useSSL=true&serverTimezone=UTC'
DB_USER='<YOUR_POSTGRES_USER_NAME>'
DB_USER_PASSWORD='<YOUR_POSTGRES_USER_PASSWORD>'
DB_HOST='<YOUR_POSTGRES_HOST_NAME>'
DB_PORT='<YOUR_POSTGRES_PORT>'
OM_DATABASE='<YOUR_POSTGRES_DATABASE_NAME>'
```

### Configure ElasticSearch Connection
```
ELASTICSEARCH_SOCKET_TIMEOUT_SECS='60'
ELASTICSEARCH_USER='<ES_USERNAME>'
ELASTICSEARCH_CONNECTION_TIMEOUT_SECS='5'
ELASTICSEARCH_PORT='443'
ELASTICSEARCH_SCHEME='https'
ELASTICSEARCH_BATCH_SIZE='10'
ELASTICSEARCH_HOST='vpc-<random_characters>.<aws_region>.es.amazonaws.com'
ELASTICSEARCH_PASSWORD='<ES_PASSWORD>'
ELASTICSEARCH_CLUSTER_ALIAS='<clusterAlias>'
```

### Configure OpenSearch
```
# ElasticSearch Configurations
SEARCH_TYPE="opensearch"
ELASTICSEARCH_HOST="<OPENSEARCH_ENDPOINT>"
ELASTICSEARCH_PORT="<OPENSEARCH_ENDPOINT_PORT>"
ELASTICSEARCH_SCHEME="<OPENSEARCH_ENDPOINT_SCHEME>"
ELASTICSEARCH_USER="<OPENSEARCH_USERNAME>"
ELASTICSEARCH_PASSWORD="<OPENSEARCH_PASSWORD>"
ELASTICSEARCH_CLUSTER_ALIAS="<clusterAlias>"
```
{% note %}

If you want to separate indexes for production and non-production environments, you can set the `clusterAlias` in the configuration file.

{% /note %}

### Configure Ingestion

```
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

## Troubleshooting

### Java Memory Heap Issue

If your openmetadata application logs speaks about the below issue -

```
Exception: java.lang.OutOfMemoryError thrown from the UncaughtExceptionHandler in thread "AsyncAppender-Worker-async-file-appender"
Exception in thread "pool-5-thread-1" java.lang.OutOfMemoryError: Java heap space
Exception in thread "AsyncAppender-Worker-async-file-appender" java.lang.OutOfMemoryError: Java heap space
Exception in thread "dw-46" java.lang.OutOfMemoryError: Java heap space
Exception in thread "AsyncAppender-Worker-async-console-appender" java.lang.OutOfMemoryError: Java heap space
```

This is due to the default JVM Heap Space configuration (1 GiB) being not enough for your workloads. In order to resolve this issue, head over to your openmetadata environment variables list and append the below environment variable

```
# environment variable file (either .bash_profile or .bashrc or add in conf/openmetadata-env.sh in release binaries)
export OPENMETADATA_HEAP_OPTS="-Xmx2G -Xms2G"
```

The flag `Xmx` specifies the maximum memory allocation pool for a Java virtual machine (JVM), while `Xms` specifies the initial memory allocation pool.

Restart the OpenMetadata Application using `./bin/openmetadata.sh start` which will start the service using a linux process.

## Enable Security

Please follow our [Enable Security Guide](/deployment/bare-metal/security) to configure security for your OpenMetadata
installation.

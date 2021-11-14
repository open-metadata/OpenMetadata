---
description: >-
  This installation doc will help you start a OpenMetadata standalone instance
  on your local machine.
---

# Run OpenMetadata

## Run Docker (Latest Release)

[Docker](https://docs.docker.com/get-started/overview/) is an open platform for developing, shipping, and running applications that enables you to separate your applications from your infrastructure so you can deliver software quickly using OS-level virtualization to deliver software in packages called containers.

{% hint style="info" %}
**Prerequisites**

* Docker >= 20.10.x
* Minimum allocated memory to Docker >= 4GB (Preferences -> Resources -> Advanced)
{% endhint %}

```bash
git clone https://github.com/open-metadata/OpenMetadata
cd OpenMetadata/docker/metadata
docker-compose up
```

### Next Steps

1. Docker for OpenMetadata will depend on Mysql Container to be up, It may take few seconds to run.
2. Once OpenMetadata UI is accessible, Go to [Airflow UI](http://localhost:8080) to invoke the pipelines to ingest data.

The above command brings up all the necessary services

1. MySQL
2. ElasticSearch
3. OpenMetadata Sever
4. Ingestion with Airflow

To access the OpenMetadata

Open [http://localhost:8585](http://localhost:8585) in your browser

Airflow UI available at [http://localhost:8080](http://localhost)

## Run Docker (Local Server)

{% hint style="info" %}
This Docker will enable users to access the Local OpenMetadata Server and Ingestion.

**Prerequisites**

* Docker >= 20.10.x
* Minimum allocated memory to Docker >= 4GB (Preferences -> Advanced -> Resources)
{% endhint %}

Run the below script to create the latest Maven build of the local and run the Docker with the respective Maven build and Ingestion.

```
#Run Script to initialize Maven Build and start building Docker
git clone https://github.com/open-metadata/OpenMetadata
cd OpenMetadata
./docker/run_local_docker.sh
```

## Run Manually

{% hint style="success" %}
This is a quick start guide that will show you how to quickly start a standalone server.
{% endhint %}

### Download the distribution

**Prerequisites**

{% hint style="info" %}
OpenMetadata is built using Java, DropWizard, Jetty, and MySQL.

1. Java 11 or above
2. MySQL 8 or above
{% endhint %}

{% tabs %}
{% tab title="Download the release" %}
Download the latest binary release from [OpenMetadata](https://github.com/open-metadata/OpenMetadata/releases/download/0.5.0/openmetadata-0.5.0.tar.gz), Once you have the tar file,

```bash
# untar it
tar -zxvf openmetadata-0.5.0.tar.gz

# navigate to directory containing the launcher scripts
cd openmetadata-0.5.0
```
{% endtab %}
{% endtabs %}

### Install on your local machine

#### macOS

1. Setup Database
   *   Install MySQL

       ```
        brew install mysql
       ```
   *   Configure MySQL

       ```
       mysqladmin -u root password 'yourpassword'
       mysql -u root -p
       ```
   *   Setup Database

       ```
       mysql -u root -p
       CREATE DATABASE openmetadata_db;
       CREATE USER 'openmetadata_user'@'localhost' IDENTIFIED BY 'openmetadata_password';
       GRANT ALL PRIVILEGES ON openmetadata_db.* TO 'openmetadata_user'@'localhost' WITH GRANT OPTION;
       commit;
       ```
2.  Run bootstrap scripts to initialize the database and tables

    ```
       cd openmetadata-0.5.0
       ./bootstrap/bootstrap_storage.sh migrate
    ```
3.  Start the OpenMetadata Server

    ```
       cd openmetadata-0.5.0 
       ./bin/openmetadata.sh start
    ```

### Ingest Sample Data

Previous steps start OpenMetadata server. To start using it we need to run ElasticSearch and ingest sample metadata. Please follow the below guide:

[Ingest Sample Data](metadata-ingestion/ingest-sample-data.md)

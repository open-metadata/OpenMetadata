---
description: >-
  This installation doc will help you start a OpenMetadata standalone instance
  on your local machine.
---

# Run Docker

[Docker](https://docs.docker.com/get-started/overview/) is an open platform for developing, shipping, and running applications that enables you to separate your applications from your infrastructure so you can deliver software quickly using OS-level virtualization to deliver software in packages called containers.

{% hint style="info" %}
**Prerequisites**

* Docker &gt;= 20.10.x

**Ports to access once the docker is up:**

* OpenMetadata UI: 8585
* Scheduler UI: 7777
{% endhint %}

```text
cd docker/metadata
docker-compose up
```


# Run Manually

{% hint style="success" %}
This is a quick start guide that will show you how to quickly start a standalone server.
{% endhint %}

## Build from source or download the distribution

**Prerequisites**

{% hint style="info" %}
OpenMetadata is built using Java, DropWizard, Jetty, and MySQL.

1. Java 11 or above
2. MySQL 8 or above
{% endhint %}

{% tabs %}
{% tab title="Download the release" %}
Download the latest binary release from [OpenMetadata](https://open-metadata.org/download/), Once you have the tar file,

```bash
# untar it
tar -zxvf openmetadata-0.3.0.tar.gz

# navigate to directory containing the launcher scripts
cd openmetadata-0.3.0
```
{% endtab %}

{% tab title="Build from source " %}
Follow these steps to checkout code from [Github](https://github.com/open-metadata/OpenMetadata) and build OpenMetadata locally

{% hint style="info" %}
**Prerequisites**

Install [Apache Maven](https://maven.apache.org/install.html) 3.6 or higher
{% endhint %}

```bash
# checkout OpenMetadata
git clone https://github.com/open-metadata/OpenMetadata
cd OpenMetadata

# build OpenMetadata
mvn install package -DskipTests

# navigate to directory containing the setup scripts
cd dist/target/
unzip openmetadata-1.0.0-SNAPSHOT.zip
cd openmetadata-1.0.0-SNAPSHOT
```
{% endtab %}


{% endtabs %}

## Install on your local machine

### macOS

1. Setup Database

   * Install MySQL

   ```text
   brew install mysql
   ```

   * Configure MySQL

     ```text
     mysqladmin -u root password 'yourpassword'
     mysql -u root -p
     ```

   * Setup Database

     ```text
     mysql -u root -p
     CREATE DATABASE openmetadata_db;
     CREATE USER 'openmetadata_user'@'localhost' IDENTIFIED BY 'openmetadata_password';
     GRANT ALL PRIVILEGES ON openmetadata_db.* TO 'openmetadata_user'@'localhost' WITH GRANT OPTION;
     commit;
     ```

2. Run bootstrap scripts to initiate the database and tables

   ```text
   cd openmetadata-0.3.0
   ./boostrap/bootstrap-storage.sh migrate
   ```

3. Start the OpenMetadata Server

   ```text
      cd openmetadata-0.3.0 
      ./bin/openmetadata.sh start
   ```


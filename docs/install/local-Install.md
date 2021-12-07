---
description: >-
 This local installation doc will help you a start a OpenMetadata standlone instance on your local machine.
---

# Installation

In this guide you'll learn how to download and install OpenMetadata as a standlone instance

{% hint style="success" %}
This is a guide that will show you how to quickly start standalone server.
{% endhint %}

## Pre-Requisites




## Download OpenMetadata Distribution

First, Lets download the OpenMetadata Distribution from [Github Releases](https://github.com/open-metadata/OpenMetadata/releases)


{% hint style="info" %}
 **Prerequisites** 

OpenMetadata is built using Java, DropWizard and Jetty and MySQL.


1. Java 11 or above
2. MySQL 8 or above
3. ElasticSearch 7 or above

Make sure you have the above installed and ready.

{% endhint %}

### Build from source or download the distribution

{% tabs %}
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
cd openmetadata-dist/target/
unzip openmetadata-1.0.0-SNAPSHOT.zip
cd openmetadata-1.0.0-SNAPSHOT
```
{% endtab %}
{% tab title="Download the release" %}
Download the latest binary release from [OpenMetadata](https://open-metadata.org/download/), 
Once you have the tar file,

```bash
# untar it
tar -zxvf openmetadata-1.0.0-SNAPSHOT.tar.gz

# navigate to directory containing the launcher scripts
cd openmetadata-1.0.0-SNAPSHOT
```
{% endtab %}
{% endtabs %}



## Run OpenMetadata 

### OS X

1. Setup Database
   * Install MySQL
   
 	```bash 
 	brew install mysql
 	```
   * Configure MySQL
   
    ```bash
    mysqladmin -u root password 'yourpassword'
    mysql -u root -p
    ```
   * Setup Database
    
    ```bash
    mysql -u root -p
	 create database openmetadata;
	 CREATE USER 'openmetadata_user'@'%' IDENTIFIED BY 'openmetadata_password';
	 GRANT ALL PRIVILEGES ON openmetadata_db.* TO 'openmetadata_user'@'%';
	 commit;
	```
2. 	Run bootstrap scripts to initiate the database and tables

    ```bash
     cd $METDATA_HOME
     ./boostrap/bootstrap-storage.sh migrate
    ```
3. Start the OpenMetadata Server

   ```bash
   ./bin/openmetadata.sh start
   ```
4. Start ElasticSearch in a docker

   ```bash
	docker run -p 9200:9200 -p 9300:9300 -e "discovery.type=single-node" docker.elastic.co/elasticsearch/elasticsearch:7.10.2 
	```
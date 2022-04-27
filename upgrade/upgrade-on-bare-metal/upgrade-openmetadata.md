---
description: >-
  This guide will help you upgrade an OpenMetadata deployment using release
  binaries.
---

# Upgrade OpenMetadata on Bare Metal



{% hint style="danger" %}
**The 0.10 Release consists of backward-incompatible changes. We do not support database migration from the 0.9.0 release. Please follow the steps carefully and backup your database before proceeding.**

**0.10.0 installations require brand new installation and we have a migration tool to transfer all your entity descriptions, tags, owners, etc.. to the 0.10.0 release**&#x20;

Please reach out to us at [https://slack.open-metadata.org](https://slack.open-metadata.org) , we can schedule a zoom session to help you upgrade your production instance.
{% endhint %}

## Requirements

This guide assumes that you have an OpenMetadata deployment that you installed and configured following the [Run in Production](../../deploy/deploy-on-bare-metal/run-in-production.md) guide.

## Procedure

### 1. Download the binaries for the release you want to install

OpenMetadata release binaries are maintained as GitHub releases. To download a specific release binary:

1. Visit [github.com/open-metadata/OpenMetadata/releases](https://github.com/open-metadata/OpenMetadata/releases). The latest release will be at the top of this page.
2. Locate the Assets section for the release you want to upgrade to.
3. Download the release binaries. The release binaries will be in a compressed tar file named using the following convention, `openmetadata-x.y.z.tar.gz` Where `x`, `y`, `z` are the major, minor, and patch release numbers, respectively.

### 2. Extract the release binaries from the download file

Using the command-line tool or application of your choice, extract the release binaries. For example, to extract using tar, run the following command.

```
tar xfz openmetadata-0.10.0.tar.gz
```

This will create a directory with the same name as the download file minus the `.tar` and `.gz` extensions.

### 3. Navigate into the directory created by extracting the release binaries

Change into the new directory by issuing a command similar to the following.

```
cd openmetadata-x.x.x
```

For example, to navigate into the directory created by issuing the tar command above, you would run the following command.

```
cd openmetadata-0.10.0
```

### 4. Stop the OpenMetadata server

OpenMetadata ships with a few control scripts. One is `openmetadata.sh`. This script enables you to start, stop, and perform other deployment operations on the OpenMetadata server.

Most OpenMetadata releases will require you to migrate your data to updated schemas. Before you migrate your data to the new release you are upgrading to, stop the OpenMetadata server by running the following command.

```
./bin/openmetadata.sh stop
```

### 5. Drop and create the database schemas and Elasticsearch indexes

The `bootstrap/bootstrap_storage.sh` script enables you to perform a number of operations on the OpenMetadata database (in MySQL) and index (in Elasticsearch).

Do not use your existing database. Please create a new database to use with 0.10.0

Since the OpenMetadata **0.10** is a **backward incompatible release**, run the command  `drop-create-all` to:

* Drop and recreate all the databases in the table
* Drop and create all the indexes in Elasticsearch

```
./bootstrap/bootstrap_storage.sh drop-create-all
```

The OpenMetadata database schema and Elasticsearch index from the previous versions will be dropped. A new database scheme and Elasticsearch index will be created.

### 6. Restart the OpenMetadata server

Once you've dropped and recreated your data in the new version, restart the OpenMetadata server using the new release binaries. You may restart the server by running the following command.

```
./bin/openmetadata.sh start
```

### 7. Re-index data in Elasticsearch

Copy the following template to a configuration file named `metadata_to_es.json` or use an existing `metadata_to_es.json` file from the last time you installed or updated OpenMetadata.

```json
{
  "source": {
    "type": "metadata_elasticsearch",
    "serviceName": "openMetadata",
    "serviceConnection": {
      "config":{
        "type":"MetadataES",
        "includeTables": "true",
        "includeUsers": "true",
        "includeTopics": "true",
        "includeDashboards": "true",
        "limitRecords": 10
      } 
    },
    "sourceConfig":{"config":{}}
  },
  "sink": {
    "type": "elasticsearch",
    "config": {
      "index_tables": "true",
      "index_topics": "true",
      "index_dashboards": "true",
      "es_host": "localhost",
      "es_port": 9200
    }
  },
  "workflowConfig": {
    "openMetadataServerConfig": {
      "hostPort": "http://localhost:8585/api",
      "authProvider": "no-auth"
    }
  }
}
```

Ensure your `metadata_to_es.json` file is configured properly for your OpenMetadata deployment. E.g., make sure the host name and ports for Elasticsearch and OpenMetadata are set to the correct values. Run the following command to re-index migrated data following the updated schema.

```bash
metadata ingest -c metadata_to_es.json pipeline
```

### 8. Upgrade all your connectors

If you are ingesting data manually using OpenMetadata connectors, upgrade all your connectors by running the following command for each connector. You will need to replace `<connectorname>` the command below with the name of the connector you are upgrading.

```bash
pip3 install --upgrade 'openmetadata-ingestion[<connectorname>]'
```

{% hint style="info" %}
Note: Please see the installation instructions for the connectors you are using in order to ensure you are using the right Python virtual environment and following other norms for installing and upgrading connectors.
{% endhint %}




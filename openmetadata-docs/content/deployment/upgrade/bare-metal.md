---
title: Upgrade on Bare Metal
slug: /deployment/upgrade/bare-metal
---

# Upgrade on Bare Metal

This guide will help you upgrade an OpenMetadata deployment using release binaries.

## Requirements 

This guide assumes that you have an OpenMetadata deployment that you installed and configured following the
[Bare Metal deployment](/deployment/bare-metal) guide.

## Procedure

<Warning>

It is adviced to go through [openmetadata release notes](/deployment/upgrade/versions/012-to-013) before starting the upgrade process. 

</Warning>

### Backup your data

<Note>

To run the backup and restore commands, please make sure that you are always in the latest `openmetadata-ingestion`
version to have all the improvements shipped in the CLI.

</Note>

1. Make sure your instance is connected to the Database server
2. Create a virtual environment to install an upgraded `metadata` version to run the backup command:
   1. `python -m venv venv`
   2. `source venv/bin/activate`
   3. `pip install openmetadata-ingestion~=0.13.2`
3. Validate the installed `metadata` version with `python -m metadata --version`, which should tell us that we are
    indeed at 0.13.2. Notice the `python -m metadata` vs. `metadata`. 
4. Run the backup using the updated `metadata` CLI:
    ```
    python -m metadata backup -u openmetadata_user -p openmetadata_password -H mysql -d openmetadata_db --port 3306
    ```
   if using Postgres:
    ```
    python -m metadata backup -u openmetadata_user -p openmetadata_password -H postgresql -d openmetadata_db --port 5432 -s public
    ```
5. This will generate the .sql file which can be used for the backup
    In our case, the backup file was named `openmetadata_202212201528_backup.sql`. You can copy the name from the backup
    command output.

### 1. Download the binaries for the release you want to install

OpenMetadata release binaries are maintained as GitHub releases.

To download a specific release binary:

1. Visit [github.com/open-metadata/OpenMetadata/releases](https://github.com/open-metadata/OpenMetadata/releases). The latest
  release will be at the top of this page. 
2. Locate the Assets' section for the release you want to upgrade to. 
3. Download the release binaries. The release binaries will be in a compressed tar file named using the following 
  convention, `openmetadata-x.y.z.tar.gz` Where `x`, `y`, `z` are the major, minor, and patch release numbers, respectively.

### 2. Extract the release binaries from the download file

Using the command-line tool or application of your choice, extract the release binaries. 

For example, to extract using `tar`, run the following command. 

```commandline
tar xfz openmetadata-*.tar.gz
```

This will create a directory with the same name as the download file minus the `.tar` and `.gz` extensions.

### 3. Navigate into the directory created by extracting the release binaries

Change into the new directory by issuing a command similar to the following.

```commandline
cd openmetadata-x.y.z
```

For example, to navigate into the directory created by issuing the tar command above, you would run the following
command.

```commandline

cd openmetadata-0.13.2

```

### 4. Stop the OpenMetadata server

OpenMetadata ships with a few control scripts. One is `openmetadata.sh`. This script enables you to start, stop, and
perform other deployment operations on the OpenMetadata server. 

Most OpenMetadata releases will require you to migrate your data to updated schemas. 

Before you migrate your data to the new release you are upgrading to, stop the OpenMetadata server from the
directory of your current installation by running the following command:

```commandline
./bin/openmetadata.sh stop
```

### 5. Migrate the database schemas and ElasticSearch indexes

The bootstrap/bootstrap_storage.sh script enables you to perform a number of operations on the OpenMetadata database (in
MySQL) and index (in Elasticsearch).

```commandline
./bootstrap/bootstrap_storage.sh migrate-all
```


### 6. Restart the OpenMetadata server

Once you've dropped and recreated your data in the new version, restart the OpenMetadata server using the new release
binaries. You may restart the server by running the following command.

```commandline
./bin/openmetadata.sh start
```

### Optional - Upgrade all your connectors

If you are ingesting data manually or in a custom scheduler using OpenMetadata connectors,
upgrade all your connectors by running the following command for each connector.

You will need to replace `<connectorname>` in the command below with the name of the connector you are upgrading.

```commandline
pip3 install --upgrade "openmetadata-ingestion[<connectorname>]"
```

### Re-index all your metadata

Go to Settings -> Elasticsearch

<Image src="/images/deployment/upgrade/elasticsearch-re-index.webp" alt="create-project" caption="Reindex"/>

Click on reindex all

in the dialog box choose Recreate Indexes to All

<Image src="/images/deployment/upgrade/reindex-ES.webp" alt="create-project" caption="Reindex"/>

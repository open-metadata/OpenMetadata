---
description: >-
  This guide will help you upgrade an OpenMetadata deployment using release
  binaries.
---

# Upgrade OpenMetadata

## Requirements

An OpenMetadata deployment that you installed and configured following the [Run in Production](run-in-production.md) guide.

## Procedure

### 1. Download the release binaries you want to install

OpenMetadata release binaries are maintained as GitHub releases. To download a specific release binary:

1. Visit [github.com/open-metadata/OpenMetadata/releases](https://github.com/open-metadata/OpenMetadata/releases). The latest release will be at the top of this page.
2. Locate the Assets section for the release you want to upgrade to.
3. Download the release binaries. The release binaries will be in a compressed tar file named using the following convention, `openmetadata-x.y.z.tar.gz` Where `x`, `y`, `z` are the major, minor, and patch release numbers respectively.

### 2. Extract the release binaries from the download file

Using the command line tool or application of your choice, uncompress and untar the release binary download. For example, to extract using tar, run the following command.

```
tar xfz openmetadata-0.7.1.tar.gz
```

This will create a directory with the same name as the file minus the `.tar` and `.gz` extensions.

### 3. Navigate into the directory created by extracting the release binaries

Change into the new directory by issuing a command similar to the following.

```
cd openmetadata-x.x.x
```

For example, to navigate into the directory created by issuing the tar command above, you would run the following command.

```
cd openmetadata-0.7.1
```

### 4. Stop the OpenMetadata server

OpenMetadata ships with a few control scripts. One is `openmetadata.sh`. This script enables you to start, stop, and perform other deployment operations on the OpenMetadata server.

Before you migrate your data to the new release you are upgrading to, stop the OpenMetadata server by running the following command.

```
./bin/openmetadata.sh stop
```

### 5. Migrate database schemas and Elasticsearch indexes

The `bootstrap/bootstrap_storage.sh` script enables you to perform a number of operations on the OpenMetadata database (in MySQL) and index (in Elasticsearch).&#x20;

Migrate your data using this script by running the following command.

```
./bootstrap/bootstrap_storage.sh migrate-all
```

This will migrate the OpenMetadata database schema to the new version you are upgrading to. It will also migrate the Elasticsearch index to this version.

### 6. Restart the OpenMetadata server

Once you've migrated your data to the new version, restart the OpenMetadata server using the new release binaries. You may restart the server by running the following command.

```
./bin/openmetadata.sh start
```

### 7. Upgrade all your connectors

If you are ingesting data manually using OpenMetadata connectors, upgrade all your connectors by running the following command for each connector. You will need to replace `<connectorname>` in the command below by the name of the connector you are upgrading.

```bash
pip3 install --upgrade 'openmetadata-ingestion[<connectorname>]'
```

## Troubleshooting

### "migrate" option failed

In some circumstances, when attempting to migrate your database schemas and Elasticsearch indexes, you might encounter an error similar to the following.

```
14:42:40.630 [main] DEBUG org.flywaydb.core.FlywayExecutor - Memory usage: 
58 of 1024M
"migrate" option failed : org.flywaydb.core.api.exception.FlywayValidateException: 
Validate failed: Migrations have failed validation
Migration checksum mismatch for migration version 002
-> Applied to database : -163374426
-> Resolved locally    : 326575949. Either revert the changes to the migration, or
run repair to update the schema history.
Need more flexibility with validation rules?
Learn more: https://rd.gt/3AbJUZE
```

If you encounter this error, run the following command to repair your schema.

```bash
./bootstrap/bootstrap_storage.sh repair  
```

After running this command, you should see output similar to the following in response.

```
14:42:48.110 [main] INFO org.flywaydb.core.internal.command.DbRepair - 
Successfully repaired schema 
history table `openmetadata_db`.`DATABASE_CHANGE_LOG` (execution time 00:00.058s).
14:42:48.123 [main] DEBUG org.flywaydb.core.FlywayExecutor - 
Memory usage: 58 of 1024M
"repair" option successful
```

Once repair is successful, continue with the procedure above by rerunning the command in Step 5 and continuing from there.


---
description: >-
  This guide will help you upgrade an OpenMetadata deployment using release
  binaries.
---

# Upgrade OpenMetadata on Bare Metal

## Requirements

This guide assumes that you have an OpenMetadata deployment that you installed and configured following the [Run in Production](../../deploy/deploy-on-bare-metal/run-in-production.md) guide.

## Procedure

### 1. Download the binaries for the release you want to install

OpenMetadata release binaries are maintained as GitHub releases. To download a specific release binary:

1. Visit [github.com/open-metadata/OpenMetadata/releases](https://github.com/open-metadata/OpenMetadata/releases). The latest release will be at the top of this page.
2. Locate the Assets section for the release you want to upgrade to.
3. Download the release binaries. The release binaries will be in a compressed tar file named using the following convention, `openmetadata-x.y.z.tar.gz` Where `x`, `y`, `z` are the major, minor, and patch release numbers, respectively.

### 2. Extract the release binaries from the download file

Using the command line tool or application of your choice, extract the release binaries. For example, to extract using tar, run the following command.

```
tar xfz openmetadata-0.7.1.tar.gz
```

This will create a directory with the same name as the download file minus the `.tar` and `.gz` extensions.

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

Most OpenMetadata releases will require you to migrate your data to updated schemas. Before you migrate your data to the new release you are upgrading to, stop the OpenMetadata server by running the following command.

```
./bin/openmetadata.sh stop
```

### 5. Migrate database schemas and Elasticsearch indexes

The `bootstrap/bootstrap_storage.sh` script enables you to perform a number of operations on the OpenMetadata database (in MySQL) and index (in Elasticsearch).

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

### 7. Re-index data in Elasticsearch&#x20;

Copy the following template to a configuration file named `metadata_to_es.json` or use an existing `metadata_to_es.json` file from the last time you installed or updated OpenMetadata.

```json
{
  "source": {
    "type": "metadata",
    "config": {
      "include_tables": "true",
      "include_topics": "true",
      "include_dashboards": "true",
      "limit_records": 10
    }
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
  "metadata_server": {
    "type": "metadata-server",
    "config": {
      "api_endpoint": "http://localhost:8585/api",
      "auth_provider_type": "no-auth"
    }
  }
}
```

Ensure your `metadata_to_es.json` file is configured properly for your OpenMetadata deployment. E.g., make sure the host name and ports for Elasticsearch and OpenMetadata are set to the correct values. Run the following command to re-index migrated data following the updated schema.

```bash
metadata ingest -c metadata_to_es.json pipeline
```

### 8. Upgrade all your connectors

If you are ingesting data manually using OpenMetadata connectors, upgrade all your connectors by running the following command for each connector. You will need to replace `<connectorname>` in the command below by the name of the connector you are upgrading.

```bash
pip3 install --upgrade 'openmetadata-ingestion[<connectorname>]'
```

{% hint style="info" %}
Note: Please see the installation instructions for the connectors you are using in order to ensure you are using the right Python virtual environment and following other norms for installing and upgrading connectors.
{% endhint %}

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

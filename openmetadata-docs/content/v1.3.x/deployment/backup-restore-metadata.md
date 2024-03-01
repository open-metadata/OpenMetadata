---
title: Backup Metadata
slug: /deployment/backup-restore-metadata
---

# Backup & Restore Metadata

## Introduction

The goal of OpenMetadata is to enable company-wide collaboration around metadata. The more we use it, the more value
this brings to the table, which means that keeping the metadata safe can become a critical activity for our Disaster
Recovery practices.

While there are cloud services that feature automatic snapshots and replication, the metadata CLI
now allows all users to perform backups regardless of the underlying infrastructure.

## Requirements

The backup CLI needs to be used with `openmetadata-ingestion` version 0.13.1 or higher.

However, we recommend to make sure that you are always in the latest `openmetadata-ingestion`
version to have all the improvements shipped in the CLI.

## Installation

The CLI comes bundled in the base `openmetadata-ingestion` Python package. You can install it with:

```commandline
pip install openmetadata-ingestion
```

One of the `backup` features is to upload the generated backup to cloud storage (currently supporting S3 and Azure Blob). To use this,
you can instead install the package with the backup plugin:

```commandline
pip install "openmetadata-ingestion[backup,mysql]"
```

## Requirements & Considerations

This is a custom utility. As almost all tables contain `GENERATED` columns, directly using `mysqldump` is not an
option out of the box, as it would require some further cleaning steps to get the data right.

Instead, we have created a utility that will just dump the necessary data.

The requirement for running the process is that the target database should have the Flyway migrations executed.

The backup utility will provide an SQL file which will do two things:

1. TRUNCATE the OpenMetadata tables
2. INSERT the data that has been saved

You can then run the script's statements to restore the data.

{% note %}

Make sure that the migrations have been run correctly (find out how [here](/deployment/bare-metal#4.-prepare-the-openmetadata-database-and-indexes)).

Also, make sure that the target database does not already have any OpenMetadata data, or if it does, that you are OK
replacing it with whatever comes from the SQL script.

{% /note %}

## Backup CLI

After the installation, we can take a look at the different options to run the CLI:

```commandline
> metadata backup -h
usage: metadata backup [-h] -H HOST -u USER -p PASSWORD -d DATABASE [--port PORT] [--output OUTPUT] 
                       [--upload-destination-type {AWS,AZURE}] [--upload UPLOAD UPLOAD UPLOAD] [-o OPTIONS] [-a ARGUMENTS]
                       [-s SCHEMA]

optional arguments:
  -h, --help            show this help message and exit
  -H HOST, --host HOST  Host that runs the database
  -u USER, --user USER  User to run the backup
  -p PASSWORD, --password PASSWORD
                        Credentials for the user
  -d DATABASE, --database DATABASE
                        Database to backup
  --port PORT           Database service port
  --output OUTPUT       Local path to store the backup
  --upload-destination-type {AWS,AZURE}
                        AWS or AZURE
  --upload UPLOAD UPLOAD UPLOAD
                        S3 endpoint, bucket & key to upload the backup file
  -o OPTIONS, --options OPTIONS
  -a ARGUMENTS, --arguments ARGUMENTS
  -s SCHEMA, --schema SCHEMA
```

If using MySQL:

```bash
python -m metadata backup -u openmetadata_user -p openmetadata_password -H mysql -d openmetadata_db --port 3306
```

If using Postgres, add the `-s` parameter specifying the `schema`:

```bash
python -m metadata backup -u openmetadata_user -p openmetadata_password -H postgresql -d openmetadata_db --port 5432 -s public
```

### Database Connection

There is a set of four required parameters, the minimum required for us to access the database service and run the
backup: `host`, `user`, `password` and `database` to point to. Note that the user should have at least read access to the
database. By default, we'll try to connect through the port `3306`, but this can be overridden with the `--port` option.

### Output

The CLI will create a dump file that looks like `openmetadata_YYYYmmddHHMM_backup.sql`. This will help us identify the
date each backup was generated. We can also specify an output path, which we'll create if it does not exist, via
`--output`.

### Uploading to S3

To run this, make sure to have `AWS_ACCESS_KEY_ID` and
`AWS_SECRET_ACCESS_KEY` as environment variables with permissions to the bucket that you'd like to point to. Afterwards,
we can just use `--upload <endpoint> <bucket> <key>` to have the CLI upload the file. In this case, you'll get both the
local dump file and the one in the cloud.

### Uploading to Azure Blob


To run this, make sure to have Azure CLI configured with permissions to the Blob that you'd like to point to. Afterwards,
we can just use `--upload <account_url> <container> <folder>` to have the CLI upload the file. In this case, you'll get both the
local dump file and the one in the cloud.

### Connection Options and Arguments

You can pass any required connection options or arguments to the MySQL connection via `-o <opt1>, -o <opt2> [...]`
or `-a <arg1>, -a <arg2> [...]`.

### Trying it out

We can do a test locally preparing some containers:

1. `sh docker/run_local_docker.sh` to start the `docker compose` service.
2. `docker run -p 9000:9000 -p 9001:9001 minio/minio server /data --console-address ":9001"` to start minio, an object
   storage S3 compatible.
3. Connect to [http://localhost:9001](http://localhost:9001) to reach the minio console and create a bucket
   called `my-bucket`
4. Finally, we just need to prepare the environment variables as:
   ```
   export AWS_ACCESS_KEY_ID=minioadmin
   export AWS_SECRET_ACCESS_KEY=minioadmin
   ```

An example of S3 CLI call will look as:

```commandline
metadata backup -u openmetadata_user -p openmetadata_password \
    -H localhost -d openmetadata_db --output=dir1/dir2 \
    --upload-destination-type AWS \
    --upload http://localhost:9000 my-bucket backup/
```

And we'll get the following output:

```commandline
Creating OpenMetadata backup for localhost:3306/openmetadata_db...
Backup stored locally under dir1/dir2/openmetadata_202201250823_backup.sql
Uploading dir1/dir2/openmetadata_202201250823_backup.sql to http://localhost:9000/my-bucket/backup/openmetadata_202201250823_backup.sql...
```

If we now head to the minio console and check the `my-backup` bucket, we'll see our SQL dump in there.

{% image src="/images/v1.3/deployment/backup/minio-example.png" alt="minio" /%}

An example of Azure Blob CLI call will look as:

```commandline
metadata backup -u openmetadata_user -p openmetadata_password \
    -H localhost -d openmetadata_db --output=dir1/dir2 \
    --upload-destination-type AZURE \
    --upload https://container.blob.core.windows.net/ container-name Folder-name/
```
And we'll get the following output:

```commandline
Creating OpenMetadata backup for localhost:3306/openmetadata_db...
Backup stored locally under openmetadata_202212161559_backup.sql
Uploading openmetadata_202212161559_backup.sql to https://container.blob.core.windows.net//container-name...
```

# Restore Metadata

Make sure that when restoring metadata, your OpenMetadata server is **NOT RUNNING**. Otherwise, there could be
clashes on cached values and specific elements that the server creates at start-time and that will be present
on the restore SQL file as well.

## Introduction

SQL file which is generated using Backup metadata CLI
can restore using Restore metadata CLI.

## Requirements

The restore CLI needs to be used with `openmetadata-ingestion` version 0.12.1 or higher.

## Restore CLI

After the installation, we can take a look at the different options to run the CLI:

```commandline
> metadata restore -h
usage: metadata restore [-h] -H HOST -u USER -p PASSWORD -d DATABASE [--port PORT] --input INPUT [-o OPTIONS] 
                        [-a ARGUMENTS] [-s SCHEMA]

optional arguments:
  -h, --help            show this help message and exit
  -H HOST, --host HOST  Host that runs the database
  -u USER, --user USER  User to run the restore backup
  -p PASSWORD, --password PASSWORD
                        Credentials for the user
  -d DATABASE, --database DATABASE
                        Database to restore
  --port PORT           Database service port
  --input INPUT         Local backup file path for restore
  -o OPTIONS, --options OPTIONS
  -a ARGUMENTS, --arguments ARGUMENTS
  -s SCHEMA, --schema SCHEMA
```

### Output

The CLI will give messages like this `Backup restored from openmetadata_202209301715_backup.sql` when backup restored completed.

### Trying it out

An example CLI call will look as:

```commandline
metadata restore -u openmetadata_user -p openmetadata_password -H localhost -d openmetadata_db --input openmetadata_202209301715_backup.sql
```

And we'll get the following output:

```commandline
Restoring OpenMetadata backup for localhost:3306/openmetadata_db...
Backup restored from openmetadata_202209301715_backup.sql
```

## Troubleshooting

It is not recommended to restore a backup of an older version to a newer version. Doing this may result into number of issues since the data is not in the expected shape, as migration has not been performed on this data yet. Read [this document](https://docs.open-metadata.org/deployment/upgrade/how-does-it-work) to understand how does the backup and restore works in OpenMetadata.

In case you are facing some issues because you restored the backup of older version into a newer version. Follow the below steps to resolve the issues:

1. Delete the current OpenMetadata instance and clean all the data, i.e. delete the `openmetadata_db` from your database source. In case you are using docker or kubernetes mode of deployment then clean all your volumes attached to database image.
2. Spin up a new instance of OpenMetadata of the older version. For example, if your backup file was generated by version 1.1.0 then spin up a fresh instance of OpenMetadata version 1.1.0.
3. Restore the data using the `metadata restore` command as described in the above doc.
4. Once the restoration process is completed follow the steps defined in [this document](https://docs.open-metadata.org/v1.3.x/deployment/upgrade) to upgrade your instance to the newer version depending on your deployment mode.
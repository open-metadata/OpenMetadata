# Backup Metadata

## Introduction

The goal of OpenMetadata is to enable company-wide collaboration around metadata. The more we use it, the more value this brings to the table, which means that keeping the metadata safe can become a critical activity for our Disaster Recovery practices.

While there are cloud services that feature automatic snapshots and replication, the `metadata` CLI now allows all users to perform backups regardless of the underlying infrastructure.

## Installation

The CLI comes bundled in the base `openmetadata-ingestion` Python package. You can install it with:

```bash
pip install openmetadata-ingestion
```

One of the `backup` features is to upload the generated backup to cloud storage (currently supporting S3). To use this, you can instead install the package with the `backup` plugin:

```bash
pip install "openmetadata-ingestion[backup]"
```

This tool acts as a wrapper around the powerful [mysqldump](https://dev.mysql.com/doc/refman/8.0/en/mysqldump.html) utility with some commodity addons on top. `mysqldump` is part of the `mysql-client` package and can be installed on your machine as:

* **macOS**

```bash
brew install mysql-client
```

* **Ubuntu**

```bash
sudo apt-get install mysql-client
```

## Backup CLI

After the installation, we can take a look at the different options to run the CLI:

```bash
> metadata backup --help
Usage: metadata backup [OPTIONS]

  Run a backup for the metadata DB. Requires mysqldump installed on the
  host.

  We can pass as many options as required with `-o <opt1>, -o <opt2> [...]`

  To run the upload, provide the information as `--upload endpoint bucket
  key` and properly configure the environment variables AWS_ACCESS_KEY_ID &
  AWS_SECRET_ACCESS_KEY

Options:
  -h, --host TEXT               Host that runs the database  [required]
  -u, --user TEXT               User to run the backup  [required]
  -p, --password TEXT           Credentials for the user  [required]
  -d, --database TEXT           Database to backup  [required]
  --port TEXT                   Database service port
  --output PATH                 Local path to store the backup
  --upload <TEXT TEXT TEXT>...  S3 endpoint, bucket & key to upload the backup
                                file
  -o, --options TEXT

```

### Database Connection

There is a set of four required parameters, the minimum required for us to access the database service and run the backup: `host`, `user`, `password` and `database` to point to. Note that the user should have at least read access to the database.

By default, we'll try to connect through the port `3306`, but this can be overridden with the `--port` option.

### Output

The CLI will create a dump file that looks like `openmetadata_`YYYYmmddHHMM`_backup.sql` . This will help us identify the date each backup was generated.

We can also specify an output path, which we'll create if it does not exist, via `--output` .

### Uploading to S3

We currently support uploading the backup files to S3. To run this, make sure to have `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY` as environment variables with permissions to the bucket that you'd like to point to.

Afterwards, we can just use `--upload <endpoint> <bucket> <key>` to have the CLI upload the file. In this case, you'll get **both** the local dump file and the one in the cloud.

### mysqldump options

`mysqldump` allows many options when running the command, and some of them might be required in different infrastructures. The `--options` parameters help us pass to `mysqldump` all of these required options via `-o <opt1>, -o <opt2> [...]` .

An example of this could be the default values we have used for them: `--protocol=tcp` and `--no-tablespaces`, which are required to run the command pointing to the local Docker container with the database and the default read-only user OpenMetadata provides in the Docker Compose.

### Trying it out

We can do a test locally preparing some containers:

1. `sh docker/run_local_docker.sh` to start the docker-compose service.
2. `docker run -p 9000:9000 -p 9001:9001 minio/minio server /data --console-address ":9001"` to start [minio](https://min.io), an object storage S3 compatible.
3. Connect to `http://localhost:9001` to reach the minio console and create a bucket called `my-bucket`
4. Finally, we just need to prepare the environment variables as:

```bash
export AWS_ACCESS_KEY_ID=minioadmin
export AWS_SECRET_ACCESS_KEY=minioadmin
```

An example CLI call will look as:

```bash
metadata backup -u openmetadata_user -p openmetadata_password \
    -h localhost -d openmetadata_db --output=dir1/dir2 \
    --upload http://localhost:9000 my-bucket backup/
```

And we'll get the following output:

```bash
Creating OpenMetadata backup for localhost:3306/openmetadata_db...
Backup stored locally under dir1/dir2/openmetadata_202201250823_backup.sql
Uploading dir1/dir2/openmetadata_202201250823_backup.sql to http://localhost:9000/my-bucket/backup/openmetadata_202201250823_backup.sql...
```

If we now head to the minio console and check the `my-backup` bucket, we'll see our SQL dump in there.

![](<../../docs/.gitbook/assets/image (70).png>)

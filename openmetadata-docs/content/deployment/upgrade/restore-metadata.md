---
title: Restore Metadata
slug: /deployment/upgrade/restore-metadata
---

# Restore Metadata

## Introduction

SQL file which is generated using Backup metadata CLI
can restore using Restore metadata CLI.

## Requirements

The restore CLI needs to be used with `openmetadata-ingestion` version 0.12.1 or higher.

## Installation

The CLI comes bundled in the base `openmetadata-ingestion` Python package. You can install it with:

```commandline
pip install openmetadata-ingestion
```


## Restore CLI

After the installation, we can take a look at the different options to run the CLI:

```commandline
> metadata restore --help
Usage: metadata restore [OPTIONS]

  Run a restore for the metadata DB.

  We can pass as many connection options as required with `-o <opt1>, -o
  <opt2> [...]` Same with connection arguments `-a <arg1>, -a <arg2> [...]`

  If `-s` or `--schema` is provided, we will trigger a Postgres Restore
  instead of a MySQL restore. This is the value of the schema containing the
  OpenMetadata tables.

Options:
  -h, --host TEXT       Host that runs the database  [required]
  -u, --user TEXT       User to run the restore backup  [required]
  -p, --password TEXT   Credentials for the user  [required]
  -d, --database TEXT   Database to restore  [required]
  --port TEXT           Database service port
  --input PATH          Local backup file path for restore  [required]
  -o, --options TEXT
  -a, --arguments TEXT
  -s, --schema TEXT
  --help                Show this message and exit.
```

### Database Connection

There is a set of four required parameters, the minimum required for us to access the database service and run the
restore: `host`, `user`, `password` and `database` to point to. Note that the user should have at least read access to the
database. By default, we'll try to connect through the port `3306`, but this can be overridden with the `--port` option.

### Output

The CLI will give messages like this `Backup restored from openmetadata_202209301715_backup.sql` when backup restored complited.

### Connection Options and Arguments

You can pass any required connection options or arguments to the MySQL connection via `-o <opt1>, -o <opt2> [...]`
or `-a <arg1>, -a <arg2> [...]`.

### Restore Postgres

If you are saving the data from Postgres, pass the argument `-s <schema>` or `--schema=<schema>` to indicate the
schema containing the OpenMetadata tables. E.g., `-s public`.

### Trying it out

An example CLI call will look as:

```commandline
metadata restore -u openmetadata_user -p openmetadata_password -h localhost -d openmetadata_db --input openmetadata_202209301715_backup.sql
```

And we'll get the following output:

```commandline
Restoring OpenMetadata backup for localhost:3306/openmetadata_db...
Backup restored from openmetadata_202209301715_backup.sql
```
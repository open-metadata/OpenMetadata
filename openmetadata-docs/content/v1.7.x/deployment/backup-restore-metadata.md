---
title: Backup Metadata
slug: /deployment/backup-restore-metadata
collate: false
---

# Backup & Restore Metadata

## Introduction

Before upgrading your OpenMetadata version we strongly recommend backing up the metadata.

The source of truth is stored in the underlying database (MySQL and Postgres supported). During each version upgrade there
is a database migration process that needs to run. It will directly attack your database and update the shape of the
data to the newest OpenMetadata release.

It is important that we backup the data because if we face any unexpected issues during the upgrade process,
you will be able to get back to the previous version without any loss.

{% note %}

You can learn more about how the migration process works [here](/deployment/upgrade/how-does-it-work).

{% /note %}

Since version 1.4.0, **OpenMetadata encourages using the builtin-tools for creating logical backups of the metadata**:

- [mysqldump](https://dev.mysql.com/doc/refman/8.0/en/mysqldump.html) for MySQL
- [pg_dump](https://www.postgresql.org/docs/current/app-pgdump.html) for Postgres

For PROD deployment we recommend users to rely on cloud services for their databases, be it [AWS RDS](https://docs.aws.amazon.com/rds/),
[Azure SQL](https://azure.microsoft.com/en-in/products/azure-sql/database) or [GCP Cloud SQL](https://cloud.google.com/sql/).

If you're a user of these services, you can leverage their backup capabilities directly:
- [Creating a DB snapshot in AWS](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/USER_CreateSnapshot.html)
- [Backup and restore in Azure MySQL](https://learn.microsoft.com/en-us/azure/mysql/single-server/concepts-backup)
- [About GCP Cloud SQL backup](https://cloud.google.com/sql/docs/mysql/backup-recovery/backups)

## Requirements

- `mysqldump` 8.3 or higher 
- `pg_dump` 13.3 or higher

If you're running the project using docker compose, the `ingestion` container already comes packaged with the
correct `mysqldump` and `pg_dump` versions ready to use.

## Storing the backup files

It's important that when you backup your database, you keep the snapshot safe in case you need in later.

You can check these two examples on how to:
- Use pipes to stream the result directly to S3 (or AWS blob storage) ([link](https://devcoops.com/pg_dump-to-s3-directly/?utm_content=cmp-true)).
- Dump to a file and copy to storage ([link](https://gist.github.com/bbcoimbra/0914c7e0f96e8ad53dfad79c64863c87)).

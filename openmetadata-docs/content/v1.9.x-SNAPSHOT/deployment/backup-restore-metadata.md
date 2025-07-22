---
title: Backup Metadata | OpenMetadata Deployment Guide
description: Back up and restore metadata to preserve lineage, classifications, descriptions, and governance data across updates or outages.
slug: /deployment/backup-restore-metadata
collate: false
---

# Backup & Restore Metadata

## Introduction

Before upgrading your OpenMetadata version we strongly recommend backing up the metadata.

The source of truth is stored in the underlying database (MySQL and Postgres supported). During each version upgrade there
is a database migration process that needs to run. It will make changes to the OpenMetadata Application schema in the database and update the shape of the data to the newest OpenMetadata release.

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

# Example with Docker

Start a local instance of OpenMetadata using the `docker-compose` file provided in the repository. Then, we can use the following commands to backup the metadata:

## MySQL

### 1. Backup and Restore

```shell
BACKUP_FILE="backup_$(date +%Y%m%d%H%M).sql"
export COMPOSE_FILE="docker/development/docker-compose.yml"
# backup
docker compose exec ingestion mysqldump --no-tablespaces -u openmetadata_user -popenmetadata_password -h mysql -P 3306 openmetadata_db > $BACKUP_FILE
# create the restore database
docker compose exec mysql  mysql -u root -ppassword -e "create database restore;"
docker compose exec mysql  mysql -u root -ppassword -e "grant all privileges on restore.* to 'openmetadata_user'@'%';"
docker compose exec mysql  mysql -u root -ppassword -e "GRANT SUPER, SYSTEM_VARIABLES_ADMIN, SESSION_VARIABLES_ADMIN ON *.* TO 'openmetadata_user'@'%';"
docker compose exec mysql  mysql -u root -ppassword -e "flush privileges;"
# restore from the backup
docker compose exec -T ingestion mysql -u openmetadata_user -popenmetadata_password -h mysql -P 3306 restore < $BACKUP_FILE
```

### 2. Restart the docker deployment with the restored database

```shell
export OM_DATABASE=restore
docker compose -f $DOCKER_COMPOSE_FILE up -d
```

## PostgreSQL

### 1. Backup and Restore

```shell
BACKUP_FILE="backup_$(date +%Y%m%d%H%M).sql"
export COMPOSE_FILE="docker/development/docker-compose-postgres.yml"
# backup
docker compose exec -e PGPASSWORD=openmetadata_password ingestion pg_dump -U openmetadata_user -h postgresql -d openmetadata_db > $BACKUP_FILE
# create the restore database
docker compose exec -e PGPASSWORD=openmetadata_password postgresql psql -U postgres -c "create database restore;"
docker compose exec -e PGPASSWORD=openmetadata_password postgresql psql -U postgres -c "ALTER DATABASE restore OWNER TO openmetadata_user;"
# restore from the backup
docker compose exec -e PGPASSWORD=openmetadata_password -T ingestion psql -U openmetadata_user -h postgresql -d restore < $BACKUP_FILE
```

### 2. Restart the docker deployment with the restored database

```shell
export OM_DATABASE=restore
docker compose -f $DOCKER_COMPOSE_FILE up -d
```
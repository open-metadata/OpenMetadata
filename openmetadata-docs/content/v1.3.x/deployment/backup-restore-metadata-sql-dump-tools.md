---
title: Backup Metadata
slug: /deployment/backup-restore-metadata-sql-dump-tools
---

# Backup & Restore Metadata

## Introduction

Since version 1.3.0, OpenMetadata's encourages using the builtin-tools for creating logical backups of the metadata:

- `mysqldump` for MySQL
- `pg_dump` for Postgres

## Requirements

- mysqldump 8.3 or higher (ingestion container is shipped with mysqldump 8.3)
- pg_dump 13.3 or higher

# Example

Start a local instance of OpenMetadata using the `docker-compose` file provided in the repository. Then, we can use the following commands to backup the metadata:

## MySQL

### 1. Start a local docker deployment

```shell
docker/run_local_docker.sh
```

Ingest some data...

### 2. Backup and Restore

```shell
BACKUP_FILE="backup_$(date +%Y%m%d%H%M).sql"
DOCKER_COMPOSE_FILE="docker/development/docker-compose.yml"
# backup
docker compose -f $DOCKER_COMPOSE_FILE exec ingestion mysqldump --set-gtid-purged=OFF --no-tablespaces -u openmetadata_user -popenmetadata_password -h mysql -P 3306 openmetadata_db > $BACKUP_FILE
# create the restore database
docker compose -f $DOCKER_COMPOSE_FILE exec mysql  mysql -u root -ppassword -e "create database restore;"
docker compose -f $DOCKER_COMPOSE_FILE exec mysql  mysql -u root -ppassword -e "grant all privileges on restore.* to 'openmetadata_user'@'%';"
docker compose -f $DOCKER_COMPOSE_FILE exec mysql  mysql -u root -ppassword -e "flush privileges;"
# restore from the backup
docker compose -f $DOCKER_COMPOSE_FILE exec -T ingestion mysql -u openmetadata_user -popenmetadata_password -h mysql -P 3306 restore < $BACKUP_FILE
```

### 3. Restart the docker deployment with the restored database

```shell
export OM_DATABASE=restore
docker compose -f $DOCKER_COMPOSE_FILE up -d
```

## PostgreSQL

### 1. Start a local docker deployment

```shell
docker/run_local_docker.sh -d postgres
```

Ingest some data...

### 2. Backup and Restore

```shell
BACKUP_FILE="backup_$(date +%Y%m%d%H%M).sql"
DOCKER_COMPOSE_FILE="docker/development/docker-compose-postgres.yml"
# backup
docker compose -f $DOCKER_COMPOSE_FILE exec -e PGPASSWORD=openmetadata_password ingestion pg_dump -U openmetadata_user -h postgresql -d openmetadata_db > $BACKUP_FILE
# create the restore database
docker compose -f $DOCKER_COMPOSE_FILE exec -e PGPASSWORD=openmetadata_password postgresql psql -U postgres -c "create database restore;"
docker compose -f $DOCKER_COMPOSE_FILE exec -e PGPASSWORD=openmetadata_password postgresql psql -U postgres -c "ALTER DATABASE restore OWNER TO openmetadata_user;"
# restore from the backup
docker compose -f $DOCKER_COMPOSE_FILE exec -e PGPASSWORD=openmetadata_password -T ingestion psql -U openmetadata_user -h postgresql -d restore < $BACKUP_FILE
```

### 3. Restart the docker deployment with the restored database

```shell
export OM_DATABASE=restore
docker compose -f $DOCKER_COMPOSE_FILE up -d
```

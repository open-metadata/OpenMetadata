---
title: Upgrade on Docker
slug: /deployment/upgrade/docker
---

# Upgrade on Docker

To run OpenMetadata with Docker, you can simply download the `docker-compose.yml` file. Optionally, we added some
Named Volumes to handle data persistence.

<Note>

You can find more details about Docker deployment [here](/deployment/docker)

</Note>

Below we have highlighted the steps needed to upgrade to the latest version with Docker. Make sure to also look [here](/deployment/upgrade/versions/012-to-013) for the specific details related to upgrading to 0.13

<Warning>

It is adviced to go through [openmetadata release notes](/deployment/upgrade#breaking-changes-from-0130-release) before starting the upgrade process.

</Warning>

### 1. Download docker-compose.yaml file

Go to [github.com/open-metadata/OpenMetadata/releases](https://github.com/open-metadata/OpenMetadata/releases). The latest release will be at the top of this page.

Download the new `docker-compose.yml` file. You can run the below command to download the file (replacing `{version}` with the correct version) or simply visit the page and download the file from your browser.
```
wget https://github.com/open-metadata/OpenMetadata/releases/download/{version}-release/docker-compose.yml
```
or if you wish to use postgres as the database
```
wget https://github.com/open-metadata/OpenMetadata/releases/download/{version}-release/docker-compose-postgres.yml
```

### 2. Backup your Data [IMPORTANT]

Make a backup of your database. You can find the steps to follow [here](/deployment/upgrade//deployment/backup-restore-metadata#backup-metadata). Please note this is an important step as it would allow you to revert to a stable state if any issues were to happen during your upgrade.

### 3. Add Volumes and Publish Ports

Update the docker compose file you just downloaded to add persistent volume for MySQL. You can follow the steps [here](/deployment/docker/volumes#docker-volumes). If you had previously configured volumes for MySQL and the ingestion container make sure the 0.13.0 compose file is referencing the correct volume so that 0.12.x data will be available when upgrading to 0.13.0.

**Note:** in 0.13.0 we are not publishing MySQL ports to the host container. If you wish to do so you will need to update the MySQL service in the compose file to have the following configuration
```yaml
services:
  mysql:
    ...
    ports:
      - "3306:3306"
    ...
```

### 5. Stop, Remove and Start your Containers
Stop and remove (without deleting volumes) the already running containers. Then run the `docker compose up -d` command on the new compose file.



### Troubleshooting
#### Permission Denied when running `metadata openmetadata-imports-migration`
If you have a `Permission Denied` error thrown when running `metadata openmetadata-imports-migration --change-config-file-path` you might need to change the permission on the `/opt/airflow/dags` folder. SSH into the ingestion container and check the permission on the folder running the below commands
```
ls -l /opt/airflow
```
```
ls -l /opt/airflow/dags
```
both the `dags` folder and the files inside `dags/` should have `airflow root` permission. if this is not the case simply run the below command
```
chown -R airflow:root /opt/airflow/dags
```

#### Broken DAGs can't load config file: Permission Denied
You might need to change the permission on the `/opt/airflow/dag_generated_config` folder. SSH into the ingestion container and check the permission on the folder running the below commands
```
ls -l /opt/airflow
```
```
ls -l /opt/airflow/dag_generated_config
```
both the `dags` folder and the files inside `dags/` should have `airflow root` permission. if this is not the case simply run the below command
```
chown -R airflow:root /opt/airflow/dag_generated_config

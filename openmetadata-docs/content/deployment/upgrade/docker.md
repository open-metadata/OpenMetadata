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

Below we have highlighted the steps needed to upgrade to the latest version with Docker. Make sure to also look [here](/deployment/upgrade/versions/011-to-012) for the specific details related to upgrading to 0.12 

<Warning>

It is adviced to go through [openmetadata release notes](/deployment/upgrade#breaking-changes-from-0121-release) before starting the upgrade process. We have introduced major stability and security changes as part of 0.12.1 OpenMetadata Release.

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

Make a backup of your database. You can find the steps to follow [here](/deployment/upgrade/backup-metadata#backup-metadata). Please note this is an important step as it would allow you to revert to a stable state if any issues were to happen during your upgrade.

### 3. Add Volumes and Publish Ports

Update the docker compose file you just downloaded to add persistent volume for MySQL. You can follow the steps [here](/deployment/docker/volumes#docker-volumes). If you had previously configured volumes for MySQL and the ingestion container make sure the 0.12.1 compose file is referencing the correct volume so that 0.11.5 data will be available when upgrading to 0.12.1.

**Note:** in 0.12.1 we are not publishing MySQL ports to the host container. If you wish to do so you will need to update the MySQL service in the compose file to have the following configuration
```yaml
services:
  mysql:
    ...
    ports:
      - "3306:3306"
    ...
```

### 4. Prepare Airflow upgrade to 2.3 (Only if upgrading from 0.11.x)

(If you are upgrading from 0.11.x to 0.12.x) In 0.12.x we are using airflow 2.3.3. There is a known issue when upgrading from airflow 2.1.x to 2.3.3. Make sure to look at the following notes [here](/deployment/upgrade/versions/011-to-012#airflow-version) for more details

### 5. Stop, Remove and Start your Containers
Stop and remove (without deleting volumes) the already running containers. Then run the `docker compose up -d` command on the new compose file.

### 6. Update DAGs config
#### 6.1 Update imports
If you are using `openmetadata/ingestion` Docker image and you've upgraded to 0.12.x reusing volumes mounted to the `openmetadata/ingestion:0.11.5` container you will need to run the `metadata openmetadata-imports-migration` command inside the `openmetadata/ingestion:0.12.x` container. Indeed, `openmetadata-airflow-managed-apis` has been renamed to `openmetadata-managed-apis` and its import from `import openmetadata` to `import openmetadata_managed_apis`. If the import paths are not updated through the `metadata` command it will result in broken DAGs. By default the command will look for DAGs stored in `/opt/airflow/dags`. If you have changed where generated DAGs are stored you can specify the path to where your DAGs are stored `metadata openmetadata-imports-migration -d <path/to/folder>`

#### 6.2 Update config file path
If you are using `openmetadata/ingestion` Docker image in 0.12.1 and migrated either from 0.12.0 or 0.11.x `dags` and `dag_generated_config` have changed path. Dags and generated config files are now stored respectively in `/opt/airflow/dags` and `/opt/airflow/dag_generated_config`. You will need to run the `metadata openmetadata-imports-migration` command with the `--change-config-file-path` inside the `openmetadata/ingestion:0.12.x` container to make sure DAGs workflow are pointing to the correct config file.

You can run 6.1 and 6.2 together using the following command `metadata openmetadata-imports-migration --change-config-file-path`.

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

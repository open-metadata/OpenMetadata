---
title: Upgrade on Docker
slug: /deployment/upgrade/docker
---

# Upgrade on Docker

To run OpenMetadata with Docker, you can simply download the `docker-compose.yml` file. Optionally, we added some
Named Volumes to handle data persistence.

{% note %}

You can find more details about Docker deployment [here](/deployment/docker)

{% /note %}

Below we have highlighted the steps needed to upgrade to the latest version with Docker. Make sure to also look [here](/deployment/upgrade/versions/012-to-013) for the specific details related to upgrading to 0.13

{% note description="Warning" %}

It is advised to go through [openmetadata release notes](/deployment/upgrade#breaking-changes-from-0130-release) before starting the upgrade process.

{% /note %}

## Upgrade from 0.13 to 1.0.0

Your production deployment should go from stable version to stable version. This translated to moving from 0.13 to 1.0.0 to get the latest stable OpenMetadata release.

Let's go through the required steps:

### 1. Backup 0.13 data

1. Make sure your instance is connected to the Database server
2. Create a virtual environment to install an upgraded `metadata` version to run the backup command:
    1. `python -m venv venv`
    2. `source venv/bin/activate`
    3. `pip install openmetadata-ingestion~=1.0.0`
3. Validate the installed `metadata` version with `python -m metadata --version`, which should tell us that we are
   indeed at 1.0.0. Notice the `python -m metadata` vs. `metadata`.
4. Run the backup using the updated `metadata` CLI:
    ```
    python -m metadata backup -u openmetadata_user -p openmetadata_password -H mysql -d openmetadata_db --port 3306
    ```
   if using Postgres:
    ```
    python -m metadata backup -u openmetadata_user -p openmetadata_password -H postgresql -d openmetadata_db --port 5432 -s public
    ```
5. This will generate the .sql file which can be used for the backup
   In our case, the backup file was named `openmetadata_202212201528_backup.sql`. You can copy the name from the backup
   command output.

### 2. Update the docker compose file

1. Stop the running compose deployment with `docker compose down`.
2. On the compose file we ran the 0.13 version, update the image tag in the `ingestion` and
   `openmetadata-server` to 1.0.0. E.g., `image: openmetadata/server:0.13.2`.
3. Start the updated compose file.
4. Run the reindex from the UI.


### 3. Restore the backup

We will now use the backup generated in the previous step to repopulate the database.

1. On your laptop/VM, prepare a virtual environment and install `openmetadata-ingestion==1.0.0`. It is important
   that the instance has access to the database.
   1. `python -m venv venv`
   2. `source venv/bin/activate`
   3. `pip install openmetadata-ingestion~=1.0.0`
2. Validate the metadata version with `metadata --version`. it should be 1.0.0.
3. Run the restore with your file name
    ```
    metadata restore -H localhost -u openmetadata_user -p openmetadata_password -d openmetadata_db --port 3306 --input openmetadata_202212201528_backup.sql
    ```
   if using Postgres:
    ```
    metadata restore -H localhost -u openmetadata_user -p openmetadata_password -d openmetadata_db --port 5432 -s public --input openmetadata_202212201528_backup.sql
    ```
4. Stop the docker compose

### 4. Upgrade OpenMetadata versions

1. On the compose file we previously updated the database settings, update the image tag in the `ingestion` and 
    `openmetadata-server` to 1.0.0. E.g., `image: openmetadata/server:1.0.0`.
2. Start the updated compose file.
3. Run the reindex from the UI.

Now you should still have all your data with OpenMetadata version 1.0.0.

## Upgrade ingestion patch versions

During the release lifespan we may publish new patch versions of `openmetadata-ingestion`. If you deployed
the ingestion container and require one of the fixes or improvements from a new patch release, there's usually no need
to re-deploy the full ingestion container.

{% note %}

Note that this process will only work if we are moving from PATCH versions. For example: `0.13.1.1` -> `0.13.1.2`.

This method won't work when upgrading from `0.13.1.X` -> `0.13.2.X`, as that will also require to upgrade the
server version.

{% /note %}

The steps to follow are:

1. Connect to the ingestion container. If using our docker compose files or `metadata docker` CLI, this translates
    to `docker exec -it openmetadata_ingestion bash`.
2. Validate your `metadata` version via `metadata --version`. You will get back something like:
   ```bash
   metadata 0.13.1.5 from /home/airflow/.local/lib/python3.9 (python 3.9)
   ```
3. Upgrade the `openmetadata-ingestion` package via `pip install "openmetadata-ingestion==0.13.1.X"`, for example,
   `pip install "openmetadata-ingestion==0.13.1.7"`. You can find the list of all released versions of
   the `openmetadata-ingestion` package [here](https://pypi.org/project/openmetadata-ingestion/#history).
4. Exit the container by typing `exit`.
5. Restart the ingestion container with `docker restart openmetadata_ingestion`. This will need a few minutes to
   to stop the container and start it again. Now, Airflow will start with the upgraded `metadata` version.
6. Connect to the ingestion container and validate the `metadata` version:
   1. `docker exec -it openmetadata_ingestion bash`
   2. `metadata version`: where we expect to get the same version that was previously installed.


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

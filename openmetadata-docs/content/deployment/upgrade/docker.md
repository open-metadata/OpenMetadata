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

It is advised to go through [openmetadata release notes](/deployment/upgrade#breaking-changes-from-0130-release) before starting the upgrade process.

</Warning>

## Upgrade from 0.13.1 to 0.13.2

Upgrading from 0.13.1 to 0.13.2 can be done easily as version 0.13.1 compose files already provided volumes for the databases.

Let's go through the required steps:

### 1. Backup 0.12.3 data

1. Make sure your instance is connected to the Database server
2. Create a virtual environment to install an upgraded `metadata` version to run the backup command:
    1. `python -m venv venv`
    2. `source venv/bin/activate`
    3. `pip install openmetadata-ingestion~=0.13.2`
3. Validate the installed `metadata` version with `python -m metadata --version`, which should tell us that we are
   indeed at 0.13.2. Notice the `python -m metadata` vs. `metadata`.
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
2. On the compose file we ran the 0.13.1 version, update the image tag in the `ingestion` and
   `openmetadata-server` to 0.13.2. E.g., `image: openmetadata/server:0.13.2`.
3. Start the updated compose file.
4. Run the reindex from the UI.

## Upgrade from 0.12.3 to 0.13.1

Your production deployment should go from stable version to stable version. This translated to moving from 0.12.3 to 0.13.1 to
get the latest stable OpenMetadata release.

Database volumes were just introduced in the 0.13.0 feature release. This means that when moving from 0.12.3 to 0.13.1, we'll
need to do some extra steps to ensure that all your metadata is safe and sound. In this section, we'll guide you step by step on
what you'll need to do to:

1. Backup your data,
2. Add volumes and port mapping to the databases and restore your data,
3. Start OpenMetadata with the 0.13.1 release.

These steps are based on MySQL, but are analogous for Postgres.

Please, validate the process in your development or staging environment first before going into PROD.


<Note>

This guide is specific to installations using the default docker compose file we shipped on the 0.12.3 release. The
whole process is about making sure that all the data will be properly backed up considering that there is no
port mapping or volumes available.

If your docker compose already had volumes for the database, then upgrading the version of OpenMetadata and the
Ingestion container should be good to go (as shown in step 4 below).

</Note>

### 1. Backup 0.12.3 data

1. Get inside the `openmetadata_ingestion` container with `docker exec -it openmetadata_ingestion bash`.
2. Create a virtual environment to install an upgraded `metadata` version to run the backup command:
   1. `python -m venv venv`
   2. `source venv/bin/activate`
   3. `PIP_USER=false pip install openmetadata-ingestion~=0.13.1.0`
3. Validate the installed `metadata` version with `python -m metadata --version`, which should tell us that we are
    indeed at 0.13.1. Notice the `python -m metadata` vs. `metadata`. As we're inside the container, the raw metadata 
    command will use the system-wide one, which is at 0.12.3.
4. Run the backup using the updated `metadata` CLI:
    ```
    python -m metadata backup -u openmetadata_user -p openmetadata_password -H mysql -d openmetadata_db --port 3306
    ```
   if using Postgres:
    ```
    python -m metadata backup -u openmetadata_user -p openmetadata_password -H postgresql -d openmetadata_db --port 5432 -s public
    ```
5. From outside the container, copy the backup file to safety. For example `docker cp openmetadata_ingestion:/opt/airflow/openmetadata_202212201528_backup.sql .`
    In our case, the backup file was named `openmetadata_202212201528_backup.sql`. You can copy the name from the backup
    command output.

### 2. Add volumes and port mapping

This step is only required if you have not done that yet.

1. Stop docker compose
2. Update the `mysql` service in the compose file so that it looks like:
    ```
    mysql:
      container_name: openmetadata_mysql
      image: openmetadata/db:0.13.1
      restart: always
      environment:
        MYSQL_ROOT_PASSWORD: password
      expose:
        - 3306
      ports:
        - "3306:3306"
      volumes:
       - ./docker-volume/db-data:/var/lib/mysql
      networks:
        - app_net
      healthcheck:
        test: mysql --user=root --password=$$MYSQL_ROOT_PASSWORD --silent --execute "use openmetadata_db"
        interval: 15s
        timeout: 10s
        retries: 10 
    ```
   Note how we added the `ports` and `volumes` sections. If you're using postgres, these would look like:
    ```
    ports:
      - "5432:5432"
    volumes:
     - ./docker-volume/db-data-postgres:/var/lib/postgresql/data
    ```
3. Start docker compose with `docker compose up` on the updated file.
   1. This will run a clean database instance with ports and volumes.
   2. The OpenMetadata server will run the 0.12.3 migrations to populate the starting tables.

### 3. Restore the backup

We will now use the backup generated in the previous step to repopulate the database.

1. On your laptop/VM, prepare a virtual environment and install `openmetadata-ingestion==0.13.1`. It is important
   that the instance has access to the database.
   1. `python -m venv venv`
   2. `source venv/bin/activate`
   3. `pip install openmetadata-ingestion~=0.13.1.0`
2. Validate the metadata version with `metadata --version`. it should be 0.13.1.
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
    `openmetadata-server` to 0.13.1. E.g., `image: openmetadata/server:0.13.1`.
2. Start the updated compose file.
3. Run the reindex from the UI.

Now you should still have all your data with OpenMetadata version 0.13.1.

## Upgrade ingestion patch versions

During the release lifespan we may publish new patch versions of `openmetadata-ingestion`. If you deployed
the ingestion container and require one of the fixes or improvements from a new patch release, there's usually no need
to re-deploy the full ingestion container.

<Note>

Note that this process will only work if we are moving from PATCH versions. For example: `0.13.1.1` -> `0.13.1.2`.

This method won't work when upgrading from `0.13.1.X` -> `0.13.2.X`, as that will also require to upgrade the
server version.

</Note>

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

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

Below we have highlighted the steps needed to upgrade to the latest version with Docker. Make sure to also look [here](/deployment/upgrade/versions/100-to-110) for the specific details related to upgrading to 1.0.0

{% partial file="/v1.2/deployment/upgrade/upgrade-prerequisites.md" /%}

# Upgrade Process

## Step 1: Replace the docker compose file

- Stop the running compose deployment with below command 
```
docker compose down
```
- Download the Docker Compose Service File from OpenMetadata GitHub Release page [here](https://github.com/open-metadata/OpenMetadata/releases/latest)
- Replace the existing Docker Compose Service File with the one downloaded from the above step

{% note %}

Please make sure to go through [breaking changes and release highlights](/deployment/upgrade/versions/100-to-110).

{% /note %}

- Start the Docker Compose Service with the below command
```
docker compose -f docker-compose.yml up -d
```

## Step 2: Re-index all your metadata

{% partial file="/v1.2/deployment/reindex.md" /%}

---

## Guide for Upgrading ingestion patch versions

During the release lifespan we may publish new patch versions of `openmetadata-ingestion`. If you deployed
the ingestion container and require one of the fixes or improvements from a new patch release, there's usually no need
to re-deploy the full ingestion container.

{% note %}

Note that this process will only work if we are moving from PATCH versions. For example: `0.13.1.1` -> `0.13.1.2`.

This method won't work when upgrading from `0.13.1.X` -> `0.13.2.X`, as that will also require to upgrade the
server version.

{% /note %}

The steps to follow are:

- Connect to the ingestion container. If using our docker compose files or `metadata docker` CLI, this translates to
   ```
     docker exec -it openmetadata_ingestion bash
     ```
- Validate your `metadata` version via ```metadata --version```. You will get back something like:
   ```
   metadata 0.13.1.5 from /home/airflow/.local/lib/python3.9 (python 3.9)
   ```
- Upgrade the `openmetadata-ingestion` package via ```pip install "openmetadata-ingestion==0.13.1.X"```,for example,
   ```
   pip install "openmetadata-ingestion==0.13.1.7" 
   ```
   You can find the list of all released versions of
   the `openmetadata-ingestion` package [here](https://pypi.org/project/openmetadata-ingestion/#history).
- Exit the container by typing `exit`.
- Restart the ingestion container with `docker restart openmetadata_ingestion`. This will need a few minutes to
   to stop the container and start it again. Now, Airflow will start with the upgraded `metadata` version.
- Connect to the ingestion container and validate the `metadata` version:
    ```
    docker exec -it openmetadata_ingestion bash
    ```
   - ```metadata version```: where we expect to get the same version that was previously installed.


## Troubleshooting

#### Permission Denied when running  ```metadata openmetadata-imports-migration```
If you have a `Permission Denied` error thrown when running ```metadata openmetadata-imports-migration --change-config-file-path``` you might need to change the permission on the `/opt/airflow/dags` folder. SSH into the ingestion container and check the permission on the folder running the below commands
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
```

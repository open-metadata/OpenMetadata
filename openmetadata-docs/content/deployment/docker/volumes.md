---
title: Docker Volumes
slug: /deployment/docker/volumes
---
## Docker Volumes
Advance section


Volumes provide the ability to connect specific filesystem paths of the container back to the host machine. If a directory or a file in the container is mounted, changes in that directory  or file can also be seen on the host machine.we are going to use a mapping of a directory present on the host macine with the container path.

<Note>

To make changes to the `docker-compose.yaml` file you will need to download it from the release page [here](https://github.com/open-metadata/OpenMetadata/releases). The latest version is at the top of the page
</Note>

## Volumes for MYSQL container:
Following are the changes we have to do while mounting the directory for mysql in OpenMetadata.
- Update or add the volume in the docker-compose.yml file
Open the file `docker-compose.yml` downloaded from the Release page [Link](https://github.com/open-metadata/OpenMetadata/releases/download/0.13.0-release/docker-compose.yml) .

```commandline
version: "3.9"
services:
  mysql:
    ...
    volumes:
      - ./docker-volume/db:/var/lib/mysql
    ...
```
## Volumes for PostgreSQL container:
Following are the changes we have to do while mounting the directory for postgresql in OpenMetadata.
- Update or add the volume in the docker-compose.yml file.
Open the file `docker-compose.yml` downloaded from the Release page [Link](https://github.com/open-metadata/OpenMetadata/releases/download/0.13.0-release/docker-compose.yml) .

```commandline
version: "3.9"
services:
 postgresql:
    ...
    volumes:
      - ./docker-volume/db:/var/lib/postgresql/data
    ...
```

## Volumes for ingestion container
Following are the changes we have to do while mounting the directory for ingestion in OpenMetadata. Here we will maintaing different directory for dag_generated_configs, dags and secrets.
- Remove the below section from the docker-compose.yml file.
Open the file `docker-compose.yml` downloaded from the Release page [Link](https://github.com/open-metadata/OpenMetadata/releases/download/0.13.0-release/docker-compose.yml) .

```commandline
volumes:
  ingestion-volume-dag-airflow:
  ingestion-volume-dags:
  ingestion-volume-tmp:
```
- Update or add the volume in the docker-compose.yml file.
Open the file `docker-compose.yml` downloaded from the Release page [Link](https://github.com/open-metadata/OpenMetadata/releases/download/0.13.0-release/docker-compose.yml) .

```commandline
version: "3.9"
services:
  ingestion:
    ...
    volumes:
      - ./docker-volume/dag_config:/opt/airflow/dag_generated_configs
      - ./docker-volume/dags:/opt/airflow/dags
      - ./docker-volume/secrets:/tmp
    ...
```

Once these changes are done in the docker-compose.yml file It should look simlarly in the below format

```commandline
version: "3.9"
services:
  mysql:
    container_name: openmetadata_mysql
    image: openmetadata/db:0.13.0
    restart: always
    environment:
      MYSQL_ROOT_PASSWORD: password
    expose:
      - 3306
    volumes:
      - ./docker-volume/db:/var/lib/mysql
    networks:
      app_net:
        ipv4_address: 172.16.240.10
  ingestion:
    container_name: openmetadata_ingestion
    image: openmetadata/ingestion:0.13.0
    depends_on:
      - mysql
    expose:
      - 8080
    ports:
      - 8080:8080
    networks:
      - app_net
    extra_hosts:
      - "localhost:172.16.240.10"
      - "localhost:172.16.240.11"
      - "localhost:172.16.240.13"
    volumes:
      - ./docker-volume/dag_config:/opt/airflow/dag_generated_configs
      - ./docker-volume/dags:/opt/airflow/dags
      - ./docker-volume/secrets:/tmp
```

Once these changes are done, restart the container via:

```commandline
docker compose down && docker compose up -d
```
<Note>
If you are starting  the OpenMetadata Docker containers using below command:
```command line
metadata docker --start
```
Then the docker volume directory will be created under the folder where the docker-compose file will be present.
</Note>

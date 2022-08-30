---
title: Docker Volumes
slug: /deployment/docker/volumes
---
## Advance section

Volumes provide the ability to connect specific filesystem paths of the container back to the host machine. If a directory or a file in the container is mounted, changes in that directory  or file can also be seen on the host machine.we are going to use a mapping of a directory present on the host macine with the container path.

## Volumes for MYSQL container:
Following are the changes we have to do while mounting the directory for mysql in OpenMetadata
- Create a directory to keep your MySQL data or files in the host machine
```commandline
mkdir -p /opt/openmetadata/db
```
- Update or add the volume in the docker-compose.yml file
Open the file `docker-compose.yml` downloaded from the Release page [Link](https://github.com/open-metadata/OpenMetadata/releases/download/x.x.x-release/docker-compose.yml) .

```commandline
version: "3.9"
services:
  mysql:
    container_name: openmetadata_mysql
    image: openmetadata/db:0.11.5
    restart: always
    environment:
      MYSQL_ROOT_PASSWORD: password
    expose:
      - 3306
    volumes:
     - /opt/openmetadata/db:/var/lib/mysql
    networks:
      app_net:
        ipv4_address: 172.16.240.10
```
## Volumes for PostgreSQL container:
Following are the changes we have to do while mounting the directory for postgressql in OpenMetadata
- Create a directory to keep your PostgresSQL data or files in the host machine
```commandline
mkdir -p /opt/openmetadata/db
```
- Update or add the volume in the docker-compose.yml file
Open the file `docker-compose.yml` downloaded from the Release page [Link](https://github.com/open-metadata/OpenMetadata/releases/download/x.x.x-release/docker-compose.yml) .

```commandline
version: "3.9"
services:
 postgressql:
    container_name: openmetadata_postgresql
    image: openmetadata/postgresql:0.11.5
    restart: always
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: password
    expose:
      - 5432
    networks:
      app_net:
        ipv4_address: 172.16.240.10
    volumes:
     - /opt/openmetadata/db:/var/lib/postgressql
    networks:
      app_net:
        ipv4_address: 172.16.240.10
```

## Volumes for ingestion container
Following are the changes we have to do while mounting the directory for ingestion in OpenMetadata. Here we will maintaing different directory for dag_generated_configs, dags and secrets.
- Create a directory to keep your ingestion data or files in the host machine
```commandline
mkdir -p /opt/openmetadata/dag_config
mkdir -p /opt/openmetadata/dags
mkdir -p /opt/openmetadata/secrets
```
- Update or add the volume in the docker-compose.yml file
Open the file `docker-compose.yml` downloaded from the Release page [Link](https://github.com/open-metadata/OpenMetadata/releases/download/x.x.x-release/docker-compose.yml) .

Once these changes are done in the docker-compose.yml file It should look simlarly in the below format

```commandline
version: "3.9"
services:
  mysql:
    container_name: openmetadata_mysql
    image: openmetadata/db:0.11.5
    restart: always
    environment:
      MYSQL_ROOT_PASSWORD: password
    expose:
      - 3306
    volumes:
     - /opt/openmetadata/db:/var/lib/mysql
    networks:
      app_net:
        ipv4_address: 172.16.240.10
  ingestion:
    container_name: openmetadata_ingestion
    image: openmetadata/ingestion:0.11.5
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
      - /opt/openmetadata/dag_config:/airflow/dag_generated_configs
      - /opt/openmetadata/dags:/ingestion/examples/airflow/dags
      - /opt/openmetadata/secrets:/tmp
```

Once these changes are done, restart the container via:

```commandline
docker compose down && docker compose up -d
```

## Advanced Section for Named Volumes
We can also use the Named Volumes with the Openmetadata Services in the `docker-compoe` file it self.
Exxample: 

Named Volume for MYSQL
```commandline
version: "3.9"
volumes:
  dbdata::
services:
  mysql:
    container_name: openmetadata_mysql
    image: openmetadata/db:0.11.5
    restart: always
    environment:
      MYSQL_ROOT_PASSWORD: password
    expose:
      - 3306
    volumes:
      - dbdata:/var/lib/mysql
    networks:
      app_net:
        ipv4_address: 172.16.240.10
```

The above configuration defined one data volume named “dbdata”, which is attached to MySQL container and mounted on /var/lib/mysql directory. This is the default directory used by MySQL to store all data files.


## Verify the Named Volumes

Running `docker volume ls` will list all the volumes which are available on the host machine.

The default path where volumes get created in Linux is as follows:

```commandline
/var/lib/docker/volumes/
```

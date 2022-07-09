---
title: Docker Volumes
slug: /deployment/docker/volumes
---

Named volumes can persist data after we restart or remove a container. Also, it’s accessible by other containers.

For example:

<Image src="/images/deployment/docker/example-volumes.png" alt="volumes"/>

Here, the first field is a unique name of the volume on a host machine. The second field is the path in the container.

Following are the changes we have to do while mounting the volume for ingestion in OpenMetadata

## Update or add the volume in the docker-compose.yml file

Open the file `docker-compose.yml` downloaded from the Release page.

First, define the volumes at the top level of the file. Example:

```commandline
volumes:
  ingestion-volume-dag-airflow:
  ingestion-volume-dags:
  ingestion-volume-tmp:
```

Then, add them in the service. Example:

```commandline
- ingestion-volume-dag-airflow:/airflow/dag_generated_configs
- ingestion-volume-dags:/airflow/dags
- ingestion-volume-tmp:/tmp
```

Once these changes are done, restart the container via:

```commandline
docker compose down && docker compose up -d
```

## Verify the Named Volumes

Running `docker volume ls` will list all the volumes which are available on the host machine.

The default path where volumes get created in Linux is as follows:

```commandline
/var/lib/docker/volumes/
```

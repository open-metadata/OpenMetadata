# Deploy OpenMetadata on Docker

{% hint style="info" %}
These instructions have been tested on MacOS, Windows 10, and Ubuntu 20.04.
{% endhint %}

## Requirements (OSX and Linux)

Please ensure that your host system meets the requirements listed below. Then continue to the procedure for installing OpenMetadata.

### Python (version 3.8.0 or greater)

Please use the following command to check the version of Python you have.

```
python3 --version
```

### Docker (version 20.10.0 or greater)

[Docker](https://docs.docker.com/get-started/overview/) is an open platform for developing, shipping, and running applications. It enables you to separate your applications from your infrastructure, so you can deliver software quickly in packages called containers, using OS-level virtualization.

Please use the following command to check the version of Docker you have.

```
docker --version
```

If you need to install Docker, please visit [Get Docker](https://docs.docker.com/get-docker/).

{% hint style="warning" %}
Note: You must **allocate at least 6 GB of memory to Docker** in order to run OpenMetadata. To change the memory allocation for Docker, please visit:

Preferences -> Resources -> Advanced
{% endhint %}



### Install Docker Compose Version 2.0.0 on Linux

Follow the [instructions here](https://docs.docker.com/compose/cli-command/#install-on-linux) to install docker compose version 2.0.0

1. Run the following command to download the current stable release of Docker Compose

```
DOCKER_CONFIG=${DOCKER_CONFIG:-$HOME/.docker}
mkdir -p $DOCKER_CONFIG/cli-plugins
curl -SL https://github.com/docker/compose/releases/download/v2.2.3/docker-compose-linux-x86_64 -o $DOCKER_CONFIG/cli-plugins/docker-compose
```

This command installs Compose V2 for the active user under `$HOME` directory. To install Docker Compose for all users on your system, replace `~/.docker/cli-plugins` with `/usr/local/lib/docker/cli-plugins`.

2\. Apply executable permissions to the binary

```
chmod +x $DOCKER_CONFIG/cli-plugins/docker-compose
```

3\. Test your installation

```
docker compose version
Docker Compose version v2.2.3
```

### `compose` Command for Docker (version v2.1.1 or greater)

The Docker `compose` package enables you to define and run multi-container Docker applications. The `compose` command integrates compose functions into the Docker platform, making them available from the Docker command-line interface (CLI). The Python packages you will install in the procedure below use `compose` to deploy OpenMetadata.

**MacOS X**: Docker on MacOS X ships with compose already available in the Docker CLI.

**Linux**: To install compose on Linux systems, please visit the [Docker CLI command documentation](https://docs.docker.com/compose/cli-command/#install-on-linux) and follow the instructions.

To verify that the `docker compose` command is installed and accessible on your system, run the following command.

```
docker compose version
```

Upon running this command you should see output similar to the following.

```
Docker Compose version v2.1.1
```

{% hint style="info" %}
Note: In the previous releases of Docker, compose functions were delivered with the `docker-compose` tool. OpenMetadata uses Compose V2. Please see the paragraphs above for instructions on installing Compose V2.
{% endhint %}

## Requirements (Windows)

### WSL2, Ubuntu 20.04, and Docker for Windows

1. Install [WSL2](https://ubuntu.com/wsl)
2. Install [Ubuntu 20.04](https://www.microsoft.com/en-us/p/ubuntu-2004-lts/9n6svws3rx71)
3. Install [Docker for Windows](https://www.docker.com/products/docker-desktop)

### In the Ubuntu Terminal

```
cd ~
sudo apt update
sudo apt upgrade
sudo apt install python3-pip  python3-venv
```

## Setup and Launch OpenMetadata

### 1. Create a directory for OpenMetadata

Create a new directory for OpenMetadata and navigate into that directory.

```
mkdir openmetadata-docker && cd openmetadata-docker
```

### 2. Download docker-compose.yaml file from latest release

Download docker-compose.yml from [OpenMetadata Releases](https://github.com/open-metadata/OpenMetadata/releases/tag/0.10.0-release)&#x20;

![](../../.gitbook/assets/docker-compose-release.jpg)

Run the following command to download the file

```
wget https://github.com/open-metadata/OpenMetadata/releases/download/0.10.0-release/docker-compose.yml
```

### 3.  Start the docker containers

```
docker compose up -d
```

This will create a docker network and four containers for the following services:

* MySQL to store the metadata catalog
* Elasticsearch to maintain the metadata index which enables you to search the catalog
* Apache Airflow which OpenMetadata uses for metadata ingestion
* The OpenMetadata UI and API server

After starting the Docker containers, you should see an output similar to the following.

```
[+] Running 5/5
 ⠿ Network ometa_network                 Created                                                                                                                                                       0.1s
 ⠿ Container openmetadata_elasticsearch  Created                                                                                                                                                       0.2s
 ⠿ Container openmetadata_mysql          Created                                                                                                                                                       0.1s
 ⠿ Container openmetadata_ingestion      Created                                                                                                                                                       0.1s
 ⠿ Container openmetadata_server         Created                                                                                                                                                       0.1s
Attaching to openmetadata_elasticsearch, openmetadata_ingestion, openmetadata_mysql, openmetadata_server
```

After the containers are up and running, it will launch Airflow tasks to ingest sample metadata and usage data to experiment with. This might take several minutes, depending on your system.

### 7.  Verify all containers are up and running&#x20;

```
docker ps 
```

After running the above command, you should see an output similar to the following.

```
CONTAINER ID   IMAGE                                                  COMMAND                  CREATED             STATUS                       PORTS                                                  NAMES
7f031f096966   local-metadata_openmetadata-server                     "./openmetadata-star…"   About an hour ago   Up About an hour             3306/tcp, 9200/tcp, 9300/tcp, 0.0.0.0:8585->8585/tcp   openmetadata_server
6f7992e02314   local-metadata_ingestion                               "./ingestion_depende…"   About an hour ago   Up About an hour             0.0.0.0:8080->8080/tcp                                 openmetadata_ingestion
ca8e590de33f   local-metadata_mysql                                   "/entrypoint.sh mysq…"   About an hour ago   Up About an hour (healthy)   0.0.0.0:3306->3306/tcp, 33060-33061/tcp                openmetadata_mysql
1f037580731e   docker.elastic.co/elasticsearch/elasticsearch:7.10.2   "/tini -- /usr/local…"   About an hour ago   Up About an hour             0.0.0.0:9200->9200/tcp, 0.0.0.0:9300->9300/tcp         openmetadata_elasticsearch

```

### 8. Begin using OpenMetadata

Finally, visit the following url to begin exploring OpenMetadata.

```
http://localhost:8585
```

You should see a page similar to the following as the landing page for the OpenMetadata server.

![](https://files.gitbook.com/v0/b/gitbook-x-prod.appspot.com/o/spaces%2F5bDjQUHl1WvoDgOnN4er%2Fuploads%2Fgit-blob-56930156f1a7b1b1da2f80f18739ffdae78c849b%2Fom-homepage.png?alt=media)

### Bind named volumes (Advanced)

Please make the following changes while mounting the volume for ingestion in OpenMetadata.

Update or add the volume in the docker-compose.yml file

```
nano OpenMetadata/docker/local-metadata/docker-compose.yml
```

We'll need to perform the two changes mentioned below.

Define the volumes at the top level of the file:

```
volumes:
  ingestion-volume-dag-airflow:
  ingestion-volume-dags:
  ingestion-volume-tmp:
```

Changes in the ingestion service:

```
- ingestion-volume-dag-airflow:/airflow/dag_generated_configs
- ingestion-volume-dags:/airflow/dags
- ingestion-volume-tmp:/tmp
```

Once these changes are done, redeploy the docker containers.

### Next Steps

1. Visit the [Features](../../overview/features.md) overview page and explore the OpenMetadata UI.
2. Visit the [Connectors](../../integrations/connectors/) documentation to see what services you can integrate with OpenMetadata.
3. Visit the [API](../../openmetadata-apis/apis/overview.md) documentation and explore the OpenMetadata APIs.

### Troubleshooting

#### Could not find a version that satisfied the requirement

```
You don't have docker-compose installed, please install it and re-run the command
```

If you come across the above error when attempting to install OpenMetadata, this can be due to an older version of docker-compose that you have, or because docker compose is not installed properly. Please check the [Requirements](deploy-openmetadata-on-docker.md#requirements) section above and confirm that you have the supported versions installed.

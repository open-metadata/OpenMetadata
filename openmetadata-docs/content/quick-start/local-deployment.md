---
title: Try OpenMetadata in Docker
slug: /quick-start/local-deployment
---

# Local Docker Deployment

This installation doc will help you start a OpenMetadata standalone instance on your local machine.

If you'd rather see the steps in a guided tutorial, we've got you covered! Otherwise, feel free to read the
content below 👇

<YouTube videoId="ld43_jafL9w" start="0:00" end="6:47"/>

## Requirements (OSX and Linux)

Please ensure your host system meets the requirements listed below. Then continue to the Procedure for installing
OpenMetadata.

<Collapse title="OSX and Linux">

### Docker (version 20.10.0 or greater)

[Docker](https://docs.docker.com/get-started/overview/) is an open-source platform for developing, shipping, and running applications. It enables you to separate your
applications from your infrastructure, so you can deliver software quickly using OS-level virtualization. It helps
deliver software in packages called Containers.

To check what version of Docker you have, please use the following command.

```commandline
docker --version
```

If you need to install Docker, please visit [Get Docker](https://docs.docker.com/get-docker/).

<Note>

You must allocate at least 6GB of memory to Docker in order to run OpenMetadata. To change the memory allocation
for Docker, please visit `Preferences -> Resources -> Advanced` in your Docker Desktop.

</Note>

### Docker Compose (version v2.1.1 or greater)

The Docker `compose` package enables you to define and run multi-container Docker applications. The compose command
integrates compose functions into the Docker platform, making them available from the Docker command-line interface (
CLI). The Python packages you will install in the procedure below use compose to deploy OpenMetadata.

- **MacOS X**: Docker on MacOS X ships with compose already available in the Docker CLI.
- **Linux**: To install compose on Linux systems, please visit the Docker CLI command documentation and follow the
  instructions.

To verify that the docker compose command is installed and accessible on your system, run the following command.

```commandline
docker compose version
```

Upon running this command you should see output similar to the following.

```commandline
Docker Compose version v2.1.1
```

### Install Docker Compose Version 2.0.0 on Linux

Follow the instructions [here](https://docs.docker.com/compose/cli-command/#install-on-linux) to install docker compose version 2.0.0

1. Run the following command to download the current stable release of Docker Compose
    ```
    DOCKER_CONFIG=${DOCKER_CONFIG:-$HOME/.docker}

    mkdir -p $DOCKER_CONFIG/cli-plugins curl
    -SL https://github.com/docker/compose/releases/download/v2.2.3/docker-compose-linux-x86_64 -o
    $DOCKER_CONFIG/cli-plugins/docker-compose
    ```
   This command installs Compose V2 for the active user under $HOME directory. To install Docker Compose for all users
   on your system, replace` ~/.docker/cli-plugins` with `/usr/local/lib/docker/cli-plugins`.
2. Apply executable permissions to the binary
    ```
    chmod +x $DOCKER_CONFIG/cli-plugins/docker-compose 
    ```
3. Test your installation
    ```
    docker compose version
    > Docker Compose version v2.2.3
    ```


</Collapse>


<Collapse title="Windows">

### WSL2, Ubuntu 20.04, and Docker for Windows

- Install [WSL2](https://ubuntu.com/wsl)
- Install [Ubuntu 20.04](https://www.microsoft.com/en-us/p/ubuntu-2004-lts/9n6svws3rx71)
- Install [Docker for Windows](https://www.docker.com/products/docker-desktop)

</Collapse>


## Get the latest release and run

From your terminal:

```commandline
mkdir openmetadata && cd "$_"
wget https://github.com/open-metadata/OpenMetadata/releases/download/0.11.0-release/docker-compose.yml
docker compose up -d
```

This will start all the necessary components locally. You can validate that all containers are up
and running with `docker ps`.

```commandline
❯ docker ps
CONTAINER ID   IMAGE                                                  COMMAND                  CREATED          STATUS                    PORTS                                                            NAMES
470cc8149826   openmetadata/server:0.11.0                             "./openmetadata-star…"   45 seconds ago   Up 43 seconds             3306/tcp, 9200/tcp, 9300/tcp, 0.0.0.0:8585-8586->8585-8586/tcp   openmetadata_server
63578aacbff5   openmetadata/ingestion:0.11.0                          "./ingestion_depende…"   45 seconds ago   Up 43 seconds             0.0.0.0:8080->8080/tcp                                           openmetadata_ingestion
9f5ee8334f4b   docker.elastic.co/elasticsearch/elasticsearch:7.10.2   "/tini -- /usr/local…"   45 seconds ago   Up 44 seconds             0.0.0.0:9200->9200/tcp, 0.0.0.0:9300->9300/tcp                   openmetadata_elasticsearch
08947ab3424b   openmetadata/db:0.11.0                                 "/entrypoint.sh mysq…"   45 seconds ago   Up 44 seconds (healthy)   3306/tcp, 33060-33061/tcp                                        openmetadata_mysql
```

In a few seconds, you should be able to access the OpenMetadata UI at [http://localhost:8585](http://localhost:8585):


<Image src="/images/quickstart/docker/openmetadata.png" alt="UI"/>

## Go on a tour and start discovering the power of metadata & collaboration

![Login](/images/quickstart/tour.png)

## Next Steps

1. Visit the [Features](/overview/features) overview page and explore the OpenMetadata UI.
2. Visit the [Connectors](/openmetadata/connectors) documentation to see what services you can integrate with OpenMetadata.
3. Visit the [API](/swagger.html) documentation and explore the rich set of OpenMetadata APIs.

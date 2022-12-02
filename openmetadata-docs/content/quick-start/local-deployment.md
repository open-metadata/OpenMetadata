---
title: Try OpenMetadata in Docker
slug: /quick-start/local-deployment
---

# Local Docker Deployment

This installation doc will help you start a OpenMetadata standalone instance on your local machine.

If you'd rather see the steps in a guided tutorial, we've got you covered! Otherwise, feel free to read the
content below 👇

<YouTube videoId="ld43_jafL9w" start="0:00" end="6:47"/>

## Requirements (OSX, Linux and Windows)

Please ensure your host system meets the requirements listed below. Then continue to the Procedure for installing
OpenMetadata.

<Collapse title="OSX and Linux">

### Python (version 3.7 or greater)

To check the version of Python you have, use the following command:

```bash
python3 --version
```

### Docker (version 20.10.0 or greater)

[Docker](https://docs.docker.com/get-started/overview/) is an open-source platform for developing, shipping, and running applications. It enables you to separate your
applications from your infrastructure, so you can deliver software quickly using OS-level virtualization. It helps
deliver software in packages called Containers.

To check the version of Docker you have, use the following command.

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

    mkdir -p $DOCKER_CONFIG/cli-plugins 
    curl -SL https://github.com/docker/compose/releases/download/v2.2.3/docker-compose-linux-x86_64 -o
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
  - Once installed, please follow the steps [here](https://docs.docker.com/desktop/windows/wsl/) and complete all the pre-requisites for a seamless installation and deployment.
  - After completion of the pre-requisites, please install `python3-pip` and `python3-venv` on your Ubuntu system.
    - Command: `apt install python3-pip  python3-venv` (Ensure that you have the priviledge to install packages, if not, please use Super User.)

</Collapse>


## Procedure

### 1. Create a directory for OpenMetadata

Create a new directory for OpenMetadata and navigate into that directory.

```bash
mkdir openmetadata-docker && cd openmetadata-docker
```

### 2. Create a Python virtual environment

Create a virtual environment to avoid conflicts with other Python environments on your host system. 
A virtual environment is a self-contained directory tree that contains a Python installation for a particular version 
of Python, plus a number of additional packages.

In a later step you will install the `openmetadata-ingestion` Python module and its dependencies in this virtual environment.

```bash
python3 -m venv env
```

### 3. Activate the virtual environment

```bash
source env/bin/activate
```

### 4. Upgrade pip and setuptools

```bash
pip3 install --upgrade pip setuptools
```

### 5. Install the OpenMetadata Python module using pip

```bash
pip3 install --upgrade "openmetadata-ingestion[docker]"
```

### 6. Ensure the module is installed and ready for use

```bash
metadata docker --help
```

After running the command above, you should see output similar to the following.

```
❯ metadata docker --help
Usage: metadata docker [OPTIONS]

  Checks Docker Memory Allocation Run Latest Release Docker - metadata docker
  --start Run Local Docker - metadata docker --start -f path/to/docker-
  compose.yml

Options:
  --start                         Start release docker containers
  --stop                          Stops openmetadata docker containers
  --pause                         Pause openmetadata docker containers
  --resume                        Resume/Unpause openmetadata docker
                                  containers
  --clean                         Stops and remove openmetadata docker
                                  containers along with images, volumes,
                                  networks associated
  -f, --file-path FILE            Path to Local docker-compose.yml
  -env-file, --env-file-path FILE
                                  Path to env file containing the environment
                                  variables
  --reset-db                      Reset OpenMetadata Data
  --ingest-sample-data            Enable the sample metadata ingestion
  --help                          Show this message and exit.
```

### 7. Start the OpenMetadata Docker containers

```bash
metadata docker --start
```

This will create a docker network and four containers for the following services:
- MySQL to store the metadata catalog
- Elasticsearch to maintain the metadata index which enables you to search the catalog
- Apache Airflow which OpenMetadata uses for metadata ingestion
- The OpenMetadata UI and API server 

After starting the Docker containers, you should see an output similar to the following.

```
[2021-11-18 15:53:52,532] INFO     {metadata.cmd:202} - Running Latest Release Docker
[+] Running 5/5
 ⠿ Network tmp_app_net                  Created                                                                                        0.3s
 ⠿ Container tmp_mysql_1                Started                                                                                       1.0s
 ⠿ Container tmp_elasticsearch_1        Started                                                                                       1.0s
 ⠿ Container tmp_ingestion_1            Started                                                                                       2.1s
 ⠿ Container tmp_openmetadata-server_1  Started                                                                                       2.2s
[2021-11-18 15:53:55,876] INFO     {metadata.cmd:212} - Time took to get containers running: 0:00:03.124889
.......
```

After starting the containers, `metadata` will launch Airflow tasks to ingest sample metadata and usage data for you to 
experiment with. This might take several minutes, depending on your system.

<Note>

- `metadata docker --stop` will stop the Docker containers.
- `metadata docker --clean` will clean/prune the containers, volumes, and networks. You will need to run this if
    you are updating the OpenMetadata version. Note that it will get rid of the data. If you want to keep it,
    you will need to [Backup your data](/deployment/backup-restore-metadata).

</Note>

#### Running with Postgres

From 0.12, OpenMetadata also supports Postgres local deployment out of the box!

You just need to run:

```bash
metadata docker --start -db postgres
```

Note that the option `-db postgres` needs to be passed to the other commands as well to locate the proper compose file.

### 8. Wait for metadata ingestion to finish
˚
Once metadata ingestion has finished and the OpenMetadata UI is ready for use, you will see output similar to the following.

```
✅  OpenMetadata is up and running

Open http://localhost:8585 in your browser to access OpenMetadata..

To checkout Ingestion via Airflow, go to http://localhost:8080
(username: admin, password: admin)

We are available on Slack , https://slack.open-metadata.org/ . Reach out to us if you have any questions.

If you like what we are doing, please consider giving us a star on github at https://github.com/open-metadata/OpenMetadata.
It helps OpenMetadata reach wider audience and helps our community.
```

<Tip>

The `metadata` CLI is very useful for quickly testing when getting started or wanting to try out a new release.

If you had already set up a release and are trying to test a new one, you might need to run `metadata docker --clean`
to clean up the whole environment and pick up the new ingredients from a fresh start.

</Tip>

<Image src="/images/quickstart/docker/openmetadata.png" alt="UI"/>

## Go on a tour and start discovering the power of metadata & collaboration

<Image src="/images/quickstart/tour.png" alt="tour"/>

## Log in to Airflow

OpenMetadata ships with an Airflow container to run the ingestion workflows that have been deployed
via the UI.

In the Airflow, you will also see some sample DAGs that will ingest sample data and serve as an example.

You can access Airflow at [http://localhost:8080](http://localhost:8080). Use the following credentials to log in to Airflow.
- Username: `admin`
- Password: `admin`

## Security

Please follow our [Enable Security Guide](/deployment/docker/security) to configure security for your OpenMetadata
installation.

## Advanced

If you want to persist your data, prepare [Named Volumes](/deployment/docker/volumes) for the containers.

## Next Steps

1. Visit the [Features](/overview/features) overview page and explore the OpenMetadata UI.
2. Visit the [Connectors](/connectors) documentation to see what services you can integrate with
   OpenMetadata.
3. Visit the [API](/swagger.html) documentation and explore the rich set of OpenMetadata APIs.

## Troubleshooting

### Compose is not a docker command

If you are getting an error such as `"compose" is not a docker command`, you might need to revisit the
installation steps above to make sure that Docker Compose is properly added to your system.

### metadata CLI issues

Are you having trouble starting the containers with the `metadata` CLI? While that process is recommended,
you can always run `docker compose` manually after picking up the latest `docker-compose.yml` file from the release:

```commandline
mkdir openmetadata && cd "$_"
wget https://github.com/open-metadata/OpenMetadata/releases/download/{version}-release/docker-compose.yml
docker compose up -d
```

This snippet will create a directory named `openmetadata` and download the `docker-compose.yml` file automatically.
Afterwards, it will start the containers. If instead you want to download the file manually to another location,
you can do so from the Releases [page](https://github.com/open-metadata/OpenMetadata/releases).

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

### Network openmetadata_app_net Error

You might see something like:

```
The docker command executed was `/usr/local/bin/docker compose --file /var/folders/bl/rm5dhdf127ngm4rr40hvhbq40000gn/T/docker-compose.yml --project-name openmetadata up --detach`.
It returned with code 1
The content of stdout can be found above the stacktrace (it wasn't captured).
The content of stderr is 'Network openmetadata_app_net  Creating
Network openmetadata_app_net  Error
failed to create network openmetadata_app_net: Error response from daemon: Pool overlaps with other one on this address space
```

A common solution is to run `docker network prune`:

```
WARNING! This will remove all custom networks not used by at least one container.
```

So be careful if you want to keep up some (unused) networks from your laptop.

### Connect to a Container from the Host

Do you want to connect to a container from the host [Refer](https://docs.docker.com/desktop/networking/#i-want-to-connect-from-a-container-to-a-service-on-the-host)

### After upgrading OpenMetadata version

If you're running the `metadata docker --start` after updating the `openmetadata-ingestion` package to a newer
OpenMetadata release, you might encounter issues. For example, 
`java.lang.ClassNotFoundException: org.openmetadata.service.security.NoopAuthorizer` when updating from 0.11.

Then, you'll need to first run `metadata docker --clean`. It will clean/prune the containers, volumes, and networks,
and download the newest docker compose file from the release. **Note that this will get rid of the data**. If you want to keep it,
you will need to [Backup your data](/deployment/backup-restore-metadata). This command is required after each time you
want to update your quickstart deployment of OpenMetadata with a new release to pick up the new compose file.

---
description: >-
  This page provides instructions on how to install OpenMetadata and Prefect on
  your local machine.
---

# OpenMetadata & Prefect

## Requirements (OSX and Linux)

Please ensure your host system meets the requirements listed below. Then continue to the procedure for installing OpenMetadata.

<details>

<summary>OSX and Linux</summary>

**Python (version 3.8.0 or greater)**

To check what version of Python you have, please use the following command.

```
python3 --version
```

**Docker (version 20.10.0 or greater)**

[Docker](https://docs.docker.com/get-started/overview/) is an open source platform for developing, shipping, and running applications. It enables you to separate your applications from your infrastructure, so you can deliver software quickly using OS-level virtualization. It helps deliver software in packages called Containers.

To check what version of Docker you have, please use the following command.

```
docker --version
```

If you need to install Docker, please visit [Get Docker](https://docs.docker.com/get-docker/).

**Note:** You must **allocate at least 6GB of memory to Docker** in order to run OpenMetadata. To change the memory allocation for Docker, please visit:

Preferences -> Resources -> Advanced

**`compose` command for Docker (version v2.1.1 or greater)**

The Docker `compose` package enables you to define and run multi-container Docker applications. The `compose` command integrates compose functions into the Docker platform, making them available from the Docker command-line interface (CLI). The Python packages you will install in the procedure below use `compose` to deploy OpenMetadata.

**MacOS X**: Docker on MacOS X ships with compose already available in the Docker CLI.

**Linux**: To install compose on Linux systems, please visit the [Docker CLI command documentation](https://docs.docker.com/compose/cli-command/#install-on-linux) and follow the instructions.

To verify that the `docker compose` command is installed and accessible on your system, run the following command.

```bash
docker compose version
```

Upon running this command you should see output similar to the following.

```bash
Docker Compose version v2.1.1
```

**Note:** In previous releases of Docker compose functions were delivered with the `docker-compose` tool. OpenMetadata uses Compose V2. Please see the paragraphs above for instructions on installing Compose V2.

**Install Docker Compose Version 2.0.0 on Linux**

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

</details>

<details>

<summary>Windows</summary>

**WSL2, Ubuntu 20.04, and Docker for Windows**

1. Install [WSL2](https://ubuntu.com/wsl)
2. Install [Ubuntu 20.04](https://www.microsoft.com/en-us/p/ubuntu-2004-lts/9n6svws3rx71)
3. Install [Docker for Windows](https://www.docker.com/products/docker-desktop)

**In the Ubuntu Terminal**

```
cd ~
sudo apt update
sudo apt upgrade
sudo apt install python3-pip  python3-venv
```

Follow the [OSX instructions](run-openmetadata.md#1.-create-a-directory-for-openmetadata)

</details>

***

## Installation Process

This documentation page will walk you through the process of configuring OpenMetadata and [Prefect 2.0](https://www.prefect.io/blog/introducing-prefect-2-0/). It is intended as a minimal viable setup to get you started using both platforms together. Once you want to move to a production-ready deployment, check the last two sections of this tutorial.

### 1. Clone the `prefect-openmetadata` repository

First, clone the latest version of the [prefect-openmetadata](https://github.com/PrefectHQ/prefect-openmetadata) Prefect Collection.

Then, navigate to the directory `openmetadata-docker` containing the `docker-compose.yml` file with the minimal requirements to get started with OpenMetadata.

### 2. Start OpenMetadata containers

You can start the containers with OpenMetadata components using:

```yaml
docker compose up -d
```

This will create a docker **network** and **containers** with the following services:

* `openmetadata_mysql` - Metadata store that serves as a persistence layer holding your metadata.
* `openmetadata_elasticsearch` - Indexing service to search the metadata catalog.
* `openmetadata_server` - The OpenMetadata UI and API server allowing you to discover insights and interact with your metadata.

Wait a couple of minutes until the setup is finished.

To check the status of all services, you may run the `docker compose ps` command to investigate the status of all Docker containers:

```yaml
NAME                         COMMAND                  SERVICE               STATUS              PORTS
openmetadata_elasticsearch   "/tini -- /usr/local…"   elasticsearch         running             0.0.0.0:9200->9200/tcp, 0.0.0.0:9300->9300/tcp
openmetadata_mysql           "/entrypoint.sh mysq…"   mysql                 running (healthy)   33060-33061/tcp
openmetadata_server          "./openmetadata-star…"   openmetadata-server   running             0.0.0.0:8585->8585/tcp
```

### 3. Confirm you can access the OpenMetadata UI

Visit the following URL to confirm that you can access the UI and start exploring OpenMetadata:

```
http://localhost:8585
```

You should see a page similar to the following as the landing page for the OpenMetadata UI.

![](../.gitbook/assets/landing-page.png)

### 4. Install `prefect-openmetadata`

Before running the commands below to install Python libraries, we recommend creating a **virtual environment** with a Python virtual environment manager such as pipenv, conda or virtualenv.

You can install the Prefect OpenMetadata package using a single command:

```
pip install prefect-openmetadata
```

This will already include Prefect 2.0 - both the client library, as well as an embedded API server and UI, which can _optionally_ be started using:

```
prefect orion start
```

If you navigate to the URL, you’ll be able to access a locally running Prefect Orion UI:

```
http://localhost:4200
```

Apart from Prefect, `prefect-openmetadata` comes prepackaged with the `openmetadata-ingestion[docker]` library for metadata ingestion. This library contains everything you need to turn your JSON ingestion specifications into workflows that will:

* scan your source systems,
* figure out which metadata needs to be ingested,
* load the requested metadata into your OpenMetadata backend.

### 5. Prepare your metadata ingestion spec

If you followed the first step of this tutorial, then you cloned the `prefect-openmetadata` repository. This repository contains a directory **example-data** which you can use to ingest sample data into your `OpenMetadata` backend using Prefect.

[This documentation page](https://prefecthq.github.io/prefect-openmetadata/run\_ingestion\_flow/) contains an example configuration you can use in your flow to ingest that sample data.

### 6. Run ingestion workflow locally

Now you can paste the config from above as a string into your flow definition and run it. [This documentation page](https://prefecthq.github.io/prefect-openmetadata/run\_ingestion\_flow/) explains in detail how that works.

In short, we only have to:

1. Import the flow function,
2. Pass the config as a string.

You can run the workflow as any Python function. No DAGs and no boilerplate.

After running your flow, you should see **new users**, **datasets**, **dashboards,** and other **metadata** in your OpenMetadata UI. Also, **your Prefect UI** will display the workflow run and will show the logs with details on which source system has been scanned and which data has been ingested.

If you haven't started the Prefect Orion UI yet, you can do that from your CLI:

```
prefect orion start
```

If you navigate to the URL [http://localhost:4200](http://localhost:4200/), you’ll be able to:

* access a locally running Prefect Orion UI
* see all previously triggered ingestion workflow runs.

**Congratulations** on building your first metadata ingestion workflow with OpenMetadata and Prefect! In the next section, we'll look at how you can run this flow on schedule.

### 7. Schedule and deploy your metadata ingestion flows with Prefect

Ingesting your data via manually executed scripts is great for initial exploration, but in order to build a reliable metadata platform, you need to run those workflows on a regular cadence. That’s where you can leverage Prefect [schedules](https://orion-docs.prefect.io/concepts/schedules/) and [deployments](https://orion-docs.prefect.io/concepts/deployments/).

[This documentation page](https://prefecthq.github.io/prefect-openmetadata/schedule\_ingestion\_flow/) demonstrates how you can configure a `DeploymentSpec` to deploy your flow and ensure that your metadata gets refreshed on schedule.

## 8. Deploy the execution layer to run your flows

So far, we’ve looked at how you can **create** and **schedule** your workflow; but where does this code actually run? This is a place where the concepts of [storage](https://orion-docs.prefect.io/concepts/storage/), [work queues, and agents](https://orion-docs.prefect.io/concepts/work-queues/) become important. But don’t worry - all you need to know to get started is running one CLI command for each of those concepts.

**1) Storage**

Storage is used to tell Prefect where your workflow code lives. To configure storage, run:

```python
prefect storage create
```

The CLI will guide you through the process to select the storage of your choice - to get started you can select the Local Storage and choose some path in your file system. You can then directly select it as your default storage.

**2) Work Queue**

Work queues collect scheduled runs and agents pick those up from the queue. To create a default work queue, run:

```python
prefect work-queue create default
```

**3) Agent**

Agents are lightweight processes that poll their work queues for scheduled runs and execute workflows on the infrastructure you specified on the `DeploymentSpec`’s `flow_runner`. To create an agent corresponding to the default work queue, run:

```python
prefect agent start default
```

That’s all you need! Once you have executed those three commands, your scheduled deployments (_such as the one we defined using `ingestion_flow.py` above_) are now scheduled, and Prefect will ensure that your metadata stays up-to-date.

You can observe the state of your metadata ingestion workflows from the [Prefect Orion UI](https://orion-docs.prefect.io/ui/overview/). The UI will also include detailed logs showing which metadata got updated to ensure your data platform remains healthy and observable.

## 9. Using Prefect 2.0 in the Cloud

If you want to move beyond this local installation, you can deploy Prefect 2.0 to run your OpenMetadata ingestion workflows by:

* Self-hosting the orchestration layer - see the [list of resources on Prefect Discourse](https://discourse.prefect.io/t/how-to-self-host-prefect-2-0-orchestration-layer-list-of-resources-to-get-started/952), or
* Signing up for [Prefect Cloud 2.0](https://beta.prefect.io/) - [the following page](https://discourse.prefect.io/t/how-to-get-started-with-prefect-cloud-2-0/539) will walk you through the process.

For various deployment options of OpenMetadata, check the “Deploy” section of [this documentation](https://docs.open-metadata.org/).

## 10. Questions about using OpenMetadata with Prefect

If you have any questions about configuring Prefect, post your question on [Prefect Discourse](https://discourse.prefect.io/) or in the [Prefect Community Slack](https://www.prefect.io/slack/).

And if you need support for OpenMetadata, get in touch on [OpenMetadata Slack](https://slack.open-metadata.org).

***

### Troubleshooting

#### Could not find a version that satisfied the requirement

```
ERROR: Could not find a version that satisfies the requirement openmetadata-ingestion[docker] (from versions: none)
ERROR: No matching distribution found for openmetadata-ingestion[docker]
```

If you see the above when attempting to install `prefect-openmetadata`, this can be due to using an older version of Python and pip. Please check the [Requirements](run-openmetadata.md#requirements) section above and confirm that you have supported versions installed.

## Next Steps

1. Visit the [Features](features.md) overview page and explore the OpenMetadata UI.
2. Visit the [Connectors](../integrations/connectors/) documentation to see what services you can integrate with OpenMetadata.
3. Visit the [API](../metadata-standard/apis/overview.md) documentation and explore the OpenMetadata APIs.

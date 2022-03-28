---
description: How to install OpenMetadata ingestion modules to an existing Airflow host.
---

# Custom Airflow Installation

If you already have an Airflow instance up and running, you might want to reuse it to host the metadata workflows as well. This page will guide you on the different aspects to consider when configuring an existing Airflow.

There are three different angles here:

1. Installing the ingestion modules directly on the host to enable the [Airflow Lineage Backend](airflow-lineage.md).
2. Installing connector modules on the host to run specific workflows.
3. Installing the Airflow APIs to enable the workflow deployment through the UI.

Depending on what you wish to use, you might just need some of these installations. Note that the installation commands shown below need to be run in the **Airflow instances**.

## Airflow Lineage Backend

Goals:

* Ingest DAGs and Tasks as Pipeline Entities when they run.
* Track DAG and Task status.
* Document lineage as code directly on the DAG definition and ingest it when the DAGs run.

You can find the full information in [Airflow Lineage Backend](airflow-lineage.md). But as a quick summary, you need to

{% tabs %}
{% tab title="Install Using PyPI" %}
```bash
pip install "openmetadata-ingestion[airflow-container]"
```
{% endtab %}
{% endtabs %}

What this does is add the full core `openmetadata-ingestion` package plus some version alignments for a few libraries to make everything compatible with Airflow.

> If you see any `pip` errors when running this command due to `sqlalchemy`, please check that the correct version of the packages got installed. E.g., `SQLAlchemy==1.4.xx` and your `apache-airflow==2.x.y`. We are waiting for Airflow to remove the upper constraint on `sqlalchemy`, but the code should be compatible as is. You can find further information [here](https://github.com/apache/airflow/pull/16630).

Afterward, you can jump into `airflow.cfg` following the [Airflow Lineage Backend](airflow-lineage.md) guide.

### Airflow 1.10.15

If running on a lower Airflow version, then you'll need to install:

{% tabs %}
{% tab title="Install Using PyPI" %}
```bash
pip install "openmetadata-ingestion[airflow-container-1.10.15]"
```
{% endtab %}
{% endtabs %}

You should either run this command or the one above, but not both, which will result in version incompatibilities. Then, follow the [Airflow Lineage Backend](airflow-lineage.md) guide to prepare the `airflow.cfg` file and configure your DAGs.

## Connector Modules

Goal:

* Ingest metadata from specific sources.

The current approach we are following here is preparing the metadata ingestion DAGs as `PythonOperator`s. This means that the packages need to be present in the Airflow instances.

> Note that we are working towards preparing specific `DockerOperator`s that will simplify this process and reduce requirements' inconsistencies in the Airflow host. We do not yet have a clear support or guide here, as it might depend on specific architectures. We are working on this and will be a part of future releases.

Then, you can just follow the guides for each [Connector](../connectors/). In the end, the installation process will look like this:

{% tabs %}
{% tab title="Install Using PyPI" %}
```bash
pip install "openmetadata-ingestion[<connector-name>]"
```
{% endtab %}
{% endtabs %}

If you have skipped the Airflow Lineage configuration, you will need to install the `airflow-container` plugin as well.

## Airflow APIs

Goal:

* Deploy metadata ingestion workflows directly from the UI.

This process consists of three steps:

1. Install the APIs module,
2. Install the required plugins, and
3. Configure the OpenMetadata server.

The goal of this module is to add some HTTP endpoints that the UI calls for deploying the Airflow DAGs. The first step can be achieved by running:

{% tabs %}
{% tab title="Install Using PyPI" %}
```bash
pip install "openmetadata-airflow-managed-apis"
```
{% endtab %}
{% endtabs %}

Then, check the Connector Modules guide above to learn how to install the `openmetadata-ingestion` package with the necessary plugins. They are necessary because even if we install the APIs, the Airflow instance needs to have the required libraries to connect to each source.

### Configure the OpenMetadata Server

Finally, you can check how to [Configure Airflow in the OpenMetadata Server](configure-airflow-in-the-openmetadata-server.md) to enable workflow deployments from the UI.

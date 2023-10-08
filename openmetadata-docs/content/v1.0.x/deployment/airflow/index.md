---
title: Airflow Deployment
slug: /deployment/airflow
---

# Airflow

This section will show you how to configure your Airflow instance to run the OpenMetadata workflows.

Moreover, we will show the required steps to connect your Airflow instance to the OpenMetadata server
so that you can deploy with the OpenMetadata UI directly to your instance.

1. If you do not have an Airflow service up and running on your platform, we provide a custom 
   [Docker](https://hub.docker.com/r/openmetadata/ingestion) image, which already contains the OpenMetadata ingestion
   packages and custom [Airflow APIs](https://github.com/open-metadata/openmetadata-airflow-apis) to
   deploy Workflows from the UI as well.
2. If you already have Airflow up and running and want to use it for the metadata ingestion, you will 
   need to install the ingestion modules to the host. You can find more information on how to do this 
   in the Custom Airflow Installation section.

## Custom Airflow Installation

{% note %}
Note that the `openmetadata-ingestion` only supports Python versions 3.7, 3.8 and 3.9.
{% /note %}

If you already have an Airflow instance up and running, you might want to reuse it to host the metadata workflows as
well. Here we will guide you on the different aspects to consider when configuring an existing Airflow.

There are three different angles here:

1. Installing the ingestion modules directly on the host to enable the [Airflow Lineage Backend](/connectors/pipeline/airflow/lineage-backend).
2. Installing connector modules on the host to run specific workflows. 
3. Installing the Airflow APIs to enable the workflow deployment through the UI.

Depending on what you wish to use, you might just need some of these installations. Note that the installation
commands shown below need to be run in the Airflow instances.

### Airflow Lineage Backend

Goals:

- Ingest DAGs and Tasks as Pipeline Entities when they run.
- Track DAG and Task status. 
- Document lineage as code directly on the DAG definition and ingest it when the DAGs run.

Get the necessary information to install and extract metadata from the Lineage Backend [here](/connectors/pipeline/airflow/lineage-backend).

### Connector Modules

Goal:

- Ingest metadata from specific sources.

The current approach we are following here is preparing the metadata ingestion DAGs as `PythonOperators`. This means that
the packages need to be present in the Airflow instances.

You will need to install:

```python
pip3 install "openmetadata-ingestion[<connector-name>]==x.y.z"
```

And then run the DAG as explained in each [Connector](/connectors), where `x.y.z` is the same version of your
OpenMetadata server. For example, if you are on version 1.0.0, then you can install the `openmetadata-ingestion`
with versions `1.0.0.*`, e.g., `1.0.0.0`, `1.0.0.1`, etc., but not `1.0.1.x`.

### Airflow APIs

{% note %}

Note that these steps are required if you are reusing a host that already has Airflow installed.

The `openmetadata-ingestion-apis` has a dependency on `apache-airflow>=2.2.2`. Please make sure that
your host satisfies such requirement. Only installing the `openmetadata-ingestion-apis` won't result
in a proper full Airflow installation. For that, please follow the Airflow [docs](https://airflow.apache.org/docs/apache-airflow/stable/installation/index.html).

{% /note %}

Goal:

- Deploy metadata ingestion workflows directly from the UI.

This process consists of three steps:

1. Install the APIs module,
2. Install the `openmetadata-ingestion` library and any extras you might need, and
3. Configure the OpenMetadata server.

The goal of this module is to add some HTTP endpoints that the UI calls for deploying the Airflow DAGs.
The first step can be achieved by running:

```python
pip3 install "openmetadata-managed-apis==x.y.z"
```

Then, check the Connector Modules guide above to learn how to install the `openmetadata-ingestion` package with the
necessary plugins. They are necessary because even if we install the APIs, the Airflow instance needs to have the
required libraries to connect to each source.

Here, the same versioning logic applies: `x.y.z` is the same version of your
OpenMetadata server. For example, if you are on version 1.0.0, then you can install the `openmetadata-managed-apis`
with versions `1.0.0.*`, e.g., `1.0.0.0`, `1.0.0.1`, etc., but not `1.0.1.x`.

### AIRFLOW_HOME

The APIs will look for the `AIRFLOW_HOME` environment variable to place the dynamically generated DAGs. Make
sure that the variable is set and reachable from Airflow.

### Airflow APIs Basic Auth

Note that the integration of OpenMetadata with Airflow requires Basic Auth in the APIs. Make sure that your
Airflow configuration supports that. You can read more about it [here](https://airflow.apache.org/docs/apache-airflow/stable/security/api.html).

A possible approach here is to update your `airflow.cfg` entries with:

```
[api]
auth_backends = airflow.api.auth.backend.basic_auth
```

### Configure in the OpenMetadata Server

After installing the Airflow APIs, you will need to update your OpenMetadata Server.

The OpenMetadata server takes all its configurations from a YAML file. You can find them in our [repo](https://github.com/open-metadata/OpenMetadata/tree/main/conf). In
`openmetadata.yaml`, update the `pipelineServiceClientConfiguration` section accordingly.

```yaml
# For Bare Metal Installations
[...]

pipelineServiceClientConfiguration:
  className: ${PIPELINE_SERVICE_CLIENT_CLASS_NAME:-"org.openmetadata.service.clients.pipeline.airflow.AirflowRESTClient"}
  apiEndpoint: ${PIPELINE_SERVICE_CLIENT_ENDPOINT:-http://localhost:8080}
  metadataApiEndpoint: ${SERVER_HOST_API_URL:-http://localhost:8585/api}
  hostIp: ${PIPELINE_SERVICE_CLIENT_HOST_IP:-""}
  verifySSL: ${PIPELINE_SERVICE_CLIENT_VERIFY_SSL:-"no-ssl"} # Possible values are "no-ssl", "ignore", "validate"
  sslConfig:
    validate:
      certificatePath: ${PIPELINE_SERVICE_CLIENT_SSL_CERT_PATH:-""} # Local path for the Pipeline Service Client

  # Default required parameters for Airflow as Pipeline Service Client
  parameters:
    username: ${AIRFLOW_USERNAME:-admin}
    password: ${AIRFLOW_PASSWORD:-admin}
    timeout: ${AIRFLOW_TIMEOUT:-10}

[...]
```

If using Docker, make sure that you are passing the correct environment variables:

```env
PIPELINE_SERVICE_CLIENT_ENDPOINT: ${PIPELINE_SERVICE_CLIENT_ENDPOINT:-http://ingestion:8080}
SERVER_HOST_API_URL: ${SERVER_HOST_API_URL:-http://openmetadata-server:8585/api}
```

If using Kubernetes, make sure that you are passing the correct values to Helm Chart:

```yaml
# Custom OpenMetadata Values.yaml
global:
   airflow:
    enabled: true
    # endpoint url for airflow
    host: http://openmetadata-dependencies-web.default.svc.cluster.local:8080
    auth:
      username: admin
      password:
        secretRef: airflow-secrets
        secretKey: openmetadata-airflow-password
```

#### Validating the installation

What we need to verify here is that the OpenMetadata server can reach the Airflow APIs endpoints 
(wherever they live: bare metal, containers, k8s pods...). One way to ensure that is to connect to the deployment
hosting your OpenMetadata server and running a query against the `/health` endpoint. For example:

```bash
$ curl -XGET ${PIPELINE_SERVICE_CLIENT_ENDPOINT}/api/v1/openmetadata/health
{"status": "healthy", "version": "x.y.z"}
```

It is important to do this validation passing the command as is (i.e., `curl -XGET ${PIPELINE_SERVICE_CLIENT_ENDPOINT}/api/v1/openmetadata/health`)
and allowing the environment to do the substitution for you. That's the only way we can be sure that the setup is
correct.

#### More validations in the installation

If you have an existing DAG in Airflow, you can further test your setup by running the following:

```bash
curl -XPOST http://localhost:8080/api/v1/openmetadata/enable --data-raw '{"dag_id": "example_bash_operator"}' -u "admin:admin" --header 'Content-Type: application/json'
```

Note that in this example we are assuming:
- There is an Airflow instance running at `localhost:8080`,
- There is a user `admin` with password `admin`
- There is a DAG named `example_bash_operator`.

A generic call would look like:

```bash
curl -XPOST <PIPELINE_SERVICE_CLIENT_ENDPOINT>/api/v1/openmetadata/enable --data-raw '{"dag_id": "<DAG name>"}' -u "<user>:<password>" --header 'Content-Type: application/json'
```

Please update it accordingly.

## Git Sync?

One recurrent question when setting up Airflow is the possibility of using [git-sync](https://airflow.apache.org/docs/helm-chart/stable/manage-dags-files.html#mounting-dags-from-a-private-github-repo-using-git-sync-sidecar) 
to manage the ingestion DAGs.

Let's remark the differences between `git-sync` and what we want to achieve by installing our custom API plugins:
1. `git-sync` will use Git as the source of truth for your DAGs. Meaning, any DAG you have on Git will eventually be used and scheduled in Airflow.
2. With the `openmetadata-managed-apis` we are using the OpenMetadata server as the source of truth. We are enabling dynamic DAG
  creation from the OpenMetadata into your Airflow instance every time that you create a new Ingestion Workflow.

Then, should you use `git-sync`?

- If you have an existing Airflow instance, and you want to build and maintain your own ingestion DAGs ([example](https://docs.open-metadata.org/v1.0/connectors/database/snowflake/airflow#2.-prepare-the-ingestion-dag)),
then you can go for it.
- If instead, you want to use the full deployment process from OpenMetadata, `git-sync` would not be the right tool, since the DAGs won't be backed up by Git, but rather created from OpenMetadata. Note that if anything
  would to happen where you might lose the Airflow volumes, etc. You can just redeploy the DAGs from OpenMetadata.

## SSL

If you want to learn how to set up Airflow using SSL, you can learn more here:

{% inlineCalloutContainer %}
  {% inlineCallout
    color="violet-70"
    icon="luggage"
    bold="Airflow SSL"
    href="/deployment/security/enable-ssl/airflow" %}
      Learn how to configure Airflow with SSL.
  {% /inlineCallout %}
{% /inlineCalloutContainer %}

# Troubleshooting

## Ingestion Pipeline deployment issues

### Airflow APIs Not Found

Validate the installation, making sure that from the OpenMetadata server you can reach the Airflow host, and the
call to `/health` gives us the proper response:

```bash
$ curl -XGET ${PIPELINE_SERVICE_CLIENT_ENDPOINT}/api/v1/openmetadata/health
{"status": "healthy", "version": "x.y.z"}
```

Also, make sure that the version of your OpenMetadata server matches the `openmetadata-ingestion` client version installed in Airflow.

### GetServiceException: Could not get service from type XYZ

In this case, the OpenMetadata client running in the Airflow host had issues getting the service you are trying to
deploy from the API. Note that once pipelines are deployed, the auth happens via the `ingestion-bot`. Here there are
a couple of points to validate:

1. The JWT of the ingestion bot is valid. You can check services such as https://jwt.io/ to help you
    review if the token is expired or if there are any configuration issues.
2. The `ingestion-bot` does not have the proper role. If you go to `<openmetadata-server>/bots/ingestion-bot`, the bot
    should present the `Ingestion bot role`. You can validate the role policies as well to make sure they were not
    updated and the bot can indeed view and access services from the API.
3. Run an API call for your service to verify the issue. An example trying to get a database service would look like follows:
    ```
    curl -XGET 'http://<server>:8585/api/v1/services/databaseServices/name/<service name>' \
    -H 'Accept: application/json' -H 'Authorization: Bearer <token>'
    ```
   If, for example, you have an issue with the roles you would be getting a message similar to:
    ```
    {"code":403,"message":"Principal: CatalogPrincipal{name='ingestion-bot'} operations [ViewAll] not allowed"}
    ```

### ClientInitializationError

The main root cause here is a version mismatch between the server and the client. Make sure that the `openmetadata-ingestion`
python package you installed on the Airflow host has the same version as the OpenMetadata server. For example, to set up
OpenMetadata server 0.13.2 you will need to install `openmetadata-ingestion~=0.13.2`. Note that we are validating
the version as in `x.y.z`. Any differences after the PATCH versioning are not taken into account, as they are usually
small bugfixes on existing functionalities.

### 401 Unauthorized

If you get this response during a `Test Connection` or `Deploy`:

```
airflow API returned Unauthorized and response 
{ "detail": null, "status": 401, "title": "Unauthorized", "type": "https://airflow.apache.org/docs/apache-airflow/2.3.3/stable-rest-api-ref.html#section/Errors/Unauthenticated" }
```

This is a communication issue between the OpenMetadata Server and the Airflow instance. You are able to reach the
Airflow host, but your provided user and password are not correct. Note the following section of the server configuration:

```yaml
pipelineServiceClientConfiguration:
    [...]
    parameters:
        username: ${AIRFLOW_USERNAME:-admin}
        password: ${AIRFLOW_PASSWORD:-admin}
```

You should validate if the content of the environment variables `AIRFLOW_USERNAME` and `AIRFLOW_PASSWORD` allow you to
authenticate to the instance.

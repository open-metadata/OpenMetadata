---
title: Upgrade on Kubernetes
slug: /deployment/upgrade/kubernetes
---

# Upgrade on Kubernetes

This guide will help you upgrade your OpenMetadata Kubernetes Application with automated helm hooks.

## Requirements

This guide assumes that you have an OpenMetadata deployment that you installed and configured following the 
[Kubernetes Deployment](/deployment/kubernetes) guide.

We also assume that your helm chart release names are `openmetadata` and `openmetadata-dependencies` and namespace used is `default`.

## Prerequisites

Everytime that you plan on upgrading OpenMetadata to a newer version, make sure to go over all these steps:

### 1. Backup your Metadata

Before upgrading your OpenMetadata version we strongly recommend backing up the metadata.

The source of truth is stored in the underlying database (MySQL and Postgres supported). During each version upgrade there
is a database migration process that needs to run. It will directly attack your database and update the shape of the
data to the newest OpenMetadata release.

It is important that we back up the data because if we face any unexpected issues during the upgrade process, 
you will be able to get back to the previous version without any loss.

{% note %}

You can learn more about how the migration process works [here](/deployment/upgrade/how-does-it-work).

{% /note %}

- To run the backup and restore commands, please make sure that you are always in the latest `openmetadata-ingestion` version to have all the improvements shipped in the CLI.
- Also, make sure you have connectivity between your database (MySQL / PostgreSQL) and the host machine where you will be running the below commands.

**1. Create a Virtual Environment and Install the Backup CLI**

```python
python -m venv venv
source venv/bin/activate
pip install openmetadata-ingestion~=1.1.0
```

Validate the installed metadata version with `python -m metadata --version`

**2. Run the Backup**

If using MySQL:

```bash
python -m metadata backup -u openmetadata_user -p openmetadata_password -H mysql -d openmetadata_db --port 3306
```

If using Postgres:

```bash
python -m metadata backup -u openmetadata_user -p openmetadata_password -H postgresql -d openmetadata_db --port 5432 -s public
```

**3. Store the backup file somewhere safe**

The above command will generate a backup file with extension as `.sql`. You can copy the name from the backup command output.

Make sure to store it somewhere safe in case you need to restore the data later.

You can refer to the following guide to get more details about the backup and restore:

{% inlineCalloutContainer %}
  {% inlineCallout
    color="violet-70"
    icon="luggage"
    bold="Backup Metadata"
    href="/deployment/backup-restore-metadata" %}
      Learn how to back up MySQL or Postgres data.
  {% /inlineCallout %}
{% /inlineCalloutContainer %}

### 2. Review the Deprecation Notice and Breaking Changes

Releases might introduce deprecations and breaking changes that you should be aware of and understand before moving forward.

Below in this page you will find the details for the latest release, and you can find older release notes [here](/deployment/upgrade/versions).

The goal is to answer questions like:
- *Do I need to update my configurations?*
- *If I am running connectors externally, did their service connection change?*

Carefully reviewing this will prevent easy errors.

## 1.1 - Stable Release 🎉

OpenMetadata 1.1 is a stable release. Please check the [release notes](/releases/latest-release).

If you are upgrading production this is the recommended version to upgrade to.

## Deprecation Notice

- The 1.1 Release will be the last one with support for Python 3.7 since it is already [EOL](https://devguide.python.org/versions/).
  OpenMetadata 1.2 will support Python version 3.8 to 3.10.
- In 1.2 we will completely remove the Bots configured with SSO. Only JWT will be available then. Please, upgrade your
  bots if you haven't done so. Note that the UI already does not allow creating bots with SSO.
- 1.1 is the last release that will allow ingesting Impala from the Hive connector. In the next release we will
  only support the Impala scheme from the Impala Connector.

## Breaking Changes for 1.1 Stable Release

{% note noteType="Warning" %}

The Release 1.1.0 migration process will modify the structure of all your data. Depending on the number of records in the database,
**this process can take up quite some time to run**. Please wait until it gets executed end-to-end.

Make sure your data has been backed up before running the migration.

{% /note %}

### OpenMetadata Helm Chart Values

With `1.1.0` we are moving away from `global.*` helm values under openmetadata helm charts to `openmetadata.config.*`.
This change is introduce as helm reserves global chart values across all the helm charts. This conflicted the use of
OpenMetadata helm charts along with other helm charts for organizations using common helm values yaml files.

For example, with `1.0.X` Application version Releases, helm values would look like below -
```yaml
global:
  ...
  authorizer:
    className: "org.openmetadata.service.security.DefaultAuthorizer"
    containerRequestFilter: "org.openmetadata.service.security.JwtFilter"
    initialAdmins:
      - "user1"
    botPrincipals:
      - "<service_application_client_id>"
    principalDomain: "open-metadata.org"
  authentication:
    provider: "google"
    publicKeys:
      - "https://www.googleapis.com/oauth2/v3/certs"
      - "http://openmetadata:8585/api/v1/system/config/jwks"
    authority: "https://accounts.google.com"
    clientId: "{client id}"
    callbackUrl: "http://localhost:8585/callback"
  ...
```

With OpenMetadata Application version `1.1.0` and above, the above config will need to be updated as
```yaml
openmetadata:
  config:
    authorizer:
      className: "org.openmetadata.service.security.DefaultAuthorizer"
      containerRequestFilter: "org.openmetadata.service.security.JwtFilter"
      initialAdmins:
        - "user1"
        - "user2"
      botPrincipals:
        - "<service_application_client_id>"
      principalDomain: "open-metadata.org"
    authentication:
      provider: "google"
      publicKeys:
        - "https://www.googleapis.com/oauth2/v3/certs"
        - "http://openmetadata:8585/api/v1/system/config/jwks"
      authority: "https://accounts.google.com"
      clientId: "{client id}"
      callbackUrl: "http://localhost:8585/callback"
```

A quick and easy way to update the config is to use [yq](https://mikefarah.gitbook.io/yq/) utility to manipulate YAML files.

```bash
yq -i -e '{"openmetadata": {"config": .global}}' openmetadata.values.yml
```

The above command will update `global.*` with `openmetadata.config.*` yaml config. Please note, the above command is only recommended for users with custom helm values file explicit for OpenMetadata Helm Charts.

For more information, visit the official helm docs for [global chart values](https://helm.sh/docs/chart_template_guide/subcharts_and_globals/#global-chart-values).

# Upgrade Process

## Step 1: Get an overview of what has changed in Helm Values

You can get changes from artifact hub of [openmetadata helm chart](https://artifacthub.io/packages/helm/open-metadata/openmetadata) release. Click on Default Values >> Compare to Version.

{% image src="/images/v1.1/deployment/upgrade/artifact-hub-compare-to-version.png" alt="Helm Chart Release Comparison" /%}

## Step 2: Upgrade Helm Repository with a new release

Update Helm Chart Locally for OpenMetadata with the below command:

```commandline
helm repo update open-metadata
```

It will result in the below output on screen.

```commandline
Hang tight while we grab the latest from your chart repositories...
...Successfully got an update from the "open-metadata" chart repository
Update Complete. ⎈Happy Helming!⎈
```

Verify with the below command to see the latest release available locally.

```commandline
helm search repo open-metadata --versions
> NAME                                   	CHART VERSION	APP VERSION	DESCRIPTION                                
open-metadata/openmetadata             	1.1.5        	1.1.1      	A Helm chart for OpenMetadata on Kubernetes
open-metadata/openmetadata             	1.1.4        	1.1.0      	A Helm chart for OpenMetadata on Kubernetes
...
open-metadata/openmetadata-dependencies	1.1.5        	1.1.1      	Helm Dependencies for OpenMetadata
open-metadata/openmetadata-dependencies	1.1.4        	1.1.0      	Helm Dependencies for OpenMetadata
...
```

## Step 3: Upgrade OpenMetadata Dependencies

You can run the below command to upgrade the dependencies with the new chart

```commandline
helm upgrade openmetadata-dependencies open-metadata/openmetadata-dependencies
```

The above command uses configurations defined [here](https://raw.githubusercontent.com/open-metadata/openmetadata-helm-charts/main/charts/deps/values.yaml).
You can modify any configuration and deploy by passing your own `values.yaml`.

{% note noteType="Tip" %}

Make sure that, when using your own `values.yaml`, you are not overwriting elements such as the `image` of the containers.
This would prevent your new deployment to use the latest containers when running the upgrade.

If you are running into any issues, double-check what are the default values of the helm revision.

The command would look like below -

```commandline
helm upgrade openmetadata-dependencies open-metadata/openmetadata-dependencies --values <path-to-custom-values-file>
```

{% /note %}

## Step 4: Upgrade OpenMetadata

Finally, we upgrade OpenMetadata with the below command:

```commandline
helm upgrade openmetadata open-metadata/openmetadata
```

{% note noteType="Tip" %}

Make sure that, when using your own `values.yaml`, you are not overwriting elements such as the `image` of the containers.
This would prevent your new deployment to use the latest containers when running the upgrade.

If you are running into any issues, double-check what are the default values of the helm revision.

The command would look like below -

```commandline
helm upgrade openmetadata open-metadata/openmetadata --values <path-to-custom-values-file>
```

{% /note %}

{% note %}

You can learn more about how the migration process works [here](/deployment/upgrade/how-does-it-work).

{% /note %}

## Step 5: Re-index all your metadata

Go to `Settings` -> `OpenMetadata` -> `ElasticSearch`
{% image src="/images/v1.1/deployment/upgrade/elasticsearch-re-index.png" alt="create-project" caption="Create a New Project" /%}

Click on `Reindex-all` in the dialog box choose `Entities` to `All`
{% image src="/images/v1.1/deployment/upgrade/reindex-ES.png" alt="create-project" caption="Reindex" /%}

# Troubleshooting

## Helm Upgrade fails with additional property airflow not allowed

With Release 1.0.0, if you see your helm charts failing to deploy with the below issue -

```
Error: INSTALLATION FAILED: values don't meet the specifications of the schema(s) in the following chart(s):
openmetadata:
- global: Additional property airflow is not allowed
```

This means the values passed to the helm charts has a section `global.airflow`. As per the breaking changes mentioned [here](/deployment/upgrade/versions/013-to-100#airflow-configuration-&-pipeline-service-client), Airflow configs are replaced with pipelineServiceClient for Helm Charts.

The Helm Chart Values JSON Schema helps to catch the above breaking changes and this section will help you resolve and update your configurations for the same. You can read more about JSON Schema with Helm Charts [here](https://helm.sh/docs/topics/charts/#schema-files).

You will need to update the existing section of `global.airflow` values to match the new configurations.

⛔ Before 1.0.0 Helm Chart Release, the `global.airflow` section would be like -

```yaml
global:
  ...
  airflow:
    enabled: true
    # endpoint url for airflow
    host: http://openmetadata-dependencies-web.default.svc.cluster.local:8080
    # possible values are "no-ssl", "ignore", "validate"
    verifySsl: "no-ssl"
    # Local path in Airflow Pod
    sslCertificatePath: "/no/path"
    auth:
      username: admin
      password:
        secretRef: airflow-secrets
        secretKey: openmetadata-airflow-password
    openmetadata:
      # this will be the api endpoint url of OpenMetadata Server
      serverHostApiUrl: "http://openmetadata.default.svc.cluster.local:8585/api"
...
```

✅ After 1.0.0 Helm Chart Release, the `global.pipelineServiceClient` section will replace the above `airflow` section -

```yaml
openmetadata:
  config:
    ...
    pipelineServiceClientConfig:
      enabled: true
      className: "org.openmetadata.service.clients.pipeline.airflow.AirflowRESTClient"
      # endpoint url for airflow
      apiEndpoint: http://openmetadata-dependencies-web.default.svc.cluster.local:8080
      # this will be the api endpoint url of OpenMetadata Server
      metadataApiEndpoint: http://openmetadata.default.svc.cluster.local:8585/api
      # possible values are "no-ssl", "ignore", "validate"
      verifySsl: "no-ssl"
      ingestionIpInfoEnabled: false
      # local path in Airflow Pod
      sslCertificatePath: "/no/path"
      auth:
        username: admin
        password:
          secretRef: airflow-secrets
          secretKey: openmetadata-airflow-password
  ...
...
```

Run the [helm lint](https://helm.sh/docs/helm/helm_lint/) command on your custom values after making the changes to validate with the JSON Schema.

## With 0.13.0 Release

If your helm dependencies upgrade fails with the below command result -

```
Error: UPGRADE FAILED: cannot patch "mysql" with kind StatefulSet: StatefulSet.apps "mysql" is invalid: spec: 
Forbidden: updates to statefulset spec for fields other than 'replicas', 'template', 'updateStrategy', 'persistentVolumeClaimRetentionPolicy' 
and 'minReadySeconds' are forbidden
```

This is probably because with `0.13.0`, we have **default size of mysql persistence set to 50Gi**.

Kubernetes does not allow changes to Persistent volume with helm upgrades.

In order to work around this issue, you can either default the persistence size to 8Gi or run the below command which will patch Persistent Volumes and Persistent Volume Claims for mysql helm and then run the above `helm upgrade` command.

```
kubectl patch pvc data-mysql-0 -p '{"spec":{"resources":{"requests":{"storage":"50Gi"}}}}'
kubectl patch pv <mysql-pv> -p '{"spec":{"storage":"50Gi"}}'
```

## MySQL Pod fails on Upgrade

{% note %}

This issue will only occur if you are using openmetadata-dependencies helm chart version `0.0.49` and `0.0.50` and upgrading to the latest helm chart release.

{% /note %}

If your helm dependencies upgrade fails with the below command result -

```
Startup probe failed: mysqladmin: [Warning] Using a password on the command line interface can be insecure. mysqladmin: 
connect to server at 'localhost' failed error: 'Can't connect to local MySQL server through socket '/opt/bitnami/mysql/tmp/mysql.sock' (2)' 
Check that mysqld is running and that the socket: '/opt/bitnami/mysql/tmp/mysql.sock' exists!
```

This issue is related to a minor change that affected the MySQL Database Engine version upgrade from `8.0.28` to `8.0.29` for the Helm Chart Release `0.0.49` and `0.0.50`. Then the registry url was updated as we found a workaround to fetch previous versions of [bitnami/mysql](https://github.com/bitnami/charts/issues/10833) Helm Releases.

As a result of the above fixes, anyone who is on OpenMetadata Dependencies Helm Chart Version `0.0.49` and `0.0.50` is affected with the above issue when upgrading for mysql. In order to fix this issue, make sure to follow the below steps -

1. Backup the Database using Metadata Backup CLI as mentioned [here](#backup-your-data)
2. Uninstall OpenMetadata Dependencies Helm Chart (`helm uninstall openmetadata-dependencies`)
3. Remove the unmanaged volume for MySQL Stateful Set Kubernetes Object (`kubectl delete pvc data-mysql-0`)
4. Install the latest version of [OpenMetadata Dependencies Helm Chart](/deployment/kubernetes)
5. Restore the Database using Metadata Restore CLI as mentioned [here](/deployment/backup-restore-metadata)
6. Next, Proceed with upgrade for OpenMetadata Helm Chart as mentioned [here](#upgrade-openmetdata)

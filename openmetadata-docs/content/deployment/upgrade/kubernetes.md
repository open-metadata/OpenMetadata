---
title: Upgrade on Kubernetes
slug: /deployment/upgrade/kubernetes
---

# Upgrade on Kubernetes

This guide will help you upgrade your OpenMetadata Kubernetes Application with automated helm hooks.

## Requirements

This guide assumes that you have an OpenMetadata deployment that you installed and configured following the 
[Kubernetes Deployment](/deployment/kubernetes) guide.

We also assume that your helm chart release names are `openmetadata` and `openmetadata-dependencies` and namespace used is
`default`.

## Procedure

<Warning>

It is adviced to go through [openmetadata release notes](/deployment/upgrade#breaking-changes-from-0130-release)

</Warning>

Below document is valid for upgrading Helm Charts from **0.12.x to 0.13.0**.

### Back up metadata

Before proceeding, please back up your MySQL/Postgres DB behind the OpenMetadata server. This step is crucial for restoring to your current state if any issues arise during the upgrade. It is recommended before upgrading your production instances.

Make sure you have connectivity between your database (MySQL / PostgreSQL) and the host machine where you will be running the below commands. If you are using the default database available with OpenMetadata Dependencies, make sure to port-forward the MySQL service using `kubectl port-forward service/mysql 3306:3306`.

Then, follow the next steps to create a virtual environment and install the latest OpenMetadata Python package with the backup CLI:

1. `python -m venv venv`
2. `source venv/bin/activate`
3. `pip install openmetadata-ingestion~=0.13.1.0`
4. Validate the installed `metadata` version with `python -m metadata --version`
5. Run the backup using the updated `metadata` CLI:
    ```
    python -m metadata backup -u openmetadata_user -p openmetadata_password -H mysql -d openmetadata_db --port 3306
    ```
    if using Postgres:
    ```
    python -m metadata backup -u openmetadata_user -p openmetadata_password -H postgresql -d openmetadata_db --port 5432 -s public
    ```
6. The above command will generate a backup file with extension as `.sql`. You can copy the name from the backup
    command output.

## Get an overview of what has changed in Helm Values

You can get changes from artifact hub of [openmetadata helm chart](https://artifacthub.io/packages/helm/open-metadata/openmetadata) release. Click on Default Values >> Compare to Version.

<Image src="/images/deployment/upgrade/artifact-hub-compare-to-version.png" alt="Helm Chart Release Comparison"/>

## Upgrade Helm Repository with a new release

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
open-metadata/openmetadata             	0.0.48       	0.13.0     	A Helm chart for OpenMetadata on Kubernetes
open-metadata/openmetadata             	0.0.47       	0.13.0     	A Helm chart for OpenMetadata on Kubernetes
open-metadata/openmetadata             	0.0.46       	0.12.3     	A Helm chart for OpenMetadata on Kubernetes
...
open-metadata/openmetadata-dependencies	0.0.48       	0.13.0     	Helm Dependencies for OpenMetadata         
open-metadata/openmetadata-dependencies	0.0.47       	0.13.0     	Helm Dependencies for OpenMetadata         
open-metadata/openmetadata-dependencies	0.0.46       	0.12.3     	Helm Dependencies for OpenMetadata
...
```

## Upgrade OpenMetadata Dependencies
### Step 1: Upgrade OpenMetadata Dependencies with the below command

```commandline
helm upgrade openmetadata-dependencies open-metadata/openmetadata-dependencies
```


The above command uses configurations defined [here](https://raw.githubusercontent.com/open-metadata/openmetadata-helm-charts/main/charts/deps/values.yaml).
You can modify any configuration and deploy by passing your own `values.yaml`.


### Step 2: Troubleshooting

If your helm upgrade fails with the below command result -
```
Error: UPGRADE FAILED: cannot patch "mysql" with kind StatefulSet: StatefulSet.apps "mysql" is invalid: spec: Forbidden: updates to statefulset spec for fields other than 'replicas', 'template', 'updateStrategy', 'persistentVolumeClaimRetentionPolicy' and 'minReadySeconds' are forbidden
```

This is probably because with `0.13.0`, we have **default size of mysql persistence set to 50Gi**.

Kubernetes does not allow changes to Persistent volume with helm upgrades.

In order to work around this issue, you can either default the persistence size to 8Gi or run the below command which will patch Persistent Volumes and Persistent Volume Claims for mysql helm and then run the above `helm upgrade` command.

```
kubectl patch pvc data-mysql-0 -p '{"spec":{"resources":{"requests":{"storage":"50Gi"}}}}'
kubectl patch pv <mysql-pv> -p '{"spec":{"storage":"50Gi"}}'
```

<Tip>

Make sure that, when using your own `values.yaml`, you are not overwriting elements such as the `image` of the containers.
This would prevent your new deployment to use the latest containers when running the upgrade.

If you are running into any issues, double-check what are the default values of the helm revision.

</Tip>

## Upgrade OpenMetdata

We upgrade OpenMetadata with the below command:

```commandline
helm upgrade openmetadata open-metadata/openmetadata
```

You might need to pass your own `values.yaml` with the `--values` flag

### Re-index all your metadata
 Go to Settings -> Elasticsearch
<Image src="/images/deployment/upgrade/elasticsearch-re-index.png" alt="create-project" caption="Create a New Project"/>

 Click on reindex all
 in the dialog box choose Recreate Indexes to All
 <Image src="/images/deployment/upgrade/reindex-ES.png" alt="create-project" caption="Reindex"/>

## Troubleshooting for 0.12 Release

### Using custom helm values

If you are facing an issue similar to below when openmetadata pod keeps on restarting.

```
java.lang.ClassNotFoundException: org.openmetadata.service.security.DefaultAuthorizer
	at java.base/jdk.internal.loader.BuiltinClassLoader.loadClass(BuiltinClassLoader.java:581)
	at java.base/jdk.internal.loader.ClassLoaders$AppClassLoader.loadClass(ClassLoaders.java:178)
	at java.base/java.lang.ClassLoader.loadClass(ClassLoader.java:522)
	at java.base/java.lang.Class.forName0(Native Method)
	at java.base/java.lang.Class.forName(Class.java:315)
	at org.openmetadata.service.OpenMetadataApplication.registerAuthorizer(OpenMetadataApplication.java:240)
	at org.openmetadata.service.OpenMetadataApplication.run(OpenMetadataApplication.java:123)
	at org.openmetadata.service.OpenMetadataApplication.run(OpenMetadataApplication.java:92)
	at io.dropwizard.cli.EnvironmentCommand.run(EnvironmentCommand.java:59)
	at io.dropwizard.cli.ConfiguredCommand.run(ConfiguredCommand.java:98)
	at io.dropwizard.cli.Cli.run(Cli.java:78)
	at io.dropwizard.Application.run(Application.java:94)
	at org.openmetadata.service.OpenMetadataApplication.main(OpenMetadataApplication.java:323)
```

The root cause of the issue is the default helm values which are upgraded in helm charts but are getting overridden by your custom helm values. Please verify the config for Authorizer Class Name and Container Request Filter. 

We have changed `org.openmetadata.service.security.*` to `org.openmetadata.service.security.*`.
Make sure to verify your helm values and update the below content.

```
global:
...
 authorizer:
    className: "org.openmetadata.service.security.DefaultAuthorizer"
    containerRequestFilter: "org.openmetadata.service.security.JwtFilter"
...
```

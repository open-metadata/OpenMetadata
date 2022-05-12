---
description: This guide will help you run OpenMetadata using Helm Charts
---

# Deploy OpenMetadata on Kubernetes

[![Artifact Hub](https://img.shields.io/endpoint?url=https://artifacthub.io/badge/repository/open-metadata)](https://artifacthub.io/packages/search?repo=open-metadata)

## Introduction

[openmetadata-helm-charts](https://github.com/open-metadata/openmetadata-helm-charts) houses Kubernetes [Helm](https://helm.sh) charts for deploying OpenMetadata and its dependencies (Elasticsearch and MySQL) on a Kubernetes cluster.

## Prerequisites

* A [Kubernetes cluster](https://kubernetes.io) on any cloud
* [kubectl](https://kubernetes.io/docs/tasks/tools/) to manage Kubernetes resources
* [Helm](https://helm.sh) to deploy resources based on Helm charts from the OpenMetadata repository

{% hint style="info" %}
Note: OpenMetadata only supports Helm 3
{% endhint %}

{% hint style="success" %}
This guide assumes your helm chart release names are _openmetadata_ and _openmetadata-dependencies and kubernetes namespace used is default._
{% endhint %}

## Quickstart

Assuming Kubernetes setup is done and your Kubernetes context points to a correct Kubernetes cluster, first we create kubernetes secrets that contains MySQL and Airflow passwords as secrets.

```
kubectl create secret generic mysql-secrets --from-literal=openmetadata-mysql-password=openmetadata_password
kubectl create secret generic airflow-secrets --from-literal=openmetadata-airflow-password=admin
```

The above commands sets the passwords as an example. Change to any password of choice.

Next, we install OpenMetadata dependencies.

Add the OpenMetadata Helm repository by running the following command.

```
helm repo add open-metadata https://helm.open-metadata.org/
```

Run the command `helm repo list` to ensure the OpenMetadata repository was added.

```
NAME        	URL                            
open-metadata	https://helm.open-metadata.org/
```

Assuming kubectl context points to the correct kubernetes cluster, first create kubernetes secrets that contain airflow mysql password as secrets.

```
kubectl create secret generic airflow-mysql-secrets --from-literal=airflow-mysql-password=airflow_pass
```

Deploy the dependencies by running the following command.

```
helm install openmetadata-dependencies open-metadata/openmetadata-dependencies
```

{% hint style="info" %}
Note - The above command uses configurations defined [here](https://raw.githubusercontent.com/open-metadata/openmetadata-helm-charts/main/charts/deps/values.yaml). You can modify any configuration and deploy by passing your own `values.yaml`

```
helm install openmetadata-dependencies open-metadata/openmetadata-dependencies --values <<path-to-values-file>>
```
{% endhint %}

Run `kubectl get pods` to check whether all the pods for the dependencies are running. You should get a result similar to below.

```
NAME                              READY   STATUS    RESTARTS   AGE
elasticsearch-0                   1/1     Running   0          4m56s
mysql-0                           1/1     Running   0          4m56s
```

Next, deploy OpenMetadata by running the following command.

```
helm install openmetadata open-metadata/openmetadata
```

Values in [values.yaml](https://raw.githubusercontent.com/open-metadata/openmetadata-helm-charts/main/charts/openmetadata/values.yaml) are preset to match with dependencies deployed using [openmetadata-dependencies](https://github.com/open-metadata/openmetadata-helm-charts/tree/main/charts/deps) with release name "openmetadata-dependencies". If you deployed helm chart using different release name, make sure to update values.yaml accordingly before installing.

Run `kubectl get pods` to check the status of pods running. You should get a result similar to the output below.

```
NAME                            READY   STATUS    RESTARTS   AGE
elasticsearch-0                 1/1     Running   0          5m34s
mysql-0                         1/1     Running   0          5m34s
openmetadata-5566f4d8b9-544gb   1/1     Running   0          98s
```

{% hint style="info" %}
To expose the OpenMetadata UI on a local Kubernetes instance, run this command.

```
kubectl port-forward <openmetadata-front end pod name> 8585:8585
```
{% endhint %}

### Next Steps

1. Visit the [Features](../../docs/overview/features.md) overview page and explore the OpenMetadata UI.
2. Visit the [Connectors](../../docs/integrations/connectors/) documentation to see what services you can integrate with OpenMetadata.
3. Visit the [API](../../docs/openmetadata-apis/apis/overview.md) documentation and explore the OpenMetadata APIs.

## Next Steps

* Visit the [Features](../../docs/overview/features.md) overview page and explore the OpenMetadata UI.
* Visit the [Connectors](../../docs/integrations/connectors/) documentation to see what services you can integrate with OpenMetadata.
* Visit the [API](../../docs/openmetadata-apis/apis/overview.md) documentation and explore the OpenMetadata APIs.

## Troubleshooting

### View helm chart deployment status

Run the below command to view status of openmetadata helm chart deployed -

```
helm status openmetadata
```

For more information, visit helm command line reference [here](https://helm.sh/docs/helm/helm\_status/).

### View openmetadata kubernetes pod logs

Run the below command to list openmetadata kubernetes pods deployed in a namespace -

```
kubectl get pods --namespace <NAMESPACE_NAME> -l='app.kubernetes.io/managed-by=Helm,app.kubernetes.io/instance=<RELEASE_NAME>'
```

Example, list pods deployed by helm release name 'ometa' in the namespace 'ometa-dev' -

```
kubectl get pods --namespace ometa-dev -l='app.kubernetes.io/managed-by=Helm,app.kubernetes.io/instance=ometa'
```

Next, view the logs of pod by running the below command,

```
kubectl logs <POD_NAME> --namespace <NAMESPACE_NAME>
```

For more information, visit the kubectl logs command line reference documentation [here](https://kubernetes.io/docs/tasks/debug-application-cluster/debug-running-pod/).

### Uninstall OpenMetadata Helm Charts

Use the below command to uninstall OpenMetadata Helm Charts completely.

```
helm uninstall openmetadata
helm uninstall openmetadata-dependencies
```

MySql and ElasticSearch OpenMetadata Dependencies as deployed as StatefulSets and have persistent volumes (pv) and and persistent volume claims (pvc). These will need to be manually cleaned after helm uninstall. You can use `kubectl delete CLI` command for the same.

## Enable Security

OpenMetadata has support for Google, Okta, Auth0, and Azure SSO as identity providers. Please check [Secure OpenMetadata](../../docs/deploy/secure-openmetadata/) for configuring Single Sign On.

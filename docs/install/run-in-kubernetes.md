---
description: This guide will help you run OpenMetadata using Helm Charts
---

# Run in Kubernetes

[![Artifact Hub](https://img.shields.io/endpoint?url=https://artifacthub.io/badge/repository/open-metadata)](https://artifacthub.io/packages/search?repo=open-metadata)

## Introduction

[openmetadata-helm-charts](https://github.com/open-metadata/openmetadata-helm-charts) houses Kubernetes [Helm](https://helm.sh) charts for deploying OpenMetadata and its dependencies (Elasticsearch and MySQL) on a Kubernetes cluster.

## Prerequisites

* A [Kubernetes cluster](https://kubernetes.io) on any cloud
* [kubectl](https://kubernetes.io/docs/tasks/tools/) to manage Kubernetes resources
* [Helm](https://helm.sh) to deploy resources based on Helm charts from the OpenMetadata repository

{% hint style="info" %}
Note, OpenMetadata only supports Helm 3
{% endhint %}

## Quickstart

Assuming Kubernetes setup is done and your Kubernetes context points to a correct Kubernetes cluster, first we install OpenMetadata dependencies.

Add the OpenMetadata Helm repository by running the following command.

```
helm repo add open-metadata https://helm.open-metadata.org/
```

Run the command `helm repo list` to ensure the OpenMetadata repository was added.

```
NAME        	URL                            
open-metadata	https://helm.open-metadata.org/
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
NAME                            READY   STATUS    RESTARTS   AGE
elasticsearch-0                 1/1     Running   0          3m56s
mysql-0                         1/1     Running   0          3m56s
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

---
description: This guide will help you run OpenMetadata using Helm Charts
---

# Open Metadata Helm Charts 

[![Artifact Hub](https://img.shields.io/endpoint?url=https://artifacthub.io/badge/repository/open-metadata)](https://artifacthub.io/packages/search?repo=open-metadata)

## Introduction

[openmetadata-helm-charts](https://github.com/open-metadata/openmetadata-helm-charts) houses Kubernetes [Helm](https://helm.sh) charts for deploying Open Metadata and it's dependencies (Elastic Search and MySQL) on a Kubernetes Cluster.

## Prerequisites

- [Kubernetes Cluster](https://kubernetes.io) - Set up a kubernetes cluster on any cloud
- [Kubectl](https://kubernetes.io/docs/tasks/tools/) to manage Kubernetes Resources
- [Helm](https://helm.sh) to deploy resources based on Helm Charts from this repository. Note, we only support Helm 3

## Quickstart

Assuming Kubernetes setup is done and your kubernetes context is points to a correct kubernetes cluster, first we install Open Metadata dependencies.

Add openmetadata helm repo by running the following - 

```
helm repo add open-metadata https://helm.open-metadata.org/
```
Run the command `helm repo list` to list the addition of openmetadata helm repo -

```
NAME        	URL                            
open-metadata	https://helm.open-metadata.org/
```

Deploy the dependencies by running

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

Next, deploy the openmetadata by running the following

```
helm install openmetadata open-metadata/openmetadata
```

Values in [values.yaml](https://raw.githubusercontent.com/open-metadata/openmetadata-helm-charts/main/charts/openmetadata/values.yaml) are preset to match with dependencies deployed using [openmetadata-dependencies](https://github.com/open-metadata/openmetadata-helm-charts/tree/main/charts/deps) with release name "openmetadata-dependencies". If you deployed helm chart using different release name, make sure to update values.yaml accordingly before installing.

Run `kubectl get pods` command to check the statuses of pods running you should get a result similar to below.

```
NAME                            READY   STATUS    RESTARTS   AGE
elasticsearch-0                 1/1     Running   0          5m34s
mysql-0                         1/1     Running   0          5m34s
openmetadata-5566f4d8b9-544gb   1/1     Running   0          98s
```

{% hint style="info" %}
To expose the Openmetadata UI on local kubernetes instance, run the below command -

```
kubectl port-forward <openmetadata-front end pod name> 8585:8585
```
{% endhint %}
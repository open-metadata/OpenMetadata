---
title: Kubernetes Deployment
slug: /deployment/kubernetes
---

# Kubernetes Deployment

OpenMetadata supports the Installation and Running of Application on kubernetes through Helm Charts.

## Introduction

[openmetadata-helm-charts](https://github.com/open-metadata/openmetadata-helm-charts) houses Kubernetes Helm charts 
for deploying OpenMetadata and its dependencies (Elasticsearch, MySQL and Airflow) on a Kubernetes cluster.

## Prerequisites

- A [Kubernetes](https://kubernetes.io/) cluster on any cloud 
- [kubectl](https://kubernetes.io/docs/tasks/tools/) to manage Kubernetes resources 
- [Helm](https://helm.sh/) to deploy resources based on Helm charts from the OpenMetadata repository

<Note>

OpenMetadata ONLY supports Helm 3.

This guide assumes your helm chart release names are `openmetadata` and `openmetadata-dependencies` and the kubernetes namespace
used is `default`.

</Note>

## Quickstart

Assuming Kubernetes setup is done and your Kubernetes context points to a correct Kubernetes cluster, first we create
kubernetes secrets that contains MySQL and Airflow passwords as secrets.

```commandline
kubectl create secret generic mysql-secrets --from-literal=openmetadata-mysql-password=openmetadata_password
kubectl create secret generic airflow-secrets --from-literal=openmetadata-airflow-password=admin
```

The above commands sets the passwords as an example. Change to any password of your choice. 

Next, install the OpenMetadata dependencies by adding the OpenMetadata Helm repository with the following command.

```commandline
helm repo add open-metadata https://helm.open-metadata.org/
```

Run the command `helm repo list` to ensure the OpenMetadata repository was added.

```commandline
NAME        	URL                            
open-metadata	https://helm.open-metadata.org/
```

Assuming `kubectl` context points to the correct kubernetes cluster, first create the kubernetes secrets that contain airflow
mysql password as secrets.

```commandline
kubectl create secret generic airflow-mysql-secrets --from-literal=airflow-mysql-password=airflow_pass
```

Deploy the dependencies by running the following command:

```commandline
helm install openmetadata-dependencies open-metadata/openmetadata-dependencies
```

<Note>

The above command uses configurations defined [here](https://raw.githubusercontent.com/open-metadata/openmetadata-helm-charts/main/charts/deps/values.yaml). 
You can modify any configuration and deploy by passing your own `values.yaml`

```commandline
helm install openmetadata-dependencies open-metadata/openmetadata-dependencies --values <path-to-values-file>
```

</Note>

Run `kubectl get pods` to check whether all the pods for the dependencies are running. You should get a result similar to
below.

```commandline
NAME                              READY   STATUS    RESTARTS   AGE
elasticsearch-0                   1/1     Running   0          4m56s
mysql-0                           1/1     Running   0          4m56s
```

Helm Chart for OpenMetadata Dependencies uses the following helm charts:
- [Bitnami MySQL](https://artifacthub.io/packages/helm/bitnami/mysql/8.8.23) (helm chart version 8.8.23)
- [ElasticSearch](https://artifacthub.io/packages/helm/elastic/elasticsearch/7.10.2) (helm chart version 7.10.2)
- [Airflow](https://artifacthub.io/packages/helm/airflow-helm/airflow/8.5.3) (helm chart version 8.5.3)

If you want to customise helm values for the dependencies as per your cluster, you can follow the above links and update
your custom helm `values.yaml`.

Airflow uses DAGs and Logs for persistence volumes with the Kubernetes Executor. 

Make sure your kubernetes cluster storage provisioner has persistent volumes capability of `ReadWriteMany` Access Mode. Modify the Helm Values for airflow as per
your requirement here.

This is not required if you are deploying on kubernetes cluster created by `minkube` or Docker Desktop. Check the storage
provider compatibility [here](https://kubernetes.io/docs/concepts/storage/persistent-volumes/#access-modes).

Next, deploy OpenMetadata by running the following command:

```commandline
helm install openmetadata open-metadata/openmetadata
```

Again, this uses the values defined [here](https://github.com/open-metadata/openmetadata-helm-charts/blob/main/charts/openmetadata/values.yaml).
Use the `--values` flag to point to your own YAML configuration if needed.

<Note>

The values in `values.yaml` are preset to match with dependencies deployed using `openmetadata-dependencies` with release name "openmetadata-dependencies".
If you deployed helm chart using different release name, make sure to update `values.yaml` accordingly before installing.

</Note>

Run `kubectl get pods` to check the status of pods running. You should get a result similar to the output below:

```commandline
NAME                            READY   STATUS    RESTARTS   AGE
elasticsearch-0                 1/1     Running   0          5m34s
mysql-0                         1/1     Running   0          5m34s
openmetadata-5566f4d8b9-544gb   1/1     Running   0          98s
```

## Port Forwarding

To expose the OpenMetadata UI on a local Kubernetes instance, run this command:

```commandline
kubectl port-forward <openmetadata-front end pod name> 8585:8585
```

## Enable Security

Please follow our [Enable Security Guide](/deployment/kubernetes/security) to configure security for your OpenMetadata
installation.

## Troubleshooting

### View helm chart deployment status

Run the below command to view status of openmetadata helm chart deployed:

```commandline
helm status openmetadata
```

For more information, visit helm command line reference [here](https://helm.sh/docs/helm/helm_status/).

### View openmetadata kubernetes pod logs

Run the below command to list openmetadata kubernetes pods deployed in a namespace:

```commandline
kubectl get pods --namespace <NAMESPACE_NAME> -l='app.kubernetes.io/managed-by=Helm,app.kubernetes.io/instance=<RELEASE_NAME>'
```

For example, list pods deployed by helm release name `ometa` in the namespace `ometa-dev`:

```commandline
kubectl get pods --namespace ometa-dev -l='app.kubernetes.io/managed-by=Helm,app.kubernetes.io/instance=ometa'
```

Next, view the logs of pod by running the below command,

```commandline
kubectl logs <POD_NAME> --namespace <NAMESPACE_NAME>
```

For more information, visit the kubectl logs command line reference documentation [here](https://kubernetes.io/docs/tasks/debug-application-cluster/debug-running-pod/).

### Uninstall OpenMetadata Helm Charts

Use the below command to uninstall OpenMetadata Helm Charts completely.

```commandline
helm uninstall openmetadata
helm uninstall openmetadata-dependencies
```

MySql and ElasticSearch OpenMetadata Dependencies as deployed as StatefulSets and have persistent volumes (pv) and
persistent volume claims (`pvc`). These will need to be manually cleaned after helm uninstall. You can use `kubectl delete`
CLI command for the same.

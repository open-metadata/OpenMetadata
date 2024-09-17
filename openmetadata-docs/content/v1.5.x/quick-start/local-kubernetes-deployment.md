---
title: Try OpenMetadata in Docker
slug: /quick-start/local-kubernetes-deployment
---

# Local Kubernetes Deployment

This installation doc will help you start a OpenMetadata standalone instance on your local machine.

[openmetadata-helm-charts](https://github.com/open-metadata/openmetadata-helm-charts) houses Kubernetes Helm charts 
for deploying OpenMetadata and its dependencies (Elasticsearch, MySQL and Airflow) on a Kubernetes cluster.



## Requirements

- A local [Kubernetes](https://kubernetes.io/) cluster with installation of [Docker Desktop](https://www.docker.com/products/docker-desktop/) or [MiniKube](https://minikube.sigs.k8s.io/docs/start/)
- [kubectl](https://kubernetes.io/docs/tasks/tools/) to manage Kubernetes resources
- [Helm](https://helm.sh/) to deploy resources based on Helm charts from the OpenMetadata repository

{%note%}

OpenMetadata ONLY supports Helm 3.

This guide assumes your helm chart release names as `openmetadata` and `openmetadata-dependencies` and the kubernetes namespace used is `default`.

{%/note%}

## Procedure

---

### 1. Start Local Kubernetes Cluster

For this guide, we will be using minikube as our local kubernetes cluster. Run the following command to start a minikube cluster with 4 vCPUs and 8 GiB Memory.

```
minikube start --cpus=4 --memory=8192
```

{%note%}

If you are using minikube to start a local kubernetes instance on MacOS with M1 chipset, use the following command to start the cluster required for OpenMetadata Helm Charts to install locally (with docker desktop running as container runtime engine).

`minikube start --cpus=4 --memory=8192 --cni=bridge --driver=docker`

{%/note%}

### 2. Create Kubernetes Secrets required for Helm Charts

Create kubernetes secrets that contains MySQL and Airflow passwords as secrets.

```commandline
kubectl create secret generic mysql-secrets --from-literal=openmetadata-mysql-password=openmetadata_password
kubectl create secret generic airflow-secrets --from-literal=openmetadata-airflow-password=admin
kubectl create secret generic airflow-mysql-secrets --from-literal=airflow-mysql-password=airflow_pass
```

### 3. Add Helm Repository for Local Deployment

Run the below command to add OpenMetadata Helm Repository -

```commandline
helm repo add open-metadata https://helm.open-metadata.org/
```


To verify, run `helm repo list` to ensure the OpenMetadata repository was added.

```commandline
NAME        	URL                            
open-metadata	https://helm.open-metadata.org/
```

### 4. Install OpenMetadata Dependencies Helm Chart

We created a separate [chart](https://github.com/open-metadata/openmetadata-helm-charts/tree/main/charts/deps) to configure and install the OpenMetadata Application Dependencies with example configurations.

Deploy the dependencies by running the following command -

```commandline
helm install openmetadata-dependencies open-metadata/openmetadata-dependencies
```

Run `kubectl get pods` to check whether all the pods for the dependencies are running. You should get a result similar to below.

```commandline
NAME                                                       READY   STATUS     RESTARTS   AGE
opensearch-0                                               1/1     Running   0          4m26s
mysql-0                                                    1/1     Running   0          4m26s
openmetadata-dependencies-db-migrations-5984f795bc-t46wh   1/1     Running   0          4m26s
openmetadata-dependencies-scheduler-5b574858b6-75clt       1/1     Running   0          4m26s
openmetadata-dependencies-sync-users-654b7d58b5-2z5sf      1/1     Running   0          4m26s
openmetadata-dependencies-triggerer-8d498cc85-wjn69        1/1     Running   0          4m26s
openmetadata-dependencies-web-64bc79d7c6-7n6v2             1/1     Running   0          4m26s
```

Wait for all the above Pods to be in ***`running`*** status and ***`ready`*** state.

{%note%}

Please note that the pods names above as `openmetadata-dependencies-*` are part of airflow deployments.

{%/note%}

Helm Chart for OpenMetadata Dependencies uses the following helm charts:
- [Bitnami MySQL](https://artifacthub.io/packages/helm/bitnami/mysql/9.7.2) (helm chart version 9.7.2)
- [OpenSearch](https://artifacthub.io/packages/helm/opensearch-project-helm-charts/opensearch/2.12.2) (helm chart version 2.12.2)
- [Airflow](https://artifacthub.io/packages/helm/airflow-helm/airflow/8.8.0) (helm chart version 8.8.0)

### 5. Install OpenMetadata Helm Chart

Deploy OpenMetadata Application by running the following command -

```commandline
helm install openmetadata open-metadata/openmetadata
```

Run **`kubectl get pods --selector=app.kubernetes.io/name=openmetadata`** to check the status of pods running. You should get a result similar to the output below -

```commandline
NAME                            READY   STATUS    RESTARTS   AGE
openmetadata-5c55f6759c-52dvq   1/1     Running   0          90s
```

Wait for the above Pod to be in ***`running`*** status and ***`ready`*** state.

### 6. Port Forward OpenMetadata Kubernetes Service to view UI

To expose the OpenMetadata UI on a local Kubernetes Cluster, run the below command -

```commandline
kubectl port-forward service/openmetadata 8585:http
```

The above command will port forward traffic from local machine port 8585 to a named port of OpenMetadata kubernetes service `http`.

Browse the Application with url `http://localhost:8585` from your Browser. The default login credentials are `admin@open-metadata.org:admin` to log into OpenMetadata Application.

### 7. Cleanup

Use the below command to uninstall OpenMetadata Helm Charts Release.

```commandline
helm uninstall openmetadata
helm uninstall openmetadata-dependencies
```

MySQL and ElasticSearch OpenMetadata Dependencies are deployed as StatefulSets and have persistent volumes (pv) and
persistent volume claims (`pvc`). These will need to be manually cleaned after helm uninstall. You can use `kubectl delete persistentvolumeclaims mysql-0 elasticsearch-0` CLI command for the same.

## Troubleshooting

### Pods fail to start due to `ErrImagePull` issue

Sometimes, kubernetes timeout pulling the docker images. In such cases, you will receive `ErrImagePull` issue. In order to resolve this, you can manually pull the required docker images in your kubernetes environment. 

You can find the docker image name of the failing pods using the command below -

```
kubectl get pods -n <NAMESPACE_NAME> <POD_NAME> -o jsonpath="{..image}"
```

The command `docker pull <docker_image_name>` will make sure to get the image available for kubernetes and resolve the issue.

### View openmetadata kubernetes pod logs

Run the below command to list openmetadata kubernetes pods deployed in a namespace:

```commandline
kubectl get pods --namespace <NAMESPACE_NAME> -l='app.kubernetes.io/managed-by=Helm,app.kubernetes.io/instance=<RELEASE_NAME>'
```

For example, list pods deployed by helm release name `openmetadata` in the namespace `ometa-dev`:

```commandline
kubectl get pods --namespace ometa-dev -l='app.kubernetes.io/managed-by=Helm,app.kubernetes.io/instance=openmetadata'
```

Next, view the logs of pod by running the below command,

```commandline
kubectl logs <POD_NAME> --namespace <NAMESPACE_NAME>
```

For more information, visit the kubectl logs command line reference documentation [here](https://kubernetes.io/docs/tasks/debug-application-cluster/debug-running-pod/).

## Next Steps

1. Refer the [How-to Guides](/how-to-guides) for an overview of all the features in OpenMetadata.
2. Visit the [Connectors](/connectors) documentation to see what services you can integrate with
   OpenMetadata.
3. Visit the [API](/swagger.html) documentation and explore the rich set of OpenMetadata APIs.

## Deploy in Cloud (Production)

{% inlineCalloutContainer %}
  {% inlineCallout
    color="violet-70"
    icon="10k"
    bold="Deploy in Cloud"
    href="/deployment/kubernetes" %}
    Deploy OpenMetadata in Kubernetes Cloud Environments
  {% /inlineCallout %}
{% /inlineCalloutContainer %}
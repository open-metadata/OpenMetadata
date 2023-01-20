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

Run `kubectl get pods` to check whether all the pods for the dependencies are running. You should get a result similar to below.

```commandline
NAME                                                       READY   STATUS     RESTARTS   AGE
elasticsearch-0                                            1/1     Running   0          4m26s
mysql-0                                                    1/1     Running   0          4m26s
openmetadata-dependencies-db-migrations-5984f795bc-t46wh   1/1     Running   0          4m26s
openmetadata-dependencies-scheduler-5b574858b6-75clt       1/1     Running   0          4m26s
openmetadata-dependencies-sync-users-654b7d58b5-2z5sf      1/1     Running   0          4m26s
openmetadata-dependencies-triggerer-8d498cc85-wjn69        1/1     Running   0          4m26s
openmetadata-dependencies-web-64bc79d7c6-7n6v2             1/1     Running   0          4m26s
```

Please note that the pods names above as openmetadata-dependencies-* are part of airflow deployments.

Helm Chart for OpenMetadata Dependencies uses the following helm charts:
- [Bitnami MySQL](https://artifacthub.io/packages/helm/bitnami/mysql/8.8.23) (helm chart version 8.8.23)
- [ElasticSearch](https://artifacthub.io/packages/helm/elastic/elasticsearch/7.10.2) (helm chart version 7.10.2)
- [Airflow](https://artifacthub.io/packages/helm/airflow-helm/airflow/8.6.1) (helm chart version 8.6.1)

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

Run `kubectl get pods --selector=app.kubernetes.io/name=openmetadata` to check the status of pods running. You should get a result similar to the output below:

```commandline
NAME                            READY   STATUS    RESTARTS   AGE
openmetadata-5c55f6759c-52dvq   1/1     Running   0          90s
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

## Run OpenMetadata with AWS Services

If you are running OpenMetadata in AWS, it is recommended to use [Amazon RDS](https://docs.aws.amazon.com/rds/index.html) and [Amazon OpenSearch Service](https://docs.aws.amazon.com/opensearch-service/?id=docs_gateway).

We support 

- Amazon RDS (MySQL) engine version upto 8.0.29
- Amazon OpenSearch (ElasticSearch) engine version upto 7.10 or Amazon OpenSearch engine version upto 1.3
- Amazon RDS (PostgreSQL) engine version upto 14.2-R1

For Production Systems, we recommend Amazon RDS to be in Multiple Availibility Zones. For Amazon OpenSearch (or ElasticSearch) Service, we recommend Multiple Availibility Zones with minimum 3 Master Nodes.

Once you have the RDS and OpenSearch Services Setup, you can update the environment variables below for OpenMetadata kubernetes deployments to connect with Database and ElasticSearch.

```yaml
# openmetadata-values.prod.yaml
...
global:
  elasticsearch:
    host: <AMAZON_OPENSEARCH_SERVICE_ENDPOINT_WITHOUT_HTTPS>
    port: 443
    scheme: https
    connectionTimeoutSecs: 5
    socketTimeoutSecs: 60
    batchSize: 10
    auth:
      enabled: false
      username: <AMAZON_OPENSEARCH_USERNAME>
      password:
        secretRef: elasticsearch-secrets
        secretKey: openmetadata-elasticsearch-password
  database:
    host: <AMAZON_RDS_ENDPOINT>
    port: 3306
    driverClass: com.mysql.cj.jdbc.Driver
    dbScheme: mysql
    dbUseSSL: true
    databaseName: <RDS_DATABASE_NAME>
    auth:
      username: <RDS_DATABASE_USERNAME>
      password:
        secretRef: mysql-secrets
        secretKey: openmetadata-mysql-password
...
```

Make sure to create RDS and OpenSearch credentials as Kubernetes Secrets mentioned [here](https://docs.open-metadata.org/deployment/kubernetes#quickstart).

  
## Using a Custom Ingestion Image
  
One possible use case where you would need to use a custom image for the ingestion is because you have developed your own custom connectors.
You can find a complete working example of this [here](https://github.com/open-metadata/openmetadata-demo/tree/main/custom-connector). After
you have your code ready, the steps would be the following:
  
### 1. Create a `Dockerfile` based on `openmetadata/ingestion`:

For example:

```
FROM openmetadata/ingestion:x.y.z

# Let's use the same workdir as the ingestion image
WORKDIR ingestion
USER airflow

# Install our custom connector
COPY <your_package> <your_package>
COPY setup.py .
RUN pip install --no-deps .
```
  
where `openmetadata/ingestion:x.y.z` needs to point to the same version of the OpenMetadata server, for example `openmetadata/ingestion:0.13.1`.
This image needs to be pushed and available to the container registry of your choice.

### 2. Update your dependency values YAML

The ingestion containers (which is the one shipping Airflow) gets installed in the `openmetadata-dependencies` helm chart. In this step, we use
our own custom values YAML file to point to the image we just created on the previous step. You can create a file named `values.deps.yaml` with the
following contents:
  
```yaml
airflow:
  airflow:
    image:
      repository: <your repository>  # by default, openmetadata/ingestion
      tag: <your tag>  # by default, the version you are deploying, e.g., 0.13.1
      pullPolicy: "IfNotPresent"
```

### 3. Install or Upgrade openmetadata-dependencies

If this is your first installation of `openmetadata-dependencies`, you can run:

```bash
helm install openmetadata-dependencies open-metadata/openmetadata-dependencies --values values.deps.yaml
```

If you had a previous helm installation, you'll need to upgrade via:

```bash
helm upgrade openmetadata-dependencies open-metadata/openmetadata-dependencies --values values.deps.yaml
```

### 4. Install OpenMetadata

Finally, follow the usual installation for the `openmetadata` helm charts.

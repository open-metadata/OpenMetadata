---
title: AWS EKS Deployment
slug: /deployment/kubernetes/eks
---

# EKS on Amazon Web Services Deployment

OpenMetadata supports the Installation and Running of Application on Elastic Kubernetes Services (EKS) through Helm Charts.
However, there are some additional configurations which needs to be done as prerequisites for the same.

{%note noteType="Warning"%}

All the code snippets in this section assume the `default` namespace for kubernetes.
This guide presumes you have AWS EKS Cluster already available.

{%/note%}

## Prerequisites

### AWS Services for Database as RDS and Search Engine as ElasticSearch

It is recommended to use [Amazon RDS](https://docs.aws.amazon.com/rds/index.html) and [Amazon OpenSearch Service](https://docs.aws.amazon.com/opensearch-service/?id=docs_gateway) for Production Deployments.

We support 

- Amazon RDS (MySQL) engine version 8 or greater
- Amazon RDS (PostgreSQL) engine version between 12 or greater
- Amazon OpenSearch engine version 2.7

{%note noteType="Tip"%}
When using AWS Services the SearchType Configuration for elastic search should be `opensearch`, for both cases ElasticSearch and OpenSearch, as you can see in the ElasticSearch configuration example below.
{%/note%}

We recommend 
- Amazon RDS to be in Multiple Availability Zones. 
- Amazon OpenSearch (or ElasticSearch) Service with Multiple Availability Zones with minimum 2 Nodes.

Once you have the RDS and OpenSearch Services Setup, you can update the environment variables below for OpenMetadata kubernetes deployments to connect with Database and ElasticSearch.

```yaml
# openmetadata-values.prod.yaml
...
openmetadata:
  config:
    elasticsearch:
      host: <AMAZON_OPENSEARCH_SERVICE_ENDPOINT_WITHOUT_HTTPS>
      searchType: opensearch
      port: 443
      scheme: https
      connectionTimeoutSecs: 5
      socketTimeoutSecs: 60
      keepAliveTimeoutSecs: 600
      batchSize: 10
      auth:
        enabled: true
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

Make sure to create RDS and OpenSearch credentials as Kubernetes Secrets mentioned [here](/quick-start/local-kubernetes-deployment#2.-create-kubernetes-secrets-required-for-helm-charts).

Also, disable MySQL and ElasticSearch from OpenMetadata Dependencies Helm Charts as mentioned in the FAQs [here](/deployment/kubernetes/faqs#how-to-disable-mysql-and-elasticsearch-from-openmetadata-dependencies-helm-charts).

### Create Elastic File System in AWS

You can follow official AWS Guides [here](https://docs.aws.amazon.com/efs/latest/ug/gs-step-two-create-efs-resources.html) to provision EFS File System in the same VPC which is associated with your EKS Cluster.

### Persistent Volumes with ReadWriteMany Access Modes

OpenMetadata helm chart depends on Airflow and Airflow expects a persistent disk that support ReadWriteMany (the volume can be mounted as read-write by many nodes).

In AWS, this is achieved by Elastic File System (EFS) service. AWS Elastic Block Store (EBS) does not provide ReadWriteMany Volume access mode as EBS will only be attached to one Kubernetes Node at any given point of time.

In order to provision persistent volumes from AWS EFS, you will need to setup and install [aws-efs-csi-driver](https://docs.aws.amazon.com/eks/latest/userguide/efs-csi.html). Note that this is required for Airflow as One OpenMetadata Dependencies.

Also, [aws-ebs-csi-driver](https://docs.aws.amazon.com/eks/latest/userguide/ebs-csi.html) might be required for Persistent Volumes that are to be used for MySQL and ElasticSearch as OpenMetadata Dependencies.

The below guide provides Persistent Volumes provisioning as static volumes (meaning you will be responsible to create, maintain and destroy Persistent Volumes).

## Provision EFS backed PVs, PVCs for Airflow DAGs and Airflow Logs

Please note that we are using one AWS Elastic File System (EFS) service with subdirectories   as `airflow-dags` and `airflow-logs` with the reference in this documentation. Also, it is presumed that `airflow-dags` and `airflow-logs` directories are already available on that file system.

In order to create directories inside the AWS Elastic File System (EFS) you would need to follow these [steps](https://docs.aws.amazon.com/efs/latest/ug/accessing-fs-nfs-permissions-per-user-subdirs.html).

### Code Samples for PV and PVC for Airflow DAGs

```yaml
# dags_pv_pvc.yml
apiVersion: v1 
kind: PersistentVolume 
metadata: 
  name: openmetadata-dependencies-dags-pv 
  labels: 
    app: airflow-dags 
spec: 
  capacity:
    storage: 10Gi
  storageClassName: ""
  accessModes: 
    - ReadWriteMany
  persistentVolumeReclaimPolicy: Retain
  csi:
    driver: efs.csi.aws.com
    volumeHandle: <FileSystemId>:/airflow-dags # Replace with EFS File System Id

---
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  labels: 
    app: airflow-dags 
  name: openmetadata-dependencies-dags-pvc
  namespace: default
spec:
  accessModes:
    - ReadWriteMany
  storageClassName: ""
  resources:
    requests:
      storage: 10Gi
```

Create Persistent Volumes and Persistent Volume claims with the below command.

```commandline
kubectl create -f dags_pv_pvc.yml
```

### Code Samples for PV and PVC for Airflow Logs

```yaml
# logs_pv_pvc.yml
apiVersion: v1 
kind: PersistentVolume 
metadata: 
  name: openmetadata-dependencies-logs-pv
  labels: 
    app: airflow-logs
spec:
  capacity:
    storage: 5Gi
  storageClassName: ""
  accessModes: 
    - ReadWriteMany
  persistentVolumeReclaimPolicy: Retain
  csi:
    driver: efs.csi.aws.com
    volumeHandle: <FileSystemId>:/airflow-logs # Replace with EFS File System Id

---
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: openmetadata-dependencies-logs-pvc
  namespace: default
  labels: 
    app: airflow-dags
spec:
  accessModes:
    - ReadWriteMany
  storageClassName: ""
  resources:
    requests:
      storage: 5Gi
```

Create Persistent Volumes and Persistent Volume claims with the below command.

```commandline
kubectl create -f logs_pv_pvc.yml
```

## Change owner and permission manually on disks

Since airflow pods run as non root users, they would not have write access on the nfs server volumes. In order to fix the permission here, spin up a pod with persistent volumes attached and run it once.

You can find more reference on AWS EFS permissions in docs [here](https://docs.aws.amazon.com/efs/latest/ug/using-fs.html).

```yaml
# permissions_pod.yml
apiVersion: v1
kind: Pod
metadata:
  creationTimestamp: null
  labels:
    run: my-permission-pod
  name: my-permission-pod
spec:
  containers:
  - image: nginx
    name: my-permission-pod
    volumeMounts:
    - name: airflow-dags
      mountPath: /airflow-dags
    - name: airflow-logs
      mountPath: /airflow-logs
    command:
    - "chown -R 50000 /airflow-dags /airflow-logs"
    # if needed
    - "chmod -R a+rwx /airflow-dags"
  volumes:
  - name: airflow-logs
    persistentVolumeClaim:
      claimName: openmetadata-dependencies-logs-pvc
  - name: airflow-dags
    persistentVolumeClaim:
      claimName: openmetadata-dependencies-dags-pvc
  dnsPolicy: ClusterFirst
  restartPolicy: Always
```

{%note%}

Airflow runs the pods with linux user name as airflow and linux user id as 50000.

{%/note%}

Run the below command to create the pod and fix the permissions

```commandline
kubectl create -f permissions_pod.yml
```

## Create OpenMetadata dependencies Values

Override openmetadata dependencies airflow helm values to bind the efs persistent volumes for DAGs and logs.

```yaml
# values-dependencies.yml
airflow:
  airflow:
    extraVolumeMounts:
      - mountPath: /airflow-logs
        name: efs-airflow-logs
      - mountPath: /airflow-dags/dags
        name: efs-airflow-dags
    extraVolumes:
      - name: efs-airflow-logs
        persistentVolumeClaim:
          claimName: openmetadata-dependencies-logs-pvc
      - name: efs-airflow-dags
        persistentVolumeClaim:
          claimName: openmetadata-dependencies-dags-pvc
    config:
      AIRFLOW__OPENMETADATA_AIRFLOW_APIS__DAG_GENERATED_CONFIGS: "/airflow-dags/dags"
  dags:
    path: /airflow-dags/dags
    persistence:
      enabled: false
  logs:
    path: /airflow-logs
    persistence:
      enabled: false
```

For more information on airflow helm chart values, please refer to [airflow-helm](https://artifacthub.io/packages/helm/airflow-helm/airflow/8.5.3).

When deploying openmetadata dependencies helm chart, use the below command -

```commandline
helm install openmetadata-dependencies open-metadata/openmetadata-dependencies --values values-dependencies.yaml
```

{%note%}

The above command uses configurations defined [here](https://raw.githubusercontent.com/open-metadata/openmetadata-helm-charts/main/charts/deps/values.yaml). 
You can modify any configuration and deploy by passing your own `values.yaml`

```commandline
helm install openmetadata-dependencies open-metadata/openmetadata-dependencies --values <path-to-values-file>
```

{%/note%}

Once the openmetadata dependencies helm chart deployed, you can then run the below command to install the openmetadata helm chart - 

```commandline
helm install openmetadata open-metadata/openmetadata
```
Again, this uses the values defined [here](https://github.com/open-metadata/openmetadata-helm-charts/blob/main/charts/openmetadata/values.yaml).
Use the `--values` flag to point to your own YAML configuration if needed.

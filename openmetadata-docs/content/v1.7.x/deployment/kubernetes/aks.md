---
title: Azure AKS Deployment | Official Documentation
description: Configure deployment with Azure Kubernetes Service (AKS) using `brandName`-recommended Helm charts and scalable configuration templates.
slug: /deployment/kubernetes/aks
collate: false
---
# Openmetadata Deployment on Azure Kubernetes Service Cluster
Openmetadata can be deployed on Azure Kubernetes Service. It however requires certain cloud specific configurations with regards to setting up storage accounts for Airflow which is one of its dependencies.

## Prerequisites

### Azure Services for Database and Search Engine as Elastic Cloud

It is recommended to use [Azure SQL](https://azure.microsoft.com/en-in/products/azure-sql/database) and [Elastic Cloud on Azure](https://www.elastic.co/partners/microsoft-azure) for Production Deployments.

We support 

- Azure SQL (MySQL) engine version 8 or higher
- Azure SQL (PostgreSQL) engine version 12 or higher
- Elastic Cloud (ElasticSearch version 8.11.4)

Once you have the Azure SQL and Elastic Cloud on Azure configured, you can update the environment variables below for OpenMetadata kubernetes deployments to connect with Database and ElasticSearch.

```yaml
# openmetadata-values.prod.yaml
...
openmetadata:
  config:
    elasticsearch:
      host: <ELASTIC_CLOUD_ENDPOINT_WITHOUT_HTTPS>
      searchType: elasticsearch
      port: 443
      scheme: https
      connectionTimeoutSecs: 5
      socketTimeoutSecs: 60
      keepAliveTimeoutSecs: 600
      batchSize: 10
      auth:
        enabled: true
        username: <ELASTIC_CLOUD_USERNAME>
        password:
          secretRef: elasticsearch-secrets
          secretKey: openmetadata-elasticsearch-password
    database:
      host: <AZURE_SQL_ENDPOINT>
      port: 3306
      driverClass: com.mysql.cj.jdbc.Driver
      dbScheme: mysql
      dbUseSSL: true
      databaseName: <AZURE_SQL_DATABASE_NAME>
      auth:
        username: <AZURE_SQL_DATABASE_USERNAME>
        password:
          secretRef: mysql-secrets
          secretKey: openmetadata-mysql-password
  ...
```

We recommend -
- Azure SQL to be Multi Zone Available and Production Workload Environment
- Elastic Cloud Environment with multiple zones and minimum 2 nodes

Make sure to create database and elastic cloud credentials as Kubernetes Secrets mentioned [here](/quick-start/local-kubernetes-deployment#2.-create-kubernetes-secrets-required-for-helm-charts).

Also, disable MySQL and ElasticSearch from OpenMetadata Dependencies Helm Charts as mentioned in the FAQs [here](#how-to-disable-mysql-and-elasticsearch-from-openmetadata-dependencies-helm-charts).

### Step 1 - Create a AKS cluster
If you are deploying on a new cluster set the `EnableAzureDiskFileCSIDriver=true` to enable container storage interface storage drivers.
```azure-cli
az aks create   --resource-group  MyResourceGroup    \
                --name MyAKSClusterName              \
                --nodepool-name agentpool            \
                --outbound-type loadbalancer         \
                --location YourPreferredLocation        \
                --generate-ssh-keys                  \
		        --enable-addons monitoring           \
		          EnableAzureDiskFileCSIDriver=true  \
          
```
For existing cluster it is important to enable the CSI storage drivers
```azure-cli
az aks update -n MyAKSCluster -g MyResourceGroup --enable-disk-driver --enable-file-driver
```

### Step 2 - Create a Namespace (optional)
```azure-cli
kubectl create namespace openmetadata
```

### Step 3 - Create Persistent Volumes
OpenMetadata helm chart depends on Airflow and Airflow expects a persistent disk that support ReadWriteMany (the volume can be mounted as read-write by many nodes). The Azure CSI storage drivers we enabled earlier support the provisioning of the disks in ReadWriteMany mode,. 

```yaml
# logs_dags_pvc.yaml
kind: PersistentVolumeClaim
apiVersion: v1
metadata:
  name: openmetadata-dependencies-dags-pvc
  namespace: openmetadata
spec:
  accessModes:
    - ReadWriteMany
  resources:
    requests:
      storage: 10Gi
  storageClassName: azurefile-csi
---
kind: PersistentVolumeClaim
apiVersion: v1
metadata:
  name: openmetadata-dependencies-logs-pvc
  namespace: openmetadata
spec:
  accessModes:
    - ReadWriteMany
  resources:
    requests:
      storage: 5Gi
  storageClassName: azurefile-csi
```
Create the volume claims by applying the manifest.
```azure-cli
kubectl apply -f logs_dags_pvc.yaml
```

### Step 4 - Change owner and update permission for persistent volumes
Airflow pods run as non-root user and lack write access to our persistent volumes. To fix this we create a job permissions_pod.yaml that runs a pod that mounts volumnes into the persistent volume claim and updates the owner of the mounted folders /airflow-dags and /airflow-logs to user id 5000, which is the default linux user id of Airflow pods.

```yaml
# permissions_pod.yaml
apiVersion: batch/v1
kind: Job
metadata:
  labels:
    run: my-permission-pod
  name: my-permission-pod
  namespace: openmetadata
spec:
  template:
    spec:
      containers:
      - image: busybox
        name: my-permission-pod
        volumeMounts:
        - name: airflow-dags
          mountPath: /airflow-dags
        - name: airflow-logs
          mountPath: /airflow-logs
        command: ["/bin/sh", "-c", "chown -R 50000 /airflow-dags /airflow-logs", "chmod -R a+rwx /airflow-dags"]
      restartPolicy: Never
      volumes:
      - name: airflow-logs
        persistentVolumeClaim:
          claimName: openmetadata-dependencies-logs-pvc
      - name: airflow-dags
        persistentVolumeClaim:
          claimName: openmetadata-dependencies-dags-pvc
```
Start the job by applying the manifest in permissions_pod.yaml.
```azure-cli
kubectl apply -f permissions_pod.yaml
```

### Step 5 - Add the Helm Openmetadata repo and set-up secrets
#### Add Helm Repo
``` azure-cli
helm repo add open-metadata https://helm.open-metadata.org/
```
#### Create secrets
It is recommeded to use external database and search for production deplyoments. The following implementation uses external postgresql DB from Azure Database. Any of the popular databases can be used. The default implementation uses mysql.

```azure-cli
kubectl create secret generic airflow-secrets                                    \
                    --namespace openmetadata                                     \
                    --from-literal=openmetadata-airflow-password=<AdminPassword> 
```
For production deployments connecting external postgresql database provide external database connection details by settings up appropriate secrets as below to use in manifests.

```azure-cli
kubectl create secret generic postgresql-secret                                       \
                                --namespace openmetadata                              \
                                --from-literal=postgresql-password=<MyPGDBPassword>   
 
```

### Step 6 - Install Openmetadata dependencies
The values-dependencies-yaml is used to overwride default values in the official helm chart and must be configured for customizing for use cases. Uncomment the externalDatabase section with meaningful values to connect to external database for production deployments. We set sensitive information like host address, DB name and DB username through the CLI.
```yaml
# values-dependencies.yaml

airflow:
  airflow:
    extraVolumeMounts:
      - mountPath: /airflow-logs
        name: aks-airflow-logs
      - mountPath: /airflow-dags/dags
        name: aks-airflow-dags
    extraVolumes:
      - name: aks-airflow-logs
        persistentVolumeClaim:
          claimName: openmetadata-dependencies-logs-pvc
      - name: aks-airflow-dags
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
  externalDatabase:
    type: postgres # default mysql 
    host: Host_db_address
    database: Airflow_metastore_dbname
    user: db_userName
    port: 5432
    dbUseSSL: true
    passwordSecret: postgresql-secret
    passwordSecretKey: postgresql-password

```
We overwrite some of the default values in the official openmetadata-dependencies helm chart with the values-dependencies.yaml to include an external postgresql db. And it's important to turn the mysql.enable flag to false if you are not using the default mysql db. This can be done both through the yaml file or as shown by setting variable values in the helm install command. 

For more information on airflow helm chart values, please refer to [airflow-helm](https://artifacthub.io/packages/helm/airflow-helm/airflow/8.5.3)
```azure-cli
helm install openmetadata-dependencies open-metadata/openmetadata-dependencies  \
                            --values values-dependencies.yaml                           \
                            --namespace openmetadata                                    \
                            --set mysql.enabled=false
```

It takes a few minutes for all the pods to be correctly set-up and running.
```azure-cli
kubectl get pods -n openmetadata 
```
```
NAME                                                       READY   STATUS    RESTARTS   AGE
openmetadata-dependencies-db-migrations-69fcf8c9d9-ctd2f   1/1     Running   0          4m51s
openmetadata-dependencies-pgbouncer-d9476f85-bwht9         1/1     Running   0          4m54s
openmetadata-dependencies-scheduler-5f785954cb-792ls       1/1     Running   0          4m54s
openmetadata-dependencies-sync-users-b58ccc589-ncb2d       1/1     Running   0          4m47s
openmetadata-dependencies-triggerer-684b8bb998-mbzvs       1/1     Running   0          4m53s
openmetadata-dependencies-web-9f6b4ff-5hfqj                1/1     Running   0          4m53s
opensearch-0                                               1/1     Running   0          42m

```

### Step 7 - Install Openmetadata
Finally install Openmetadata optionally customizing the values provided in the official chart [here](https://github.com/open-metadata/openmetadata-helm-charts/blob/main/charts/openmetadata/values.yaml) using the values.yaml file.
```yaml
# values.yaml 

global:
  pipelineServiceClientConfig:
    apiEndpoint: http://openmetadata-dependencies-web.<replace_with_your_namespace>.svc.cluster.local:8080
    metadataApiEndpoint: http://openmetadata.<replace_with_your_namespace>.svc.cluster.local:8585/api

openmetadata:
  config:
    database:
      host: postgresql
      port: 5432
      driverClass: org.postgresql.Driver
      dbScheme: postgresql
      databaseName: openmetadata_db
      auth:
        username: 
        password:
          secretRef: postgresql-secret  # referring to secret set in step 5 above
          secretKey: postgresql-password

image:
  tag: <image-tag>
```

```azure-cli
helm install openmetadata open-metadata/openmetadata    \
                            --values values.yaml        \
                            --namespace openmetadata                                                         
 ```
Give it again a few seconds for the pod to get ready. And when its ready, the service can be accessed by forwarding port 8585 of the cluster ip to you local host port.
```azure-cli
kubectl port-forward service/openmetadata 8585:8585 -n openmetadata
```

## Troubleshooting Airflow

### JSONDecodeError: Unterminated string starting

If you are using Airflow with Azure Blob Storage as `PersistentVolume` as explained in [Storage class using blobfuse](https://learn.microsoft.com/en-us/azure/aks/azure-csi-blob-storage-provision?tabs=mount-nfs%2Csecret),
you may encounter the following error after a few days:

```bash
{dagbag.py:346} ERROR - Failed to import: /airflow-dags/dags/...py
json.decoder.JSONDecodeError: Unterminated string starting at: line 1 column 3552
```

Moreover, the Executor pods would actually be using old files. This behaviour is caused by the recommended config by the
mentioned documentation:

```yaml
  - -o allow_other
  - --file-cache-timeout-in-seconds=120
  - --use-attr-cache=true
  - --cancel-list-on-mount-seconds=10  # prevent billing charges on mounting
  - -o attr_timeout=120
  - -o entry_timeout=120
  - -o negative_timeout=120
  - --log-level=LOG_WARNING  # LOG_WARNING, LOG_INFO, LOG_DEBUG
  - --cache-size-mb=1000  # Default will be 80% of available memory, eviction will happen beyond that.
```

**Disabling the cache** will help here. In this case it won't have any negative impact, since the `.py` and `.json`
files are small enough and not heavily used.

The same configuration without cache:

```yaml
  - --o direct_io
  - --file-cache-timeout-in-seconds=0
  - --use-attr-cache=false
  - --cancel-list-on-mount-seconds=10
  - --o attr_timeout=0
  - --o entry_timeout=0
  - --o negative_timeout=0
  - --log-level=LOG_WARNING
  - --cache-size-mb=0
```

You can find more information about this error [here](https://github.com/open-metadata/OpenMetadata/issues/15321), and similar
discussions [here](https://github.com/Azure/azure-storage-fuse/issues/1171) and [here](https://github.com/Azure/azure-storage-fuse/issues/1139).

# FAQs

{% partial file="/v1.7/deployment/faqs.md" /%}
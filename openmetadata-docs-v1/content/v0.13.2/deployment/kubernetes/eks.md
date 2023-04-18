---
title: AWS EKS Deployment
slug: /deployment/kubernetes/eks
---

# EKS on Amazon Web Services Deployment

OpenMetadata supports the Installation and Running of Application on Elastic Kubernetes Services (EKS) through Helm Charts.
However, there are some additional configurations which needs to be done as prerequisites for the same.

<Note>

All the code snippets in this section assume the `default` namespace for kubernetes.
This guide presumes you have AWS EKS Cluster already available.

</Note>

## Prerequisites

### Create Elastic File System in AWS

You can follow official AWS Guides [here](https://docs.aws.amazon.com/efs/latest/ug/gs-step-two-create-efs-resources.html) to provision EFS File System in the same VPC which is associated with your EKS Cluster.

### Persistent Volumes with ReadWriteMany Access Modes

OpenMetadata helm chart depends on Airflow and Airflow expects a presistent disk that support ReadWriteMany (the volume can be mounted as read-write by many nodes).

In AWS, this is achieved by Elastic File System (EFS) service. AWS Elastic Block Store (EBS) does not provide ReadWriteMany Volume access mode as EBS will only be attached to one Kubernetes Node at any given point of time.

In order to provision persistent volumes from AWS EFS, you will need to setup and install [aws-efs-csi-driver](https://docs.aws.amazon.com/eks/latest/userguide/efs-csi.html). Note that this is required for Airflow as One OpenMetadata Dependencies.

Also, [aws-ebs-csi-driver](https://docs.aws.amazon.com/eks/latest/userguide/ebs-csi.html) might be required for Persistent Volumes that are to be used for MySQL and ElasticSearch as OpenMetadata Dependencies.

The below guide provides Persistent Volumes provisioning as static volumes (meaning you will be responsible to create, maintain and destroy Persistent Volumes).

## Provision EFS backed PVs, PVCs for Airflow DAGs and Airflow Logs

Please note that we are using one AWS Elastic File System (EFS) service with sub-directories as `airflow-dags` and `airflow-logs` with the reference in this documentation. Also, it is presumed that `airflow-dags` and `airflow-logs` directories are already available on that file system.

<Collapse title="Code Samples for PV and PVC for Airflow DAGs">

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

</Collapse>

<Collapse title="Code Samples for PV and PVC for Airflow Logs">

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

</Collapse>

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

<Note>

Airflow runs the pods with linux user name as airflow and linux user id as 50000.

</Note>

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

Follow [OpenMetadata Kubernetes Deployment](/deployment/kubernetes) to install and deploy helm charts with EFS volumes.
When deploying openmetadata dependencies helm chart, use the below command -

```commandline
helm install openmetadata-dependencies open-metadata/openmetadata-dependencies --values values-dependencies.yaml
```

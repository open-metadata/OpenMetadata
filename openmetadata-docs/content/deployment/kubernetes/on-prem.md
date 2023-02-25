---
title: Kubernetes On Premises Deployment
slug: /deployment/kubernetes/onprem
---

# On Premises Kubernetes Deployment

OpenMetadata supports the Installation and Running of application on OnPremises Kubernetes through Helm Charts.
However, there are some additional configurations which needs to be done as prerequisites for the same.

<Note>

This guide presumes you have an on premises Kubernetes cluster setup and you are installing OpenMetadata in `default` namespace.

</Note>

## Prerequisites

### Persistent Volumes with ReadWriteMany Access Modes

OpenMetadata helm chart depends on Airflow and Airflow expects a presistent disk that support ReadWriteMany (the volume can be mounted as read-write by many nodes).

The workaround is to create nfs-share and use that as the presistent claim to delpoy OpenMetadata by implementing the following steps in order.

<Note>

This guide assumes you have NFS Server already setup with Hostname or IP Address which is reachable from your on premises Kubernetes cluster and you have configured a path to be used for OpenMetadata Airflow Helm Dependency.

</Note>

### Dynamic Provisioning using StorageClass

To provision PersistentVolume dynamically using the StorageClass, you need to install the NFS provisioner.
It is recommended to use [nfs-subdir-external-provisioner](https://github.com/kubernetes-sigs/nfs-subdir-external-provisioner) helm charts for this case.

```commandline
helm repo add nfs-subdir-external-provisioner https://kubernetes-sigs.github.io/nfs-subdir-external-provisioner

helm install nfs-subdir-external-provisioner nfs-subdir-external-provisioner/nfs-subdir-external-provisioner \
  --create-namespace \
  --namespace nfs-provisioner \
  --set nfs.server=<NFS_HOSTNAME_OR_IP> \
  --set nfs.path=/airflow
```

<p>
Replace the `NFS_HOSTNAME_OR_IP` with your NFS Server value and run the commands.
</p>

<p>
This will create a new StorageClass with `nfs-subdir-external-provisioner`. You can view the same using the kubectl command `kubectl get storageclass -n nfs-provisioner`.
</p>

## Provision NFS backed PVC for Airflow DAGs and Airflow Logs

<Collapse title="Code Samples for PVC for Airflow DAGs">

```yaml
# dags_pvc.yml
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  namespace: default
  name: openmetadata-dependencies-dags
  labels:
    storage.k8s.io/name: nfs
    app: airflow
spec:
  accessModes:
    - ReadWriteMany
  storageClassName: nfs-client
  resources:
    requests:
      storage: 1Gi
```

Create Persistent Volumes and Persistent Volume claims with the below command.

```commandline
kubectl create -f dags_pvc.yml
```

</Collapse>

<Collapse title="Code Samples for PVC for Airflow Logs">

```yaml
# logs_pvc.yml
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  namespace: default
  name: openmetadata-dependencies-logs
  labels:
    storage.k8s.io/name: nfs
    app: airflow
spec:
  accessModes:
    - ReadWriteMany
  storageClassName: nfs-client
  resources:
    requests:
      storage: 10Gi
```

Create Persistent Volumes and Persistent Volume claims with the below command.

```commandline
kubectl create -f logs_pvc.yml
```

</Collapse>

## Change owner and permission manually on disks

Since airflow pods run as non root users, they would not have write access on the nfs server volumes. In order to fix the permission here, spin up a pod with persistent volumes attached and run it once.

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
  - image: busybox
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
      claimName: openmetadata-dependencies-logs
  - name: airflow-dags
    persistentVolumeClaim:
      claimName: openmetadata-dependencies-dags
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

Override openmetadata dependencies airflow helm values to bind the nfs persistent volumes for DAGs and logs.

```yaml
# values-dependencies.yml
airflow:
  airflow:
    extraVolumeMounts:
      - mountPath: /airflow-logs
        name: nfs-airflow-logs
      - mountPath: /airflow-dags/dags
        name: nfs-airflow-dags
    extraVolumes:
      - name: nfs-airflow-logs
        persistentVolumeClaim:
          claimName: openmetadata-dependencies-logs
      - name: nfs-airflow-dags
        persistentVolumeClaim:
          claimName: openmetadata-dependencies-dags
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

Follow [OpenMetadata Kubernetes Deployment](/deployment/kubernetes) to install and deploy helm charts with nfs volumes.
When deploying openmetadata dependencies helm chart, use the below command -

```commandline
helm install openmetadata-dependencies open-metadata/openmetadata-dependencies --values values-dependencies.yaml
```
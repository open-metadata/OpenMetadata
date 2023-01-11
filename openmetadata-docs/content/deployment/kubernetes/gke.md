---
title: Kubernetes GKE Deployment
slug: /deployment/kubernetes/gke
---

# GKE on Google Cloud Platform Deployment

OpenMetadata supports the Installation and Running of Application on Google Kubernetes Engine through Helm Charts.
However, there are some additional configurations which needs to be done as prerequisites for the same.

<Note>

Google Kubernetes Engine (GKE) Auto Pilot Mode is not compatible with one of OpenMetadata Dependencies - ElasticSearch.
The reason being that ElasticSearch Pods require Elevated permissions to run initContainers for changing configurations which is not allowed by GKE AutoPilot PodSecurityPolicy.

</Note>

<Note>

All the code snippets in this section assume the `default` namespace for kubernetes.

</Note>

## Prerequisites

### Persistent Volumes with ReadWriteMany Access Modes

OpenMetadata helm chart depends on Airflow and Airflow expects a presistent disk that support ReadWriteMany (the volume can be mounted as read-write by many nodes).

The workaround is to create nfs-server disk on Google Kubernetes Engine and use that as the presistent claim and delpoy OpenMetadata by implementing the following steps in order.

## Create NFS Share

### Provision GCP Persistent Disk for Google Kubernetes Engine

Run the below command to create a gcloud compute zonal disk. For more information on Google Cloud Disk Options, please visit [here](https://cloud.google.com/compute/docs/disks).

```commandline
gcloud compute disks create --size=100GB --zone=<zone_id> nfs-disk
```

### Deploy NFS Server in GKE

<Collapse title="Code Samples">

```yaml
# nfs-server-deployment.yml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: nfs-server
spec:
  replicas: 1
  selector:
    matchLabels:
      role: nfs-server
  template:
    metadata:
      labels:
        role: nfs-server
    spec:
      initContainers:
      - name: init-airflow-directories
        image: busybox
        command: ['sh', '-c', 'mkdir -p /exports/airflow-dags /exports/airflow-logs']
        volumeMounts:
          - mountPath: /exports
            name: nfs-pvc
      containers:
      - name: nfs-server
        image: gcr.io/google_containers/volume-nfs:0.8
        ports:
          - name: nfs
            containerPort: 2049
          - name: mountd
            containerPort: 20048
          - name: rpcbind
            containerPort: 111
        securityContext:
          privileged: true
        volumeMounts:
          - mountPath: /exports
            name: nfs-pvc
      volumes:
        - name: nfs-pvc
          gcePersistentDisk:
            pdName: nfs-disk
            fsType: ext4
---
# nfs-cluster-ip-service.yml
apiVersion: v1
kind: Service
metadata:
  name: nfs-server
spec:
  ports:
    - name: nfs
      port: 2049
    - name: mountd
      port: 20048
    - name: rpcbind
      port: 111
  selector:
    role: nfs-server
```
Run the commands below and ensure the pods are running.

```commandline
kubectl create -f nfs-server-deployment.yml
kubectl create -f nfs-cluster-ip-service.yml
```

We create a CluserIP Service for pods to access NFS within the cluster at a fixed IP/DNS.

</Collapse>

### Provision NFS backed PV and PVC for Airflow DAGs and Airflow Logs

Update `<NFS_SERVER_CLUSTER_IP>` with the NFS Service Cluster IP Address for below code snippets.
You can get the clusterIP using the following command

```commandline
kubectl get service nfs-server -o jsonpath='{.spec.clusterIP}'
```

<Collapse title="Code Samples for PV and PVC for Airflow DAGs">

```yaml
# dags_pv_pvc.yml
apiVersion: v1
kind: PersistentVolume
metadata:
  name: openmetadata-dependencies-dags-pv
spec:
  capacity:
    storage: 10Gi
  accessModes:
    - ReadWriteMany
  nfs:
    server: <NFS_SERVER_CLUSTER_IP>
    path: "/airflow-dags"

---
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  labels:
    app: airflow
    release: openmetadata-dependencies
  name: openmetadata-dependencies-dags
  namespace: default
spec:
  accessModes:
  - ReadWriteMany
  resources:
    requests:
      storage: 10Gi
  storageClassName: ""
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
spec:
  capacity:
    storage: 10Gi
  accessModes:
    - ReadWriteMany
  nfs:
    server: <NFS_SERVER_CLUSTER_IP>
    path: "/airflow-logs"

---
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  labels:
    app: airflow
  name: openmetadata-dependencies-logs
  namespace: default
spec:
  accessModes:
  - ReadWriteMany
  resources:
    requests:
      storage: 10Gi
  storageClassName: ""
```

Create Persistent Volumes and Persistent Volume claims with the below command.

```commandline
kubectl create -f logs_pv_pvc.yml
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
  - image: nginx
    name: my-permission-pod
    volumeMounts:
    - name: airflow-dags
      mountPath: /airflow-dags
    - name: airflow-logs
      mountPath: /airflow-logs
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

Once the permissions pod is up and running, execute the below commands within the container.

```commandline
kubectl exec --tty my-permission-pod --container my-permission-pod -- chown -R 50000 /airflow-dags /airflow-logs
# If needed
kubectl exec --tty my-permission-pod --container my-permission-pod -- chmod -R a+rwx /airflow-dags
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
When deploying openmeteadata dependencies helm chart, use the below command -

```commandline
helm install openmetadata-dependencies open-metadata/openmetadata-dependencies --values values-dependencies.yaml
```
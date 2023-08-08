---
title: FAQs
slug: /deployment/kubernetes/faqs
---

# Java Memory Heap Issue

If your openmetadata pods are not in ready state at any point in time and the openmetadata pod logs speaks about the below issue -

```
Exception: java.lang.OutOfMemoryError thrown from the UncaughtExceptionHandler in thread "AsyncAppender-Worker-async-file-appender"
Exception in thread "pool-5-thread-1" java.lang.OutOfMemoryError: Java heap space
Exception in thread "AsyncAppender-Worker-async-file-appender" java.lang.OutOfMemoryError: Java heap space
Exception in thread "dw-46" java.lang.OutOfMemoryError: Java heap space
Exception in thread "AsyncAppender-Worker-async-console-appender" java.lang.OutOfMemoryError: Java heap space
```

This is due to the default JVM Heap Space configuration (1 GiB) being not enough for your workloads. In order to resolve this issue, head over to your custom openmetadata helm values and append the below environment variable

```yaml
extraEnvs:
- name: OPENMETADATA_HEAP_OPTS
  value: "-Xmx2G -Xms2G"
```

The flag `Xmx` specifies the maximum memory allocation pool for a Java virtual machine (JVM), while `Xms` specifies the initial memory allocation pool.

Upgrade the helm charts with the above changes using the following command `helm upgrade --install openmetadata open-metadata/openmetadata --values <values.yml> --namespace <namespaceName>`. Update this command your `values.yml` filename and `namespaceName` where you have deployed OpenMetadata in Kubernetes.

# PostgreSQL Issue permission denied to create extension "pgcrypto"

{% partial file="/v1.1.0/deployment/postgresql-issue-permission-denied-extension-pgcrypto.md" /%}

# How to extend and use custom docker images with OpenMetadata Helm Charts ?

## Extending OpenMetadata Server Docker Image

### 1. Create a `Dockerfile` based on `docker.getcollate.io/openmetadata/server`

OpenMetadata helm charts uses official published docker images from [DockerHub](https://hub.docker.com/u/openmetadata).
A typical scenario will be to install organization certificates for connecting with inhouse systems.

For Example -

```
FROM docker.getcollate.io/openmetadata/server:x.y.z
WORKDIR /home/
COPY <my-organization-certs> .
RUN update-ca-certificates
```
where `docker.getcollate.io/openmetadata/server:x.y.z` needs to point to the same version of the OpenMetadata server, for example `docker.getcollate.io/openmetadata/server:1.1.0`.
This image needs to be built and published to the container registry of your choice.

### 2. Update your openmetadata helm values yaml

The OpenMetadata Application gets installed as part of `openmetadata` helm chart. In this step, update the custom helm values using YAML file to point the image created in the previous step. For example, create a helm values file named `values.yaml` with the following contents -

```yaml
...
image:
  repository: <your repository>
  # Overrides the image tag whose default is the chart appVersion.
  tag: <your tag>
...
```

### 3. Install / Upgrade your helm release

Upgrade/Install your openmetadata helm charts with the below single command:

```bash
helm upgrade --install openmetadata open-metadata/openmetadata--values values.yaml
```

## Extending OpenMetadata Ingestion Docker Image

One possible use case where you would need to use a custom image for the ingestion is because you have developed your own custom connectors.
You can find a complete working example of this [here](https://github.com/open-metadata/openmetadata-demo/tree/main/custom-connector). After
you have your code ready, the steps would be the following:
  
### 1. Create a `Dockerfile` based on `docker.getcollate.io/openmetadata/ingestion`:

For example -

```
FROM docker.getcollate.io/openmetadata/ingestion:x.y.z

USER airflow
# Let's use the home directory of airflow user
WORKDIR /home/airflow

# Install our custom connector
COPY <your_package> <your_package>
COPY setup.py .
RUN pip install --no-deps .
```
  
where `docker.getcollate.io/openmetadata/ingestion:x.y.z` needs to point to the same version of the OpenMetadata server, for example `docker.getcollate.io/openmetadata/ingestion:1.1.0`.
This image needs to be built and published to the container registry of your choice.

### 2. Update the airflow in openmetadata dependencies values YAML

The ingestion containers (which is the one shipping Airflow) gets installed in the `openmetadata-dependencies` helm chart. In this step, we use
our own custom values YAML file to point to the image we just created on the previous step. You can create a file named `values.deps.yaml` with the
following contents:
  
```yaml
airflow:
  airflow:
    image:
      repository: <your repository>  # by default, openmetadata/ingestion
      tag: <your tag>  # by default, the version you are deploying, e.g., 1.1.0
      pullPolicy: "IfNotPresent"
```

### 3. Install / Upgrade helm release

Upgrade/Install your openmetadata-dependencies helm charts with the below single command:

```bash
helm upgrade --install openmetadata-dependencies open-metadata/openmetadata-dependencies --values values.deps.yaml
```

# How to disable MySQL and ElasticSearch from OpenMetadata Dependencies Helm Charts ?

If you are using MySQL and ElasticSearch externally, you would want to disable the local installation of mysql and elasticsearch while installing OpenMetadata Dependencies Helm Chart. You can disable the MySQL and ElasticSearch Helm Dependencies by setting `enabled: false` value for each dependency. Below is the command to set helm values from Helm CLI -

```commandline
helm upgrade --install openmetadata-dependencies open-metadata/openmetadata-dependencies --set mysql.enabled=false --set elasticsearch.enabled=false
```

Alternatively, you can create a custom YAML file named `values.deps.yaml` to disable installation of MySQL and ELasticSearch.

```yaml
mysql:
    enabled: false
    ...
elasticsearch:
    enabled: false
    ...
...
```
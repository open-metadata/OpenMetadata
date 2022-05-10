---
description: >-
  This guide will help you upgrade your OpenMetadata Kubernetes Application with
  automated helm hooks.
---

# Upgrade OpenMetadata on Kubernetes

> {% hint style="danger" %}
> **The 0.10 Release consists of backward-incompatible changes. We do not support database migration from the 0.9.0 release. Please follow the steps carefully and backup your database before proceeding.**
>
> **0.10.0 installations require brand new installation and we have a migration tool to transfer all your entity descriptions, tags, owners, etc.. to the 0.10.0 release**&#x20;
>
> Please reach out to us at [https://slack.open-metadata.org](https://slack.open-metadata.org) , we can schedule a zoom session to help you upgrade your production instance.
> {% endhint %}

## Requirements

This guide assumes that you have an OpenMetadata deployment that you installed and configured following the [Run OpenMetadata](../../deploy/deploy-on-kubernetes/run-in-kubernetes.md) guide.

## Procedure

{% hint style="info" %}
**Backup your metadata**

Follow the [Backup Metadata](https://github.com/open-metadata/OpenMetadata/blob/docs/upgrade/upgrade-on-kubernetes/broken-reference/README.md) guide to ensure you have a restorable copy of your metadata before proceeding further.
{% endhint %}

{% hint style="danger" %}
At this moment, OpenMetadata does not support Rollbacks as part of Database Migrations. Please proceed cautiously or connect with us on [Slack](https://join.slack.com/t/openmetadata/shared\_invite/zt-wksh1bww-iQGk45NTw6Tp4Q9UZd6QOw).
{% endhint %}

{% hint style="success" %}
This guide assumes your helm chart release names are _openmetadata_ and _openmetadata-dependencies._
{% endhint %}

### Upgrade Helm Repository with a new release

Update Helm Chart Locally for open-metadata with the below command.

```
helm repo update open-metadata
```

It will result in the below output on screen.

> ```
> Hang tight while we grab the latest from your chart repositories...
> ...Successfully got an update from the "open-metadata" chart repository
> Update Complete. ⎈Happy Helming!⎈
> ```

Verify with the below command to see the latest release available locally.

```
helm search repo open-metadata --versions
```

```
NAME                                   	CHART VERSION	APP VERSION	DESCRIPTION                                
open-metadata/openmetadata             	0.0.16       	0.10.0     	A Helm chart for OpenMetadata on Kubernetes
open-metadata/openmetadata             	0.0.15       	0.9.1      	A Helm chart for OpenMetadata on Kubernetes
open-metadata/openmetadata             	0.0.14       	0.9.0      	A Helm chart for OpenMetadata on Kubernetes
open-metadata/openmetadata             	0.0.13       	0.9.0      	A Helm chart for OpenMetadata on Kubernetes
open-metadata/openmetadata             	0.0.12       	0.9.0      	A Helm chart for OpenMetadata on Kubernetes
open-metadata/openmetadata             	0.0.11       	0.8.4      	A Helm chart for OpenMetadata on Kubernetes
open-metadata/openmetadata             	0.0.10       	0.8.4      	A Helm chart for OpenMetadata on Kubernetes
open-metadata/openmetadata             	0.0.9        	0.8.3      	A Helm chart for OpenMetadata on Kubernetes
open-metadata/openmetadata             	0.0.8        	0.8.3      	A Helm chart for OpenMetadata on Kubernetes
open-metadata/openmetadata             	0.0.7        	0.8.0      	A Helm chart for OpenMetadata on Kubernetes
open-metadata/openmetadata             	0.0.6        	0.8.0      	A Helm chart for OpenMetadata on Kubernetes
open-metadata/openmetadata             	0.0.5        	0.8.0      	A Helm chart for OpenMetadata on Kubernetes
open-metadata/openmetadata             	0.0.4        	0.8.0      	A Helm chart for OpenMetadata on Kubernetes
open-metadata/openmetadata             	0.0.3        	0.7.0      	A Helm chart for OpenMetadata on Kubernetes
open-metadata/openmetadata             	0.0.2        	0.6.0      	A Helm chart for OpenMetadata on Kubernetes
open-metadata/openmetadata             	0.0.1        	0.5.0      	A Helm chart for OpenMetadata on Kubernetes
open-metadata/openmetadata-dependencies	0.0.16       	0.10.0     	Helm Dependencies for OpenMetadata         
open-metadata/openmetadata-dependencies	0.0.15       	0.9.1      	Helm Dependencies for OpenMetadata         
open-metadata/openmetadata-dependencies	0.0.14       	0.9.0      	Helm Dependencies for OpenMetadata         
open-metadata/openmetadata-dependencies	0.0.13       	0.9.0      	Helm Dependencies for OpenMetadata         
open-metadata/openmetadata-dependencies	0.0.12       	0.9.0      	Helm Dependencies for OpenMetadata         
open-metadata/openmetadata-dependencies	0.0.11       	0.8.4      	Helm Dependencies for OpenMetadata         
open-metadata/openmetadata-dependencies	0.0.10       	0.8.4      	Helm Dependencies for OpenMetadata         
open-metadata/openmetadata-dependencies	0.0.9        	0.8.3      	Helm Dependencies for OpenMetadata         
open-metadata/openmetadata-dependencies	0.0.8        	0.8.3      	Helm Dependencies for OpenMetadata         
open-metadata/openmetadata-dependencies	0.0.7        	0.8.0      	Helm Dependencies for OpenMetadata         
open-metadata/openmetadata-dependencies	0.0.6        	0.8.0      	Helm Dependencies for OpenMetadata         
open-metadata/openmetadata-dependencies	0.0.5        	0.8.0      	Helm Dependencies for OpenMetadata         
open-metadata/openmetadata-dependencies	0.0.4        	0.8.0      	Helm Dependencies for OpenMetadata         
open-metadata/openmetadata-dependencies	0.0.3        	0.7.0      	Helm Dependencies for OpenMetadata         
open-metadata/openmetadata-dependencies	0.0.2        	0.6.0      	Helm Dependencies for OpenMetadata         
open-metadata/openmetadata-dependencies	0.0.1        	0.5.0      	Helm Dependencies for OpenMetadata
```

### Upgrade OpenMetadata Dependencies

We upgrade OpenMetadata Dependencies with the  below command

```
helm upgrade openmetadata-dependencies open-metadata/openmetadata-dependencies
```

### Upgrade OpenMetdata

We upgrade OpenMetadata with the below command

```
helm upgrade openmetadata open-metadata/openmetadata
```

{% hint style="info" %}
Starting from `0.0.6` open-metadata helm release, we support automatic repair and migration of databases. This will **ONLY** be handled on Helm chart upgrades to the latest versions going-forward.
{% endhint %}

## Troubleshooting for 0.10 Release

{% hint style="danger" %}
If you are upgrading from previous releases to 0.10, you might encounter the below logs which indicates that the 0.10 release is **backward incompatible**.
{% endhint %}

```
[I/O dispatcher 1] DEBUG org.apache.http.impl.nio.client.InternalIODispatch - http-outgoing-0 [ACTIVE] [content length: 263; pos: 263; completed: true]
[main] DEBUG org.elasticsearch.client.RestClient - request [PUT http://elasticsearch:9200/glossary_search_index/_mapping?master_timeout=30s&ignore_unavailable=false&expand_wildcards=open%2Cclosed&allow_no_indices=false&ignore_throttled=false&timeout=30s] returned [HTTP/1.1 400 Bad Request]
[main] ERROR org.openmetadata.catalog.elasticsearch.ElasticSearchIndexDefinition - Failed to update Elastic Search indexes due to
org.elasticsearch.ElasticsearchStatusException: Elasticsearch exception [type=illegal_argument_exception, reason=can't merge a non object mapping [owner] with an object mapping]
    at org.elasticsearch.rest.BytesRestResponse.errorFromXContent(BytesRestResponse.java:176)
    at org.elasticsearch.client.RestHighLevelClient.parseEntity(RestHighLevelClient.java:1933)
    at org.elasticsearch.client.RestHighLevelClient.parseResponseException(RestHighLevelClient.java:1910)
    at org.elasticsearch.client.RestHighLevelClient.internalPerformRequest(RestHighLevelClient.java:1667)
    at org.elasticsearch.client.RestHighLevelClient.performRequest(RestHighLevelClient.java:1639)
    at org.elasticsearch.client.RestHighLevelClient.performRequestAndParseEntity(RestHighLevelClient.java:1606)
    at org.elasticsearch.client.IndicesClient.putMapping(IndicesClient.java:342)
    at org.openmetadata.catalog.elasticsearch.ElasticSearchIndexDefinition.updateIndex(ElasticSearchIndexDefinition.java:139)
    at org.openmetadata.catalog.elasticsearch.ElasticSearchIndexDefinition.updateIndexes(ElasticSearchIndexDefinition.java:91)
    at org.openmetadata.catalog.util.TablesInitializer.execute(TablesInitializer.java:227)
    at org.openmetadata.catalog.util.TablesInitializer.main(TablesInitializer.java:149)
    Suppressed: org.elasticsearch.client.ResponseException: method [PUT], host [http://elasticsearch:9200], URI [/glossary_search_index/_mapping?master_timeout=30s&ignore_unavailable=false&expand_wildcards=open%2Cclosed&allow_no_indices=false&ignore_throttled=false&timeout=30s], status line [HTTP/1.1 400 Bad Request]
{"error":{"root_cause":[{"type":"illegal_argument_exception","reason":"can't merge a non object mapping [owner] with an object mapping"}],"type":"illegal_argument_exception","reason":"can't merge a non object mapping [owner] with an object mapping"},"status":400}
        at org.elasticsearch.client.RestClient.convertResponse(RestClient.java:326)
        at org.elasticsearch.client.RestClient.performRequest(RestClient.java:296)
        at org.elasticsearch.client.RestClient.performRequest(RestClient.java:270)
        at org.elasticsearch.client.RestHighLevelClient.internalPerformRequest(RestHighLevelClient.java:1654)
        ... 7 common frames omitted
```

To resolve this issue perform the following steps after upgrading the OpenMetadata helm charts.

### Step 1

List the openmetadata pod running with the below command

```markdown
kubectl get pods
```

```
NAME                            READY   STATUS    RESTARTS   AGE
elasticsearch-0                 1/1     Running   0          38m
mysql-0                         1/1     Running   0          38m
openmetadata-6488765769-b8nw7   1/1     Running   0          5m47s
```

### Step 2

Execute the drop-create-all command in the openmetadata pod. This will ensure that the database and Elasticsearch Indexes are in sync with OpenMetadata Release 0.10.0

```markdown
kubectl exec openmetadata-6488765769-b8nw7 -- /bin/bash /openmetadata-0.10.0/bootstrap/bootstrap_storage.sh drop-create-all
```

### Step 3

Delete the pod and let Kubernetes manually create a new one

```
kubectl delete pod openmetadata-6488765769-b8nw7
```

```
pod "openmetadata-6488765769-b8nw7" deleted
```

## What's Next

Head on to the [connectors](../../docs/integrations/connectors/) section to ingest data from various sources.

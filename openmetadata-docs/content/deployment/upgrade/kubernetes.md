---
title: Upgrade on Kubernetes
slug: /deployment/upgrade/kubernetes
---

# Upgrade on Kubernetes

This guide will help you upgrade your OpenMetadata Kubernetes Application with automated helm hooks.

## Requirements

This guide assumes that you have an OpenMetadata deployment that you installed and configured following the 
[Kubernetes Deployment](/deployment/kubernetes) guide.

We also assume that your helm chart release names are `openmetadata` and `openmetadata-dependencies` and namespace used is
`default`.

## Upgrade Helm Repository with a new release

Update Helm Chart Locally for OpenMetadata with the below command:

```commandline
helm repo update open-metadata
```

It will result in the below output on screen.

```commandline
Hang tight while we grab the latest from your chart repositories...
...Successfully got an update from the "open-metadata" chart repository
Update Complete. ⎈Happy Helming!⎈
```

Verify with the below command to see the latest release available locally.

```commandline
helm search repo open-metadata --versions
> NAME                                   	CHART VERSION	APP VERSION	DESCRIPTION                                
open-metadata/openmetadata             	0.0.16       	0.10.0     	A Helm chart for OpenMetadata on Kubernetes
open-metadata/openmetadata             	0.0.15       	0.9.1      	A Helm chart for OpenMetadata on Kubernetes
open-metadata/openmetadata             	0.0.14       	0.9.0      	A Helm chart for OpenMetadata on Kubernetes
open-metadata/openmetadata             	0.0.13       	0.9.0      	A Helm chart for OpenMetadata on Kubernetes
open-metadata/openmetadata             	0.0.12       	0.9.0      	A Helm chart for OpenMetadata on Kubernetes
open-metadata/openmetadata             	0.0.11       	0.8.4      	A Helm chart for OpenMetadata on Kubernetes
open-metadata/openmetadata             	0.0.10       	...
open-metadata/openmetadata-dependencies	0.0.16       	0.10.0     	Helm Dependencies for OpenMetadata         
open-metadata/openmetadata-dependencies	0.0.15       	0.9.1      	Helm Dependencies for OpenMetadata         
open-metadata/openmetadata-dependencies	0.0.14       	0.9.0      	Helm Dependencies for OpenMetadata         
open-metadata/openmetadata-dependencies	0.0.13       	0.9.0      	Helm Dependencies for OpenMetadata         
open-metadata/openmetadata-dependencies	0.0.12       	0.9.0      	Helm Dependencies for OpenMetadata         
open-metadata/openmetadata-dependencies	0.0.11       	...
```

## Upgrade OpenMetadata Dependencies

We upgrade OpenMetadata Dependencies with the below command:

```commandline
helm upgrade openmetadata-dependencies open-metadata/openmetadata-dependencies
```

<Note>

The above command uses configurations defined [here](https://raw.githubusercontent.com/open-metadata/openmetadata-helm-charts/main/charts/deps/values.yaml).
You can modify any configuration and deploy by passing your own `values.yaml`.

</Note>

## Upgrade OpenMetdata

We upgrade OpenMetadata with the below command:

```commandline
helm upgrade openmetadata open-metadata/openmetadata
```

You might need to pass your own `values.yaml` with the `--values` flag

---

## Troubleshooting for 0.10 Release

If you are upgrading from previous releases to 0.10, you might encounter the below logs which indicates that the 0.10
release is backward incompatible.

```commandline
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

Note that to migrate, you'll need a fresh installation! Follow the [upgrade guide](/deployment/upgrade/versions/090-to-010) for more details.

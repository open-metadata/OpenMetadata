package org.openmetadata.service.search.opensearch;

import static org.openmetadata.service.events.scheduled.ServicesStatusJobHandler.HEALTHY_STATUS;
import static org.openmetadata.service.events.scheduled.ServicesStatusJobHandler.UNHEALTHY_STATUS;

import java.io.IOException;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.service.search.GenericClient;
import org.openmetadata.service.search.SearchClusterMetrics;
import org.openmetadata.service.search.SearchHealthStatus;
import os.org.opensearch.client.json.JsonData;
import os.org.opensearch.client.opensearch.OpenSearchClient;
import os.org.opensearch.client.opensearch._types.HealthStatus;
import os.org.opensearch.client.opensearch._types.OpenSearchException;
import os.org.opensearch.client.opensearch.cluster.ClusterStatsResponse;
import os.org.opensearch.client.opensearch.cluster.GetClusterSettingsResponse;
import os.org.opensearch.client.opensearch.cluster.HealthResponse;
import os.org.opensearch.client.opensearch.generic.OpenSearchGenericClient;
import os.org.opensearch.client.opensearch.generic.Requests;
import os.org.opensearch.client.opensearch.indices.DataStream;
import os.org.opensearch.client.opensearch.indices.GetDataStreamResponse;
import os.org.opensearch.client.opensearch.nodes.NodesStatsResponse;
import os.org.opensearch.client.opensearch.nodes.stats.Stats;
import os.org.opensearch.client.transport.httpclient5.ApacheHttpClient5Transport;

@Slf4j
public class OpenSearchGenericManager implements GenericClient {
  private final OpenSearchClient client;
  private final ApacheHttpClient5Transport transport;
  private final boolean isClientAvailable;
  private final boolean isTransportAvailable;

  public OpenSearchGenericManager(OpenSearchClient client, ApacheHttpClient5Transport transport) {
    this.client = client;
    this.isClientAvailable = client != null;
    this.transport = transport;
    this.isTransportAvailable = transport != null;
  }

  @Override
  public List<String> getDataStreams(String prefix) throws IOException {
    if (!isClientAvailable) {
      LOG.error("OpenSearch client is not available. Cannot get data streams.");
      return Collections.emptyList();
    }
    try {
      GetDataStreamResponse response = client.indices().getDataStream(g -> g.name(prefix + "*"));
      return response.dataStreams().stream().map(DataStream::name).collect(Collectors.toList());
    } catch (OpenSearchException e) {
      if (e.status() == 404) {
        LOG.warn("No DataStreams exist with prefix '{}'. Skipping.", prefix);
        return Collections.emptyList();
      } else {
        LOG.error("Failed to find DataStreams with prefix: {}", prefix, e);
        throw e;
      }
    } catch (Exception e) {
      LOG.error("Failed to get data streams with prefix {}", prefix, e);
      throw e;
    }
  }

  @Override
  public void deleteDataStream(String dataStreamName) throws IOException {
    if (!isClientAvailable) {
      LOG.error("OpenSearch client is not available. Cannot delete data stream.");
      return;
    }
    try {
      client.indices().deleteDataStream(d -> d.name(dataStreamName));
      LOG.info("Successfully deleted data stream: {}", dataStreamName);
    } catch (OpenSearchException e) {
      if (e.status() == 404) {
        LOG.warn("Data stream {} does not exist. Skipping deletion.", dataStreamName);
      } else {
        LOG.error("Failed to delete data stream: {}", dataStreamName, e);
        throw e;
      }
    } catch (Exception e) {
      LOG.error("Failed to delete data stream {}", dataStreamName, e);
      throw e;
    }
  }

  @Override
  public void deleteILMPolicy(String policyName) throws IOException {
    if (!isClientAvailable) {
      LOG.error("OpenSearch client is not available. Cannot delete ISM policy.");
      return;
    }
    try {
      OpenSearchGenericClient genericClient = client.generic();
      var response =
          genericClient.execute(
              Requests.builder()
                  .method("DELETE")
                  .endpoint("/_plugins/_ism/policies/" + policyName)
                  .build());

      int statusCode = response.getStatus();
      if (statusCode == 200) {
        LOG.info("Successfully deleted ISM policy: {}", policyName);
      } else if (statusCode == 404) {
        LOG.warn("ISM policy {} does not exist. Skipping deletion.", policyName);
      } else {
        LOG.error("Failed to delete ILM policy: {}", policyName);
        throw new IOException("Failed to delete ISM policy: HTTP " + statusCode);
      }
    } catch (OpenSearchException e) {
      if (e.status() == 404) {
        LOG.warn("ISM Policy {} does not exist. Skipping deletion.", policyName);
      } else {
        throw new IOException("Failed to delete ISM policy: " + e.getMessage());
      }
    } catch (Exception e) {
      LOG.error("Failed to delete ISM policy {}", policyName, e);
      throw e;
    }
  }

  @Override
  public void deleteIndexTemplate(String templateName) throws IOException {
    if (!isClientAvailable) {
      LOG.error("OpenSearch client is not available. Cannot delete index template.");
      return;
    }
    try {
      client.indices().deleteIndexTemplate(d -> d.name(templateName));
      LOG.info("Successfully deleted index template: {}", templateName);
    } catch (OpenSearchException e) {
      if (e.status() == 404) {
        LOG.warn("Index template {} does not exist. Skipping deletion.", templateName);
      } else {
        LOG.error("Failed to delete index template: {}", templateName, e);
        throw e;
      }
    } catch (Exception e) {
      LOG.error("Failed to delete index template {}", templateName, e);
      throw e;
    }
  }

  @Override
  public void deleteComponentTemplate(String componentTemplateName) throws IOException {
    if (!isClientAvailable) {
      LOG.error("OpenSearch client is not available. Cannot delete component template.");
      return;
    }
    try {
      client.cluster().deleteComponentTemplate(d -> d.name(componentTemplateName));
      LOG.info("Successfully deleted component template: {}", componentTemplateName);
    } catch (OpenSearchException e) {
      if (e.status() == 404) {
        LOG.warn("Component template {} does not exist. Skipping deletion.", componentTemplateName);
      } else {
        LOG.error("Failed to delete component template: {}", componentTemplateName, e);
        throw e;
      }
    } catch (Exception e) {
      LOG.error("Failed to delete component template {}", componentTemplateName, e);
      throw e;
    }
  }

  @Override
  public void dettachIlmPolicyFromIndexes(String indexPattern) throws IOException {
    if (!isClientAvailable) {
      LOG.error("OpenSearch client is not available. Cannot detach ISM policy from indexes.");
      return;
    }
    try {
      var getIndexResponse = client.indices().get(g -> g.index(indexPattern));

      if (getIndexResponse.result().isEmpty()) {
        LOG.warn("No indices found matching pattern: {}", indexPattern);
        return;
      }

      OpenSearchGenericClient genericClient = client.generic();

      for (String indexName : getIndexResponse.result().keySet()) {
        try {
          var response =
              genericClient.execute(
                  Requests.builder()
                      .method("PUT")
                      .endpoint("/" + indexName + "/_settings")
                      .json("{\"index.plugins.index_state_management.policy_id\": null}")
                      .build());

          if (response.getStatus() == 200) {
            LOG.info("Detached ISM policy from index: {}", indexName);
          } else {
            LOG.warn(
                "Failed to detach ISM policy from index: {}. Status: {}",
                indexName,
                response.getStatus());
          }
        } catch (OpenSearchException e) {
          if (e.status() == 404) {
            LOG.warn("Index {} does not exist. Skipping.", indexName);
          } else {
            LOG.error("Failed to detach ISM policy from index: {}", indexName, e);
          }
        } catch (Exception e) {
          LOG.error("Error detaching ISM policy from index: {}", indexName, e);
        }
      }
    } catch (OpenSearchException e) {
      if (e.status() == 404) {
        LOG.warn("No indices found matching pattern '{}'. Skipping.", indexPattern);
      } else {
        LOG.error("Failed to get indices matching pattern: {}", indexPattern, e);
        throw e;
      }
    } catch (Exception e) {
      LOG.error("Error detaching ISM policy from indexes matching pattern: {}", indexPattern, e);
      throw e;
    }
  }

  public ClusterStatsResponse clusterStats() throws IOException {
    if (!isClientAvailable) {
      LOG.error("OpenSearch client is not available. Cannot fetch cluster stats.");
      throw new IOException("OpenSearch client is not available");
    }
    try {
      return client.cluster().stats();
    } catch (Exception e) {
      LOG.error("Failed to fetch cluster stats", e);
      throw new IOException("Failed to fetch cluster stats: " + e.getMessage());
    }
  }

  public NodesStatsResponse nodesStats() throws IOException {
    if (!isClientAvailable) {
      LOG.error("OpenSearch client is not available. Cannot fetch nodes stats.");
      throw new IOException("OpenSearch client is not available");
    }
    try {
      return client.nodes().stats();
    } catch (Exception e) {
      LOG.error("Failed to fetch nodes stats", e);
      throw new IOException("Failed to fetch nodes stats: " + e.getMessage());
    }
  }

  public GetClusterSettingsResponse clusterSettings() throws IOException {
    if (!isClientAvailable) {
      LOG.error("OpenSearch client is not available. Cannot fetch cluster settings.");
      throw new IOException("OpenSearch client is not available");
    }
    try {
      return client.cluster().getSettings();
    } catch (Exception e) {
      LOG.error("Failed to fetch cluster settings", e);
      throw new IOException("Failed to fetch cluster settings: " + e.getMessage());
    }
  }

  public double averageCpuPercentFromNodesStats(NodesStatsResponse nodesStats) {
    if (nodesStats == null || nodesStats.nodes() == null || nodesStats.nodes().isEmpty()) {
      LOG.warn("Unable to extract CPU percent from response, using default 50%");
      return SearchClusterMetrics.DEFAULT_CPU_PERCENT;
    }

    double total = 0.0;
    int count = 0;

    for (Stats nodeStats : nodesStats.nodes().values()) {
      var os = nodeStats.os();
      var cpu = os != null ? os.cpu() : null;

      if (cpu != null) {
        total += cpu.percent();
        count++;
      }
    }

    if (count > 0) return total / count;

    LOG.warn("Unable to extract CPU percent from response, using default 50%");
    return SearchClusterMetrics.DEFAULT_CPU_PERCENT;
  }

  public Map<String, Object> extractJvmMemoryStats(NodesStatsResponse nodesStats) {
    Map<String, Object> result = new HashMap<>();

    long heapUsedBytes = SearchClusterMetrics.DEFAULT_HEAP_USED_BYTES;
    long heapMaxBytes = SearchClusterMetrics.DEFAULT_HEAP_MAX_BYTES;

    if (nodesStats != null && nodesStats.nodes() != null && !nodesStats.nodes().isEmpty()) {
      Stats firstNodeStats = nodesStats.nodes().values().iterator().next();
      if (firstNodeStats != null
          && firstNodeStats.jvm() != null
          && firstNodeStats.jvm().mem() != null) {
        try {
          // Note: OpenSearch Java client may return null for these fields in certain scenarios
          // (AWS-managed OpenSearch, older versions, etc.), causing NPE during unboxing.
          // See: https://github.com/opensearch-project/opensearch-java/issues/1040
          heapUsedBytes = firstNodeStats.jvm().mem().heapUsedInBytes();
          heapMaxBytes = firstNodeStats.jvm().mem().heapMaxInBytes();
        } catch (NullPointerException e) {
          LOG.warn(
              "OpenSearch returned null JVM memory stats (likely AWS-managed cluster or missing stats). "
                  + "Using defaults: heapUsed={}MB, heapMax={}MB",
              SearchClusterMetrics.DEFAULT_HEAP_USED_BYTES / (1024 * 1024),
              SearchClusterMetrics.DEFAULT_HEAP_MAX_BYTES / (1024 * 1024));
        }
      }
    }

    result.put("heapMaxBytes", heapMaxBytes);
    double memoryUsagePercent =
        heapMaxBytes > 0 ? (double) heapUsedBytes / heapMaxBytes * 100.0 : -1.0;
    result.put("memoryUsagePercent", memoryUsagePercent);

    return result;
  }

  public String extractMaxContentLengthStr(GetClusterSettingsResponse clusterSettings) {
    try {
      String maxContentLengthStr = null;

      Map<String, JsonData> persistentSettings = clusterSettings.persistent();
      if (persistentSettings != null && persistentSettings.containsKey("http.max_content_length")) {
        JsonData value = persistentSettings.get("http.max_content_length");
        if (value != null) {
          maxContentLengthStr = value.to(String.class);
        }
      }

      if (maxContentLengthStr == null) {
        Map<String, JsonData> transientSettings = clusterSettings.transient_();
        if (transientSettings != null && transientSettings.containsKey("http.max_content_length")) {
          JsonData value = transientSettings.get("http.max_content_length");
          if (value != null) {
            maxContentLengthStr = value.to(String.class);
          }
        }
      }

      return maxContentLengthStr;

    } catch (Exception e) {
      LOG.warn("Failed to extract maxContentLength from cluster settings: {}", e.getMessage());
      return null;
    }
  }

  public SearchHealthStatus getSearchHealthStatus() throws IOException {
    if (!isClientAvailable) {
      LOG.error("OpenSearch client is not available. Cannot fetch cluster health.");
      throw new IOException("OpenSearch client is not available");
    }
    try {
      HealthResponse response = client.cluster().health();
      HealthStatus status = response.status();
      if (status == HealthStatus.Green || status == HealthStatus.Yellow) {
        return new SearchHealthStatus(HEALTHY_STATUS);
      } else {
        return new SearchHealthStatus(UNHEALTHY_STATUS);
      }
    } catch (Exception e) {
      LOG.error("Failed to fetch cluster health", e);
      throw new IOException("Failed to fetch cluster health: " + e.getMessage());
    }
  }
}

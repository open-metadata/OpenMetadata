package org.openmetadata.service.search.elasticsearch;

import static org.openmetadata.service.events.scheduled.ServicesStatusJobHandler.HEALTHY_STATUS;
import static org.openmetadata.service.events.scheduled.ServicesStatusJobHandler.UNHEALTHY_STATUS;

import es.co.elastic.clients.elasticsearch.ElasticsearchClient;
import es.co.elastic.clients.elasticsearch._types.ElasticsearchException;
import es.co.elastic.clients.elasticsearch._types.HealthStatus;
import es.co.elastic.clients.elasticsearch.cluster.ClusterStatsResponse;
import es.co.elastic.clients.elasticsearch.cluster.ComponentTemplateNode;
import es.co.elastic.clients.elasticsearch.cluster.ComponentTemplateSummary;
import es.co.elastic.clients.elasticsearch.cluster.GetClusterSettingsResponse;
import es.co.elastic.clients.elasticsearch.cluster.GetComponentTemplateResponse;
import es.co.elastic.clients.elasticsearch.cluster.HealthResponse;
import es.co.elastic.clients.elasticsearch.indices.Alias;
import es.co.elastic.clients.elasticsearch.indices.AliasDefinition;
import es.co.elastic.clients.elasticsearch.indices.DataStream;
import es.co.elastic.clients.elasticsearch.indices.GetDataStreamResponse;
import es.co.elastic.clients.elasticsearch.nodes.Cpu;
import es.co.elastic.clients.elasticsearch.nodes.NodesStatsResponse;
import es.co.elastic.clients.elasticsearch.nodes.Stats;
import es.co.elastic.clients.json.JsonData;
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

@Slf4j
public class ElasticSearchGenericManager implements GenericClient {
  private final ElasticsearchClient client;
  private final boolean isClientAvailable;

  public ElasticSearchGenericManager(ElasticsearchClient client) {
    this.client = client;
    this.isClientAvailable = client != null;
  }

  @Override
  public List<String> getDataStreams(String prefix) throws IOException {
    if (!isClientAvailable) {
      LOG.error("ElasticSearch client is not available. Cannot get data streams.");
      return Collections.emptyList();
    }
    try {
      GetDataStreamResponse response = client.indices().getDataStream(g -> g.name(prefix + "*"));
      return response.dataStreams().stream().map(DataStream::name).collect(Collectors.toList());
    } catch (ElasticsearchException e) {
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
      LOG.error("ElasticSearch client is not available. Cannot delete data stream.");
      return;
    }
    try {
      client.indices().deleteDataStream(d -> d.name(dataStreamName));
      LOG.info("Successfully deleted data stream: {}", dataStreamName);
    } catch (ElasticsearchException e) {
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
      LOG.error("ElasticSearch client is not available. Cannot delete ILM policy.");
      return;
    }
    try {
      client.ilm().deleteLifecycle(req -> req.name(policyName));
      LOG.info("Successfully deleted ILM policy: {}", policyName);
    } catch (ElasticsearchException e) {
      if (e.status() == 404) {
        LOG.warn("ILM policy {} does not exist. Skipping deletion.", policyName);
      } else {
        LOG.error("Failed to delete ILM policy: {}", policyName, e);
        throw e;
      }
    } catch (Exception e) {
      LOG.error("Failed to delete ILM policy {}", policyName, e);
      throw e;
    }
  }

  @Override
  public void deleteIndexTemplate(String templateName) throws IOException {
    if (!isClientAvailable) {
      LOG.error("ElasticSearch client is not available. Cannot delete index template.");
      return;
    }
    try {
      client.indices().deleteIndexTemplate(d -> d.name(templateName));
      LOG.info("Successfully deleted index template: {}", templateName);
    } catch (ElasticsearchException e) {
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
      LOG.error("ElasticSearch client is not available. Cannot delete component template.");
      return;
    }
    try {
      client.cluster().deleteComponentTemplate(d -> d.name(componentTemplateName));
      LOG.info("Successfully deleted component template: {}", componentTemplateName);
    } catch (ElasticsearchException e) {
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
      LOG.error("ElasticSearch client is not available. Cannot detach ILM policy from indexes.");
      return;
    }
    try {
      var getIndexResponse = client.indices().get(g -> g.index(indexPattern));

      if (getIndexResponse.indices().isEmpty()) {
        LOG.warn("No indices found matching pattern: {}", indexPattern);
        return;
      }

      for (String indexName : getIndexResponse.indices().keySet()) {
        try {
          client
              .indices()
              .putSettings(
                  s -> s.index(indexName).settings(idx -> idx.lifecycle(l -> l.name(null))));
          LOG.info("Detached ILM policy from index: {}", indexName);
        } catch (ElasticsearchException e) {
          if (e.status() == 404) {
            LOG.warn("Index {} does not exist. Skipping.", indexName);
          } else {
            LOG.error("Failed to detach ILM policy from index: {}", indexName, e);
          }
        } catch (Exception e) {
          LOG.error("Error detaching ILM policy from index: {}", indexName, e);
        }
      }
    } catch (ElasticsearchException e) {
      if (e.status() == 404) {
        LOG.warn("No indices found matching pattern '{}'. Skipping.", indexPattern);
      } else {
        LOG.error("Failed to get indices matching pattern: {}", indexPattern, e);
        throw e;
      }
    } catch (Exception e) {
      LOG.error("Error detaching ILM policy from indexes matching pattern: {}", indexPattern, e);
      throw e;
    }
  }

  @Override
  public void removeILMFromComponentTemplate(String componentTemplateName) throws IOException {
    if (!isClientAvailable) {
      LOG.error(
          "ElasticSearch client is not available. Cannot remove ILM policy from component template.");
      return;
    }
    try {
      GetComponentTemplateResponse getResponse =
          client.cluster().getComponentTemplate(g -> g.name(componentTemplateName));

      if (getResponse.componentTemplates().isEmpty()) {
        LOG.warn("Component template {} does not exist. Skipping.", componentTemplateName);
        return;
      }

      ComponentTemplateNode componentTemplate =
          getResponse.componentTemplates().getFirst().componentTemplate();
      ComponentTemplateSummary template = componentTemplate.template();

      if (template != null && template.settings() != null) {
        // Update the component template with ILM policy removed
        client
            .cluster()
            .putComponentTemplate(
                p ->
                    p.name(componentTemplateName)
                        .template(
                            t -> {
                              // Remove ILM by not including it
                              t.settings(
                                  s -> {
                                    return s; // empty settings means no ILM
                                  });

                              // Copy mappings if they exist
                              if (template.mappings() != null) {
                                t.mappings(template.mappings());
                              }

                              // Convert and preserve aliases
                              if (template.aliases() != null) {
                                t.aliases(
                                    template.aliases().entrySet().stream()
                                        .collect(
                                            Collectors.toMap(
                                                Map.Entry::getKey,
                                                entry ->
                                                    Alias.of(
                                                        a -> {
                                                          AliasDefinition def = entry.getValue();
                                                          if (def.filter() != null)
                                                            a.filter(def.filter());
                                                          if (def.indexRouting() != null)
                                                            a.indexRouting(def.indexRouting());
                                                          if (def.searchRouting() != null)
                                                            a.searchRouting(def.searchRouting());
                                                          if (def.isWriteIndex() != null)
                                                            a.isWriteIndex(def.isWriteIndex());
                                                          return a;
                                                        }))));
                              }
                              return t;
                            }));

        LOG.info(
            "Successfully removed ILM policy from component template: {}", componentTemplateName);
      } else {
        LOG.info(
            "Component template {} has no settings or lifecycle policy. No changes needed.",
            componentTemplateName);
      }
    } catch (ElasticsearchException e) {
      if (e.status() == 404) {
        LOG.warn("Component template {} does not exist. Skipping.", componentTemplateName);
      } else {
        LOG.error(
            "Failed to remove ILM policy from component template: {}", componentTemplateName, e);
        throw e;
      }
    } catch (Exception e) {
      LOG.error("Error removing ILM policy from component template: {}", componentTemplateName, e);
      throw e;
    }
  }

  public ClusterStatsResponse clusterStats() throws IOException {
    if (!isClientAvailable) {
      LOG.error("ElasticSearch client is not available. Cannot fetch cluster stats.");
      throw new IOException("ElasticSearch client is not available");
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
      LOG.error("ElasticSearch client is not available. Cannot fetch nodes stats.");
      throw new IOException("ElasticSearch client is not available");
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
      LOG.error("ElasticSearch client is not available. Cannot fetch cluster settings.");
      throw new IOException("ElasticSearch client is not available");
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
      Cpu cpu = nodeStats.os() != null ? nodeStats.os().cpu() : null;
      if (cpu != null && cpu.percent() != null) {
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

      if (firstNodeStats.jvm() != null && firstNodeStats.jvm().mem() != null) {
        if (firstNodeStats.jvm().mem().heapUsedInBytes() != null) {
          heapUsedBytes = firstNodeStats.jvm().mem().heapUsedInBytes();
        }
        if (firstNodeStats.jvm().mem().heapMaxInBytes() != null) {
          heapMaxBytes = firstNodeStats.jvm().mem().heapMaxInBytes();
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

      JsonData persistentValue = clusterSettings.persistent().get("http.max_content_length");
      if (persistentValue != null) {
        maxContentLengthStr = persistentValue.to(String.class);
      }

      if (maxContentLengthStr == null) {
        JsonData transientValue = clusterSettings.transient_().get("http.max_content_length");
        if (transientValue != null) {
          maxContentLengthStr = transientValue.to(String.class);
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
      LOG.error("ElasticSearch client is not available. Cannot fetch cluster health.");
      throw new IOException("ElasticSearch client is not available");
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

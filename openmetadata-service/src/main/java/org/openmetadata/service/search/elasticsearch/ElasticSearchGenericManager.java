package org.openmetadata.service.search.elasticsearch;

import es.co.elastic.clients.elasticsearch.ElasticsearchClient;
import es.co.elastic.clients.elasticsearch._types.ElasticsearchException;
import es.co.elastic.clients.elasticsearch.indices.Alias;
import es.co.elastic.clients.elasticsearch.indices.AliasDefinition;
import es.co.elastic.clients.elasticsearch.indices.DataStream;
import es.co.elastic.clients.elasticsearch.indices.GetDataStreamResponse;
import java.io.IOException;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.service.search.GenericClient;

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

      if (getIndexResponse.result().isEmpty()) {
        LOG.warn("No indices found matching pattern: {}", indexPattern);
        return;
      }

      for (String indexName : getIndexResponse.result().keySet()) {
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
      var getResponse = client.cluster().getComponentTemplate(g -> g.name(componentTemplateName));

      if (getResponse.componentTemplates().isEmpty()) {
        LOG.warn("Component template {} does not exist. Skipping.", componentTemplateName);
        return;
      }

      var componentTemplate = getResponse.componentTemplates().getFirst().componentTemplate();
      var template = componentTemplate.template();

      if (template != null && template.settings() != null) {
        // Update the component template with ILM policy removed
        client
            .cluster()
            .putComponentTemplate(
                p ->
                    p.name(componentTemplateName)
                        .template(
                            t -> {
                              // Copy all settings except lifecycle
                              t.settings(s -> s.lifecycle(l -> l.name(null)));

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
}

package org.openmetadata.service.search.elasticsearch;

import es.co.elastic.clients.elasticsearch.ElasticsearchClient;
import es.co.elastic.clients.elasticsearch._types.ElasticsearchException;
import es.co.elastic.clients.elasticsearch.indices.DataStream;
import es.co.elastic.clients.elasticsearch.indices.GetDataStreamResponse;
import java.io.IOException;
import java.util.Collections;
import java.util.List;
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
    throw new UnsupportedOperationException("Not implemented yet");
  }

  @Override
  public void dettachIlmPolicyFromIndexes(String indexPattern) throws IOException {
    throw new UnsupportedOperationException("Not implemented yet");
  }
}

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
        LOG.error("Failed to find DataStreams", e);
        throw new IOException("Failed to find DataStreams: " + e.getMessage(), e);
      }
    } catch (Exception e) {
      LOG.error("Failed to get data streams for prefix {}", prefix, e);
      throw e;
    }
  }

  @Override
  public void deleteDataStream(String dataStreamName) throws IOException {
    throw new UnsupportedOperationException("Not implemented yet");
  }

  @Override
  public void deleteILMPolicy(String policyName) throws IOException {
    throw new UnsupportedOperationException("Not implemented yet");
  }

  @Override
  public void deleteIndexTemplate(String templateName) throws IOException {
    throw new UnsupportedOperationException("Not implemented yet");
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

package org.openmetadata.service.search.opensearch;

import lombok.extern.slf4j.Slf4j;
import org.openmetadata.service.search.GenericClient;
import os.org.opensearch.client.opensearch.OpenSearchClient;
import os.org.opensearch.client.opensearch._types.OpenSearchException;
import os.org.opensearch.client.opensearch.indices.DataStreamInfo;
import os.org.opensearch.client.opensearch.indices.GetDataStreamRequest;
import os.org.opensearch.client.opensearch.indices.GetDataStreamResponse;

import java.io.IOException;
import java.util.Collections;
import java.util.List;
import java.util.stream.Collectors;

@Slf4j
public class OpenSearchGenericManager implements GenericClient {
  private final OpenSearchClient client;
  private final boolean isClientAvailable;

  public OpenSearchGenericManager(OpenSearchClient client) {
    this.client = client;
    this.isClientAvailable = client != null;
  }

  @Override
  public List<String> getDataStreams(String prefix) throws IOException {
    if (!isClientAvailable) {
      LOG.error("OpenSearch client is not available. Cannot get data streams.");
      return Collections.emptyList();
    }
    try {
      GetDataStreamRequest request = GetDataStreamRequest.of(builder -> builder.name(prefix + "*"));
      GetDataStreamResponse response = client.indices().getDataStream(request);
      return response.dataStreams().stream().map(DataStreamInfo::name).collect(Collectors.toList());
    } catch (OpenSearchException e) {
      if (e.status() == 404) {
        LOG.warn("No DataStreams exist with prefix '{}'. Skipping.", prefix);
        return Collections.emptyList();
      } else {
        LOG.error("Failed to find DataStreams", e);
        throw new IOException("Failed to find DataStreams: " + e.getMessage(), e);
      }
    } catch (Exception e) {
      LOG.error("Failed to get data streams with prefix {}", prefix, e);
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

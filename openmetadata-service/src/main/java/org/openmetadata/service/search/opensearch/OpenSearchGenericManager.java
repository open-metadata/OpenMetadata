package org.openmetadata.service.search.opensearch;

import java.io.IOException;
import java.util.Collections;
import java.util.List;
import java.util.stream.Collectors;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.service.search.GenericClient;
import os.org.opensearch.client.Request;
import os.org.opensearch.client.Response;
import os.org.opensearch.client.ResponseException;
import os.org.opensearch.client.RestClient;
import os.org.opensearch.client.opensearch.OpenSearchClient;
import os.org.opensearch.client.opensearch._types.OpenSearchException;
import os.org.opensearch.client.opensearch.indices.DataStreamInfo;
import os.org.opensearch.client.opensearch.indices.GetDataStreamResponse;

@Slf4j
public class OpenSearchGenericManager implements GenericClient {
  private final OpenSearchClient client;
  private final RestClient restClient;
  private final boolean isClientAvailable;
  private final boolean isRestClientAvailable;

  public OpenSearchGenericManager(OpenSearchClient client, RestClient restClient) {
    this.client = client;
    this.isClientAvailable = client != null;
    this.restClient = restClient;
    this.isRestClientAvailable = restClient != null;
  }

  @Override
  public List<String> getDataStreams(String prefix) throws IOException {
    if (!isClientAvailable) {
      LOG.error("OpenSearch client is not available. Cannot get data streams.");
      return Collections.emptyList();
    }
    try {
      GetDataStreamResponse response = client.indices().getDataStream(g -> g.name(prefix + "*"));
      return response.dataStreams().stream().map(DataStreamInfo::name).collect(Collectors.toList());
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
    if (!isRestClientAvailable) {
      LOG.error("OpenSearch rest client is not available. Cannot delete ISM policy.");
      return;
    }
    try {
      // strongly typed API support not exist so need to use restClient for OS
      Request request = new Request("DELETE", "/_plugins/_ism/policies/" + policyName);
      Response response = restClient.performRequest(request);

      int statusCode = response.getStatusLine().getStatusCode();
      if (statusCode == 200) {
        LOG.info("Successfully deleted ISM policy: {}", policyName);
      } else if (statusCode == 404) {
        LOG.warn("ISM policy {} does not exist. Skipping deletion.", policyName);
      } else {
        LOG.error("Failed to delete ILM policy: {}", policyName);
        throw new IOException(
            "Failed to delete ISM policy: " + response.getStatusLine().getReasonPhrase());
      }
    } catch (ResponseException e) {
      if (e.getResponse().getStatusLine().getStatusCode() == 404) {
        LOG.warn("ISM Policy {} does not exist. Skipping deletion.", policyName);
      } else {
        throw new IOException(
            "Failed to delete ISM policy: " + e.getResponse().getStatusLine().getReasonPhrase());
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
    throw new UnsupportedOperationException("Not implemented yet");
  }
}

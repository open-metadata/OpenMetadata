package org.openmetadata.service.apps.bundles.insights.search.elasticsearch;

import es.co.elastic.clients.transport.rest5_client.low_level.Request;
import es.co.elastic.clients.transport.rest5_client.low_level.Response;
import es.co.elastic.clients.transport.rest5_client.low_level.Rest5Client;
import java.io.IOException;
import org.apache.hc.core5.http.ContentType;
import org.apache.hc.core5.http.io.entity.StringEntity;
import org.openmetadata.search.IndexMapping;
import org.openmetadata.service.apps.bundles.insights.search.DataInsightsSearchInterface;

public class ElasticSearchDataInsightsClient implements DataInsightsSearchInterface {
  private final Rest5Client client;
  private final String resourcePath = "/dataInsights/elasticsearch";
  private final String clusterAlias;

  public ElasticSearchDataInsightsClient(Rest5Client client, String clusterAlias) {
    this.client = client;
    this.clusterAlias = clusterAlias;
  }

  @Override
  public String getClusterAlias() {
    return clusterAlias;
  }

  private int performRequest(String method, String path) throws IOException {
    return performRequest(method, path, null);
  }

  private int performRequest(String method, String path, String payload) throws IOException {
    Request request = new Request(method, path);
    if (payload != null) {
      request.setEntity(new StringEntity(payload, ContentType.APPLICATION_JSON));
    }
    Response response = client.performRequest(request);
    int status = response.getStatusCode();
    // Rest5Client only throws on status >= 500, so 4xx (e.g. a 400 mapping conflict) would
    // otherwise be silently swallowed — check the status and surface it as an IOException,
    // mirroring OpenSearchDataInsightsClient. A HEAD 404 ("stream not found") is expected and
    // must not throw, since dataAssetDataStreamExists reads the status code from the return value.
    if (status >= 300 && !("HEAD".equals(method) && status == 404)) {
      throw new IOException(
          "Data Insights request " + method + " " + path + " failed with " + status);
    }
    return status;
  }

  @Override
  public void createComponentTemplate(String name, String template) throws IOException {
    performRequest("PUT", String.format("/_component_template/%s", name), template);
  }

  @Override
  public String getResourcePath() {
    return resourcePath;
  }

  @Override
  public void createIndexTemplate(String name, String template) throws IOException {
    performRequest("PUT", String.format("/_index_template/%s", name), template);
  }

  @Override
  public void createDataStream(String name) throws IOException {
    performRequest("PUT", String.format("/_data_stream/%s", name));
  }

  @Override
  public Boolean dataAssetDataStreamExists(String name) throws IOException {
    return performRequest("HEAD", String.format("/%s", name)) == 200;
  }

  @Override
  public void createDataAssetsDataStream(
      String name,
      String entityType,
      IndexMapping entityIndexMapping,
      String language,
      int retentionDays)
      throws IOException {
    prepareDataAssetTemplates(name, entityType, entityIndexMapping, language, resourcePath);
    createDataStream(name);
  }

  @Override
  public void putWriteIndexMapping(String name, String mappings) throws IOException {
    Request request = new Request("PUT", "/" + name + "/_mapping");
    request.addParameter("write_index_only", "true");
    request.setEntity(new StringEntity(mappings, ContentType.APPLICATION_JSON));
    Response response = client.performRequest(request);
    int status = response.getStatusCode();
    // Rest5Client only throws on status >= 500, so a 400 mapping conflict (the rollover trigger)
    // would otherwise be silently swallowed and the recovery in updateDataAssetsDataStream would
    // never fire. Surface any >= 300 as an IOException so isMappingConflict can match the 400 —
    // mirroring OpenSearchDataInsightsClient.putWriteIndexMapping.
    if (status >= 300) {
      throw new IOException(
          "Data Insights request PUT /" + name + "/_mapping failed with " + status);
    }
  }

  @Override
  public void rolloverDataStream(String name) throws IOException {
    performRequest("POST", "/" + name + "/_rollover");
  }

  @Override
  public void deleteDataAssetDataStream(String name) throws IOException {
    performRequest("DELETE", String.format("/_data_stream/%s", name));
  }
}

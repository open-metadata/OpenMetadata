package org.openmetadata.service.apps.bundles.insights.search.elasticsearch;

import es.co.elastic.clients.transport.rest5_client.low_level.Request;
import es.co.elastic.clients.transport.rest5_client.low_level.Response;
import es.co.elastic.clients.transport.rest5_client.low_level.Rest5Client;
import java.io.IOException;
import org.apache.hc.core5.http.ContentType;
import org.apache.hc.core5.http.io.entity.StringEntity;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.search.IndexMapping;
import org.openmetadata.service.apps.bundles.insights.search.DataInsightsSearchInterface;
import org.openmetadata.service.apps.bundles.insights.search.IndexMappingTemplate;

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

  private Response performRequest(String method, String path) throws IOException {
    Request request = new Request(method, path);
    return client.performRequest(request);
  }

  private Response performRequest(String method, String path, String payload) throws IOException {
    Request request = new Request(method, path);
    request.setEntity(new StringEntity(payload, ContentType.APPLICATION_JSON));

    return client.performRequest(request);
  }

  @Override
  public void createComponentTemplate(String name, String template) throws IOException {
    performRequest("PUT", String.format("/_component_template/%s", name), template);
  }

  @Override
  public String getDataStreamMappings(String name) throws IOException {
    try {
      Response response = performRequest("GET", "/" + name + "/_mapping");
      return new String(response.getEntity().getContent().readAllBytes());
    } catch (IOException e) {
      if (e.getMessage() != null && e.getMessage().contains("404")) {
        return null;
      }
      throw e;
    }
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
    Response response = performRequest("HEAD", String.format("/%s", name));
    return response.getStatusCode() == 200;
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
  public boolean updateDataAssetsDataStream(
      String name, String entityType, IndexMapping entityIndexMapping, String language)
      throws IOException {
    int currentVersion = writeIndexMappingVersion(name);
    IndexMappingTemplate template =
        prepareDataAssetTemplates(name, entityType, entityIndexMapping, language, resourcePath);
    performRequest(
        "PUT",
        "/" + name + "/_mapping",
        JsonUtils.pojoToJson(template.getTemplate().getMappings()));
    return currentVersion != MAPPING_VERSION;
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

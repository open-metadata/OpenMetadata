package org.openmetadata.service.apps.bundles.insights.search.elasticsearch;

import es.org.elasticsearch.client.Request;
import es.org.elasticsearch.client.Response;
import es.org.elasticsearch.client.RestClient;
import java.io.IOException;
import java.util.List;
import java.util.Map;
import org.openmetadata.service.apps.bundles.insights.search.DataInsightsSearchInterface;
import org.openmetadata.service.search.models.IndexMapping;
import org.openmetadata.service.util.JsonUtils;

public class ElasticSearchDataInsightsClient implements DataInsightsSearchInterface {
  private final RestClient client;

  public ElasticSearchDataInsightsClient(RestClient client) {
    this.client = client;
  }

  private Response performRequest(String method, String path) throws IOException {
    Request request = new Request(method, path);
    return client.performRequest(request);
  }

  private Response performRequest(String method, String path, String payload) throws IOException {
    Request request = new Request(method, path);
    request.setJsonEntity(payload);

    return client.performRequest(request);
  }

  @Override
  public void createLifecyclePolicy(String name, String policy) throws IOException {
    performRequest("PUT", String.format("/_ilm/policy/%s", name), policy);
  }

  @Override
  public void createComponentTemplate(String name, String template) throws IOException {
    performRequest("PUT", String.format("/_component_template/%s", name), template);
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
    return response.getStatusLine().getStatusCode() == 200;
  }

  private String buildMapping(
      String entityType,
      IndexMapping entityIndexMapping,
      String language,
      String indexMappingTemplateStr) {
    Map<String, Map<String, Map<String, Map<String, Object>>>> indexMappingTemplate =
        JsonUtils.readOrConvertValue(indexMappingTemplateStr, Map.class);
    Map<String, Map<String, List<String>>> entityConfig =
        JsonUtils.readOrConvertValue(readResource("/dataInsights/config.json"), Map.class);
    Map<String, Map<String, Map<String, Object>>> entityIndexMap =
        JsonUtils.readOrConvertValue(
            readResource(
                String.format(entityIndexMapping.getIndexMappingFile(), language.toLowerCase())),
            Map.class);

    List<String> entityAttributes = entityConfig.get("mappingFields").get("common");
    entityAttributes.addAll(entityConfig.get("mappingFields").get(entityType));

    indexMappingTemplate
        .get("template")
        .get("settings")
        .put("analysis", entityIndexMap.get("settings").get("analysis"));

    for (String attribute : entityAttributes) {
      if (!indexMappingTemplate
          .get("template")
          .get("mappings")
          .get("properties")
          .containsKey(attribute)) {
        Object value = entityIndexMap.get("mappings").get("properties").get(attribute);
        if (value != null) {
          indexMappingTemplate
              .get("template")
              .get("mappings")
              .get("properties")
              .put(attribute, value);
        }
      }
    }

    return JsonUtils.pojoToJson(indexMappingTemplate);
  }

  @Override
  public void createDataAssetsDataStream(
      String name, String entityType, IndexMapping entityIndexMapping, String language)
      throws IOException {
    String resourcePath = "/dataInsights/elasticsearch";
    createLifecyclePolicy(
        "di-data-assets-lifecycle",
        readResource(String.format("%s/indexLifecyclePolicy.json", resourcePath)));
    createComponentTemplate(
        "di-data-assets-settings",
        readResource(String.format("%s/indexSettingsTemplate.json", resourcePath)));
    createComponentTemplate(
        "di-data-assets-mapping",
        buildMapping(
            entityType,
            entityIndexMapping,
            language,
            readResource(String.format("%s/indexMappingsTemplate.json", resourcePath))));
    createIndexTemplate(
        "di-data-assets", readResource(String.format("%s/indexTemplate.json", resourcePath)));
    createDataStream(name);
  }

  @Override
  public void deleteDataAssetDataStream(String name) throws IOException {
    performRequest("DELETE", String.format("/_data_stream/%s", name));
  }
}

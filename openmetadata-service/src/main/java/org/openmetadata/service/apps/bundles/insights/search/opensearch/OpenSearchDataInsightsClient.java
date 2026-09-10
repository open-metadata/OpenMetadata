package org.openmetadata.service.apps.bundles.insights.search.opensearch;

import java.io.IOException;
import java.util.List;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.search.IndexMapping;
import org.openmetadata.service.apps.bundles.insights.search.DataInsightsSearchConfiguration;
import org.openmetadata.service.apps.bundles.insights.search.DataInsightsSearchInterface;
import org.openmetadata.service.apps.bundles.insights.search.EntityIndexMap;
import org.openmetadata.service.apps.bundles.insights.search.IndexMappingTemplate;
import org.openmetadata.service.search.opensearch.OsUtils;
import os.org.opensearch.client.opensearch.OpenSearchClient;
import os.org.opensearch.client.opensearch.generic.Requests;

public class OpenSearchDataInsightsClient implements DataInsightsSearchInterface {
  private final OpenSearchClient client;
  private final String resourcePath = "/dataInsights/opensearch";
  private final String clusterAlias;

  public OpenSearchDataInsightsClient(OpenSearchClient client, String clusterAlias) {
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
    var builder = Requests.builder().method(method).endpoint(path);
    if (payload != null) {
      builder.json(payload);
    }
    try (var response = client.generic().execute(builder.build())) {
      int status = response.getStatus();
      if (status >= 300 && !("HEAD".equals(method) && status == 404)) {
        throw new IOException(
            "Data Insights request " + method + " " + path + " failed with " + status);
      }
      return status;
    }
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
  public void updateDataAssetsDataStream(
      String name, String entityType, IndexMapping entityIndexMapping, String language)
      throws IOException {
    var mappings =
        prepareDataAssetTemplates(name, entityType, entityIndexMapping, language, resourcePath)
            .getTemplate()
            .getMappings();
    performRequest("PUT", "/" + name + "/_mapping", JsonUtils.pojoToJson(mappings));
  }

  @Override
  public void deleteDataAssetDataStream(String name) throws IOException {
    performRequest("DELETE", String.format("/_data_stream/%s", name));
  }

  @Override
  public String buildMapping(
      String entityType,
      IndexMapping entityIndexMapping,
      String language,
      String indexMappingTemplateStr) {
    IndexMappingTemplate indexMappingTemplate =
        JsonUtils.readOrConvertValue(indexMappingTemplateStr, IndexMappingTemplate.class);
    String mappingContent =
        readResource(
            String.format(entityIndexMapping.getIndexMappingFile(), language.toLowerCase()));
    String transformedContent = OsUtils.enrichIndexMappingForOpenSearch(mappingContent);
    EntityIndexMap entityIndexMap =
        JsonUtils.readOrConvertValue(transformedContent, EntityIndexMap.class);

    DataInsightsSearchConfiguration dataInsightsSearchConfiguration =
        readDataInsightsSearchConfiguration();
    List<String> entityAttributeFields =
        getEntityAttributeFields(dataInsightsSearchConfiguration, entityType);

    indexMappingTemplate
        .getTemplate()
        .getSettings()
        .put("analysis", entityIndexMap.getSettings().get("analysis"));

    for (String attribute : entityAttributeFields) {
      if (!indexMappingTemplate
          .getTemplate()
          .getMappings()
          .getProperties()
          .containsKey(attribute)) {
        Object value = entityIndexMap.getMappings().getProperties().get(attribute);
        if (value != null) {
          indexMappingTemplate.getTemplate().getMappings().getProperties().put(attribute, value);
        }
      }
    }

    return JsonUtils.pojoToJson(indexMappingTemplate);
  }
}

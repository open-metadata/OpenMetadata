package org.openmetadata.service.apps.bundles.insights.search.opensearch;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.IOException;
import java.io.InputStream;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.search.IndexMapping;
import org.openmetadata.service.apps.bundles.insights.search.DailyIndex;
import org.openmetadata.service.apps.bundles.insights.search.DataInsightsSearchConfiguration;
import org.openmetadata.service.apps.bundles.insights.search.DataInsightsSearchInterface;
import org.openmetadata.service.apps.bundles.insights.search.EntityIndexMap;
import org.openmetadata.service.apps.bundles.insights.search.IndexMappingTemplate;
import org.openmetadata.service.apps.bundles.insights.search.IndexTemplate;
import org.openmetadata.service.search.opensearch.OsUtils;
import os.org.opensearch.client.opensearch.OpenSearchClient;
import os.org.opensearch.client.opensearch.generic.OpenSearchGenericClient;
import os.org.opensearch.client.opensearch.generic.Requests;

@Slf4j
public class OpenSearchDataInsightsClient implements DataInsightsSearchInterface {

  private static final ObjectMapper MAPPER = new ObjectMapper();
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

  private os.org.opensearch.client.opensearch.generic.Response performRequest(
      String method, String path) throws IOException {
    OpenSearchGenericClient genericClient = client.generic();
    return genericClient.execute(Requests.builder().method(method).endpoint(path).build());
  }

  private os.org.opensearch.client.opensearch.generic.Response performRequest(
      String method, String path, String payload) throws IOException {
    OpenSearchGenericClient genericClient = client.generic();
    return genericClient.execute(
        Requests.builder().method(method).endpoint(path).json(payload).build());
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
    var response = performRequest("HEAD", String.format("/%s", name));
    return response.getStatus() == 200;
  }

  @Override
  public void createDataAssetsDataStream(
      String name,
      String entityType,
      IndexMapping entityIndexMapping,
      String language,
      int retentionDays)
      throws IOException {
    createComponentTemplate(
        getStringWithClusterAlias("di-data-assets-mapping"),
        buildMapping(
            entityType,
            entityIndexMapping,
            language,
            readResource(String.format("%s/indexMappingsTemplate.json", resourcePath))));
    createIndexTemplate(
        getStringWithClusterAlias("di-data-assets"),
        IndexTemplate.getIndexTemplateWithClusterAlias(
            getClusterAlias(), readResource(String.format("%s/indexTemplate.json", resourcePath))));
    createDataStream(name);
  }

  @Override
  public void deleteDataAssetDataStream(String name) throws IOException {
    performRequest("DELETE", String.format("/_data_stream/%s", name));
  }

  @Override
  public boolean dailyIndexExists(DailyIndex index) throws IOException {
    var response = performRequest("HEAD", "/" + index.name());
    return response.getStatus() == 200;
  }

  @Override
  public List<DailyIndex> listDailyIndices(String clusterAlias, String entityType)
      throws IOException {
    String base = "di-data-assets-" + entityType.toLowerCase() + "-*";
    String pattern =
        (clusterAlias == null || clusterAlias.isBlank()) ? base : clusterAlias + "-" + base;
    var response = performRequest("GET", "/_cat/indices/" + pattern + "?format=json&h=index");
    if (response.getStatus() == 404) {
      return List.of();
    }
    String body =
        response
            .getBody()
            .map(
                b -> {
                  try (InputStream is = b.body()) {
                    return new String(is.readAllBytes());
                  } catch (IOException e) {
                    return "[]";
                  }
                })
            .orElse("[]");
    List<Map<String, String>> rows =
        MAPPER.readValue(body, new TypeReference<List<Map<String, String>>>() {});
    List<DailyIndex> result = new ArrayList<>();
    for (Map<String, String> row : rows) {
      String indexName = row.get("index");
      if (indexName != null) {
        try {
          result.add(DailyIndex.parse(clusterAlias, entityType, indexName));
        } catch (Exception e) {
          LOG.warn("Skipping unparseable index name: {}", indexName);
        }
      }
    }
    return result;
  }

  @Override
  public void rollForward(DailyIndex from, DailyIndex to) throws IOException {
    String body =
        """
        {
          "source": {
            "index": "%s",
            "query": { "bool": { "must_not": [{ "term": { "deleted": true } }] } }
          },
          "dest": { "index": "%s" },
          "script": {
            "source": "ctx._source['@timestamp'] = params.ts",
            "params": { "ts": %d }
          }
        }"""
            .formatted(from.name(), to.name(), to.startOfDayTimestamp());
    performRequest("POST", "/_reindex?wait_for_completion=true&refresh=true", body);
  }

  @Override
  public void deleteDailyIndex(DailyIndex index) throws IOException {
    var response = performRequest("DELETE", "/" + index.name());
    if (response.getStatus() != 200 && response.getStatus() != 404) {
      throw new IOException(
          "Failed to delete index " + index.name() + ": HTTP " + response.getStatus());
    }
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

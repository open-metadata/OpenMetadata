package org.openmetadata.service.apps.bundles.insights.search.elasticsearch;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import es.co.elastic.clients.transport.rest5_client.low_level.Request;
import es.co.elastic.clients.transport.rest5_client.low_level.Response;
import es.co.elastic.clients.transport.rest5_client.low_level.ResponseException;
import es.co.elastic.clients.transport.rest5_client.low_level.Rest5Client;
import java.io.IOException;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import lombok.extern.slf4j.Slf4j;
import org.apache.hc.core5.http.ContentType;
import org.apache.hc.core5.http.ParseException;
import org.apache.hc.core5.http.io.entity.EntityUtils;
import org.apache.hc.core5.http.io.entity.StringEntity;
import org.openmetadata.search.IndexMapping;
import org.openmetadata.service.apps.bundles.insights.search.DailyIndex;
import org.openmetadata.service.apps.bundles.insights.search.DataInsightsSearchInterface;
import org.openmetadata.service.apps.bundles.insights.search.IndexTemplate;

@Slf4j
public class ElasticSearchDataInsightsClient implements DataInsightsSearchInterface {

  private static final ObjectMapper MAPPER = new ObjectMapper();
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
    try {
      performRequest("HEAD", "/" + index.name());
      return true;
    } catch (ResponseException e) {
      if (e.getResponse().getStatusCode() == 404) {
        return false;
      }
      throw e;
    }
  }

  @Override
  public List<DailyIndex> listDailyIndices(String clusterAlias, String entityType)
      throws IOException {
    String base = "di-data-assets-" + entityType.toLowerCase() + "-*";
    String pattern =
        (clusterAlias == null || clusterAlias.isBlank()) ? base : clusterAlias + "-" + base;
    try {
      Response response =
          performRequest("GET", "/_cat/indices/" + pattern + "?format=json&h=index");
      String body;
      try {
        body = EntityUtils.toString(response.getEntity());
      } catch (ParseException e) {
        throw new IOException("Failed to parse _cat/indices response", e);
      }
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
    } catch (ResponseException e) {
      if (e.getResponse().getStatusCode() == 404) {
        return List.of();
      }
      throw e;
    }
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
    try {
      performRequest("DELETE", "/" + index.name());
    } catch (ResponseException e) {
      if (e.getResponse().getStatusCode() != 404) {
        throw e;
      }
    }
  }
}

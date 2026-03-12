package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import es.co.elastic.clients.transport.rest5_client.low_level.Request;
import es.co.elastic.clients.transport.rest5_client.low_level.Response;
import es.co.elastic.clients.transport.rest5_client.low_level.Rest5Client;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import org.apache.hc.core5.http.ContentType;
import org.apache.hc.core5.http.io.entity.StringEntity;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.bootstrap.TestSuiteBootstrap;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;

@Execution(ExecutionMode.CONCURRENT)
@ExtendWith(TestNamespaceExtension.class)
public class IndexTemplateIT {

  private static final ObjectMapper MAPPER = new ObjectMapper();
  private static final String CLUSTER_ALIAS = "openmetadata";

  @Test
  void testIndexTemplatesExist(TestNamespace ns) throws Exception {
    Rest5Client searchClient = TestSuiteBootstrap.createSearchClient();

    Request request = new Request("GET", "/_index_template/om_*");
    Response response = searchClient.performRequest(request);
    assertEquals(200, response.getStatusCode());

    String body =
        new String(response.getEntity().getContent().readAllBytes(), StandardCharsets.UTF_8);
    JsonNode root = MAPPER.readTree(body);
    JsonNode templates = root.get("index_templates");

    assertNotNull(templates, "Response should contain index_templates");
    assertTrue(templates.isArray(), "index_templates should be an array");
    assertTrue(templates.size() > 0, "Should have at least one index template");
  }

  @Test
  void testTableIndexTemplateHasProperMappings(TestNamespace ns) throws Exception {
    Rest5Client searchClient = TestSuiteBootstrap.createSearchClient();
    String templateName = "om_" + CLUSTER_ALIAS + "_table_search_index";

    Request request = new Request("GET", "/_index_template/" + templateName);
    Response response = searchClient.performRequest(request);
    assertEquals(200, response.getStatusCode());

    String body =
        new String(response.getEntity().getContent().readAllBytes(), StandardCharsets.UTF_8);
    JsonNode root = MAPPER.readTree(body);
    JsonNode templates = root.get("index_templates");
    assertNotNull(templates);
    assertTrue(templates.size() > 0);

    JsonNode templateNode = templates.get(0).get("index_template");
    assertNotNull(templateNode);

    JsonNode indexPatterns = templateNode.get("index_patterns");
    assertNotNull(indexPatterns, "Template should have index_patterns");
    assertTrue(
        indexPatterns.toString().contains(CLUSTER_ALIAS + "_table_search_index"),
        "Pattern should match table_search_index");

    JsonNode template = templateNode.get("template");
    assertNotNull(template, "Template should have a template body");

    JsonNode mappings = template.get("mappings");
    assertNotNull(mappings, "Template should have mappings");

    JsonNode properties = mappings.get("properties");
    assertNotNull(properties, "Mappings should have properties");
    assertNotNull(properties.get("name"), "Table mapping should have 'name' property");
    assertNotNull(
        properties.get("fullyQualifiedName"),
        "Table mapping should have 'fullyQualifiedName' property");

    JsonNode settings = template.get("settings");
    assertNotNull(settings, "Template should have settings");
  }

  @Test
  void testTemplatePatternMatchesRebuildIndices(TestNamespace ns) throws Exception {
    Rest5Client searchClient = TestSuiteBootstrap.createSearchClient();
    String templateName = "om_" + CLUSTER_ALIAS + "_table_search_index";

    Request request = new Request("GET", "/_index_template/" + templateName);
    Response response = searchClient.performRequest(request);
    assertEquals(200, response.getStatusCode());

    String body =
        new String(response.getEntity().getContent().readAllBytes(), StandardCharsets.UTF_8);
    JsonNode root = MAPPER.readTree(body);
    JsonNode indexPatterns =
        root.get("index_templates").get(0).get("index_template").get("index_patterns");

    String pattern = indexPatterns.get(0).asText();
    assertTrue(
        pattern.endsWith("*"),
        "Pattern should end with * to match rebuild indices like _rebuild_<timestamp>");
  }

  @Test
  void testAutoCreatedIndexFromTemplateHasProperMappings(TestNamespace ns) throws Exception {
    Rest5Client searchClient = TestSuiteBootstrap.createSearchClient();
    String testIndexName = CLUSTER_ALIAS + "_table_search_index_rebuild_test_template_it";

    try {
      deleteIndexIfExists(searchClient, testIndexName);

      String doc =
          "{\"name\":\"test_table\",\"fullyQualifiedName\":\"db.schema.test_table\","
              + "\"entityType\":\"table\",\"deleted\":false}";
      Request indexRequest = new Request("POST", "/" + testIndexName + "/_doc");
      indexRequest.setEntity(new StringEntity(doc, ContentType.APPLICATION_JSON));
      Response indexResponse = searchClient.performRequest(indexRequest);
      int status = indexResponse.getStatusCode();
      assertTrue(status == 200 || status == 201, "Document should be indexed successfully");

      JsonNode indexMappings = getMappingsForIndex(searchClient, testIndexName);
      assertNotNull(indexMappings, "Auto-created index should have mappings");

      JsonNode properties = indexMappings.get("properties");
      assertNotNull(properties, "Mappings should have properties from template");

      JsonNode nameField = properties.get("name");
      assertNotNull(nameField, "Auto-created index should have 'name' field from template");
      assertFalse(
          "text".equals(nameField.path("type").asText()) && !nameField.has("fields"),
          "name field should have sub-fields from template, not bare text type");

    } finally {
      deleteIndexIfExists(searchClient, testIndexName);
    }
  }

  @Test
  void testAutoCreatedIndexHasAnalyzers(TestNamespace ns) throws Exception {
    Rest5Client searchClient = TestSuiteBootstrap.createSearchClient();
    String testIndexName = CLUSTER_ALIAS + "_table_search_index_rebuild_test_analyzer_it";

    try {
      deleteIndexIfExists(searchClient, testIndexName);

      String doc = "{\"name\":\"analyzer_test\",\"entityType\":\"table\",\"deleted\":false}";
      Request indexRequest = new Request("POST", "/" + testIndexName + "/_doc");
      indexRequest.setEntity(new StringEntity(doc, ContentType.APPLICATION_JSON));
      searchClient.performRequest(indexRequest);

      JsonNode indexSettings = getSettingsForIndex(searchClient, testIndexName);
      assertNotNull(indexSettings, "Auto-created index should have settings from template");

      JsonNode analysis = indexSettings.get("analysis");
      assertNotNull(analysis, "Settings should include analysis configuration from template");

      JsonNode analyzers = analysis.get("analyzer");
      assertNotNull(analyzers, "Should have custom analyzers from template");
      assertTrue(
          analyzers.has("om_analyzer") || analyzers.has("om_ngram"),
          "Should have OpenMetadata custom analyzers");

    } finally {
      deleteIndexIfExists(searchClient, testIndexName);
    }
  }

  @Test
  void testDocUpdateOnDeletedIndexUsesTemplateNotAutoInference(TestNamespace ns) throws Exception {
    Rest5Client searchClient = TestSuiteBootstrap.createSearchClient();
    String canonicalIndex = CLUSTER_ALIAS + "_tag_search_index";

    assertNotNull(
        getMappingsForIndex(searchClient, canonicalIndex), "Original index should have mappings");

    String realIndexName = resolveActualIndexName(searchClient, canonicalIndex);
    deleteIndexIfExists(searchClient, realIndexName);

    try {
      Request existsRequest = new Request("HEAD", "/" + canonicalIndex);
      Response existsResponse = searchClient.performRequest(existsRequest);
      assertEquals(404, existsResponse.getStatusCode(), "Index should not exist after deletion");
    } catch (Exception e) {
      assertTrue(e.getMessage().contains("404"), "Index/alias should not exist after deletion");
    }

    try {
      String doc =
          "{\"name\":\"test_tag\",\"fullyQualifiedName\":\"Classification.test_tag\","
              + "\"entityType\":\"tag\",\"deleted\":false,"
              + "\"classification\":{\"name\":\"Classification\"}}";
      Request indexRequest = new Request("POST", "/" + canonicalIndex + "/_doc/test-tag-id-1");
      indexRequest.setEntity(new StringEntity(doc, ContentType.APPLICATION_JSON));
      Response indexResponse = searchClient.performRequest(indexRequest);
      int status = indexResponse.getStatusCode();
      assertTrue(status == 200 || status == 201, "Document indexing should trigger index creation");

      JsonNode recreatedMappings = getMappingsForIndex(searchClient, canonicalIndex);
      assertNotNull(recreatedMappings, "Recreated index should have mappings");

      JsonNode properties = recreatedMappings.get("properties");
      assertNotNull(properties, "Recreated index should have properties from template");

      JsonNode nameField = properties.get("name");
      assertNotNull(nameField, "name field should exist from template");
      assertTrue(
          nameField.has("analyzer"),
          "name field should have a custom analyzer from template, not default inference");
      assertEquals(
          "om_analyzer",
          nameField.get("analyzer").asText(),
          "name field should use om_analyzer from template");
      assertTrue(
          nameField.has("fields"),
          "name field should have multi-fields (keyword, ngram) from template");
      assertNotNull(
          nameField.get("fields").get("keyword"),
          "name field should have keyword sub-field from template");

      JsonNode fqnField = properties.get("fullyQualifiedName");
      assertNotNull(fqnField, "fullyQualifiedName field should exist from template");
      assertEquals(
          "keyword",
          fqnField.get("type").asText(),
          "fullyQualifiedName should be keyword type from template, not text (which ES would"
              + " infer)");

      JsonNode entityTypeField = properties.get("entityType");
      assertNotNull(entityTypeField, "entityType field should exist from template");
      assertEquals(
          "keyword",
          entityTypeField.get("type").asText(),
          "entityType should be keyword type from template, not text (which ES would infer"
              + " from a string value)");

      JsonNode settings = getSettingsForIndex(searchClient, canonicalIndex);
      assertNotNull(settings, "Recreated index should have settings");
      JsonNode analysis = settings.get("analysis");
      assertNotNull(analysis, "Recreated index should have analysis settings from template");
      assertNotNull(
          analysis.get("analyzer").get("om_analyzer"),
          "Recreated index should have om_analyzer from template");
    } finally {
      deleteIndexIfExists(searchClient, canonicalIndex);
      Request recreateRequest = new Request("PUT", "/" + canonicalIndex);
      searchClient.performRequest(recreateRequest);
    }
  }

  @Test
  void testSyncAllTemplatesEndpoint(TestNamespace ns) throws Exception {
    String serverUrl = SdkClients.getServerUrl();
    String token = SdkClients.getAdminToken();

    HttpClient httpClient = HttpClient.newHttpClient();
    HttpRequest request =
        HttpRequest.newBuilder()
            .uri(URI.create(serverUrl + "/v1/search/templates"))
            .method("PUT", HttpRequest.BodyPublishers.noBody())
            .header("Authorization", "Bearer " + token)
            .header("Content-Type", "application/json")
            .build();

    HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
    assertEquals(200, response.statusCode());

    JsonNode body = MAPPER.readTree(response.body());
    assertTrue(body.get("total").asInt() > 0, "Should have total entity count");
    assertTrue(body.get("success").asInt() > 0, "Should have successful syncs");
    assertEquals(0, body.get("failed").asInt(), "Should have no failures");
    assertTrue(body.get("failedEntities").isArray(), "failedEntities should be an array");
    assertEquals(0, body.get("failedEntities").size(), "failedEntities should be empty");
    assertEquals(
        body.get("total").asInt(),
        body.get("success").asInt(),
        "All templates should be synced successfully");
  }

  @Test
  void testSyncTemplateByEntityTypeEndpoint(TestNamespace ns) throws Exception {
    String serverUrl = SdkClients.getServerUrl();
    String token = SdkClients.getAdminToken();

    HttpClient httpClient = HttpClient.newHttpClient();
    HttpRequest request =
        HttpRequest.newBuilder()
            .uri(URI.create(serverUrl + "/v1/search/templates/table"))
            .method("PUT", HttpRequest.BodyPublishers.noBody())
            .header("Authorization", "Bearer " + token)
            .header("Content-Type", "application/json")
            .build();

    HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
    assertEquals(200, response.statusCode());

    JsonNode body = MAPPER.readTree(response.body());
    assertEquals("table", body.get("entityType").asText());
    assertTrue(
        body.get("templateName").asText().contains("table_search_index"),
        "Template name should contain table_search_index");
    assertTrue(
        body.get("indexPattern").asText().endsWith("*"), "Index pattern should end with wildcard");
    assertEquals("synced", body.get("status").asText());

    Rest5Client searchClient = TestSuiteBootstrap.createSearchClient();
    String templateName = body.get("templateName").asText();
    Request esRequest = new Request("GET", "/_index_template/" + templateName);
    Response esResponse = searchClient.performRequest(esRequest);
    assertEquals(200, esResponse.getStatusCode(), "Template should exist in ES after sync");
  }

  @Test
  void testSyncTemplateInvalidEntityTypeReturns400(TestNamespace ns) throws Exception {
    String serverUrl = SdkClients.getServerUrl();
    String token = SdkClients.getAdminToken();

    HttpClient httpClient = HttpClient.newHttpClient();
    HttpRequest request =
        HttpRequest.newBuilder()
            .uri(URI.create(serverUrl + "/v1/search/templates/nonExistentEntity"))
            .method("PUT", HttpRequest.BodyPublishers.noBody())
            .header("Authorization", "Bearer " + token)
            .header("Content-Type", "application/json")
            .build();

    HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
    assertEquals(400, response.statusCode());

    JsonNode body = MAPPER.readTree(response.body());
    assertNotNull(body.get("error"), "Should return error message");
    assertTrue(
        body.get("error").asText().contains("nonExistentEntity"),
        "Error should mention the invalid entity type");
  }

  @Test
  void testSyncTemplateEndpointRequiresAdmin(TestNamespace ns) throws Exception {
    String serverUrl = SdkClients.getServerUrl();
    String nonAdminToken =
        SdkClients.createClient("test@open-metadata.org", "test@open-metadata.org", new String[] {})
            .getConfig()
            .getAccessToken();

    HttpClient httpClient = HttpClient.newHttpClient();
    HttpRequest request =
        HttpRequest.newBuilder()
            .uri(URI.create(serverUrl + "/v1/search/templates"))
            .method("PUT", HttpRequest.BodyPublishers.noBody())
            .header("Authorization", "Bearer " + nonAdminToken)
            .header("Content-Type", "application/json")
            .build();

    HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
    assertEquals(403, response.statusCode(), "Non-admin should be forbidden");
  }

  private JsonNode getMappingsForIndex(Rest5Client client, String indexName) throws Exception {
    Request request = new Request("GET", "/" + indexName + "/_mapping");
    Response response = client.performRequest(request);
    String body =
        new String(response.getEntity().getContent().readAllBytes(), StandardCharsets.UTF_8);
    JsonNode root = MAPPER.readTree(body);
    JsonNode indexNode = root.get(indexName);
    if (indexNode == null) {
      indexNode = root.fields().next().getValue();
    }
    return indexNode.get("mappings");
  }

  private JsonNode getSettingsForIndex(Rest5Client client, String indexName) throws Exception {
    Request request = new Request("GET", "/" + indexName + "/_settings");
    Response response = client.performRequest(request);
    String body =
        new String(response.getEntity().getContent().readAllBytes(), StandardCharsets.UTF_8);
    JsonNode root = MAPPER.readTree(body);
    JsonNode indexNode = root.get(indexName);
    if (indexNode == null) {
      indexNode = root.fields().next().getValue();
    }
    return indexNode.get("settings").get("index");
  }

  private String resolveActualIndexName(Rest5Client client, String indexOrAlias) throws Exception {
    Request request = new Request("GET", "/" + indexOrAlias + "/_settings");
    Response response = client.performRequest(request);
    String body =
        new String(response.getEntity().getContent().readAllBytes(), StandardCharsets.UTF_8);
    JsonNode root = MAPPER.readTree(body);
    return root.fieldNames().next();
  }

  private void deleteIndexIfExists(Rest5Client client, String indexName) {
    try {
      Request deleteRequest = new Request("DELETE", "/" + indexName);
      client.performRequest(deleteRequest);
    } catch (Exception ignored) {
      // Index may not exist
    }
  }
}

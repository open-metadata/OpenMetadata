/*
 *  Copyright 2024 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

package org.openmetadata.service.resources.search;

import static org.junit.jupiter.api.Assertions.*;
import static org.openmetadata.service.util.TestUtils.ADMIN_AUTH_HEADERS;
import static org.openmetadata.service.util.TestUtils.TEST_AUTH_HEADERS;
import static org.openmetadata.service.util.TestUtils.get;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.flipkart.zjsonpatch.JsonDiff;
import jakarta.ws.rs.client.WebTarget;
import jakarta.ws.rs.core.Response;
import java.io.IOException;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import lombok.extern.slf4j.Slf4j;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInfo;
import org.junit.jupiter.api.TestInstance;
import org.openmetadata.schema.api.data.CreateTable;
import org.openmetadata.schema.api.data.CreateTopic;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.data.Topic;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.ColumnDataType;
import org.openmetadata.schema.type.Field;
import org.openmetadata.schema.type.FieldDataType;
import org.openmetadata.schema.type.MessageSchema;
import org.openmetadata.schema.type.SchemaType;
import org.openmetadata.schema.type.Translation;
import org.openmetadata.schema.type.Translations;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.OpenMetadataApplicationTest;
import org.openmetadata.service.resources.databases.TableResourceTest;
import org.openmetadata.service.resources.topics.TopicResourceTest;
import org.openmetadata.service.util.TestUtils;

@Slf4j
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
public class MultiLanguageSearchTest extends OpenMetadataApplicationTest {

  private TableResourceTest tableResourceTest;
  private TopicResourceTest topicResourceTest;
  private ObjectMapper mapper = new ObjectMapper();

  @BeforeAll
  void setup(TestInfo test) {
    tableResourceTest = new TableResourceTest();
    topicResourceTest = new TopicResourceTest();

    try {
      tableResourceTest.setup(test);
      topicResourceTest.setup(test);
    } catch (Exception e) {
      LOG.warn("Some entities already exist - continuing with test execution");
    }
  }

  @Test
  void testTableSearchWithSpanishTranslations() throws IOException, InterruptedException {
    // Create a table with Spanish translations
    String tableName = "customer_orders" + System.currentTimeMillis();
    List<Column> columns =
        List.of(
            new Column()
                .withName("order_id")
                .withDataType(ColumnDataType.BIGINT)
                .withDescription("Order identifier"),
            new Column()
                .withName("customer_name")
                .withDataType(ColumnDataType.VARCHAR)
                .withDataLength(255)
                .withDescription("Customer full name"),
            new Column()
                .withName("total_amount")
                .withDataType(ColumnDataType.DECIMAL)
                .withDescription("Total order amount"));

    CreateTable createTable =
        tableResourceTest
            .createRequest("testSpanish")
            .withName(tableName)
            .withColumns(columns)
            .withTableConstraints(null)
            .withDescription("Customer orders tracking table");

    Table table = tableResourceTest.createEntity(createTable, ADMIN_AUTH_HEADERS);
    assertNotNull(table);

    // Update table with Spanish translations using locale parameter
    // This approach mimics how the UI would update translations and triggers inline indexing
    Table tableToUpdate = tableResourceTest.getEntity(table.getId(), "", ADMIN_AUTH_HEADERS);
    String originalJson = JsonUtils.pojoToJson(tableToUpdate);

    // Set Spanish display name and description
    tableToUpdate.setDisplayName("Órdenes de Clientes");
    tableToUpdate.setDescription("Tabla de seguimiento de órdenes de clientes");

    // Update column display names and descriptions in Spanish
    tableToUpdate.getColumns().get(0).setDisplayName("ID de Orden");
    tableToUpdate.getColumns().get(0).setDescription("Identificador de la orden");
    tableToUpdate.getColumns().get(1).setDisplayName("Nombre del Cliente");
    tableToUpdate.getColumns().get(1).setDescription("Nombre completo del cliente");
    tableToUpdate.getColumns().get(2).setDisplayName("Monto Total");
    tableToUpdate.getColumns().get(2).setDescription("Monto total de la orden");

    String updatedJson = JsonUtils.pojoToJson(tableToUpdate);
    JsonNode patch = JsonDiff.asJson(mapper.readTree(originalJson), mapper.readTree(updatedJson));

    // Patch with Spanish locale - this stores as translations and triggers inline indexing
    // Use the resource path directly
    WebTarget target = getResource("tables/" + table.getId());
    target = target.queryParam("locale", "es");
    Table patchedTable = TestUtils.patch(target, patch, Table.class, ADMIN_AUTH_HEADERS);

    // Wait for search index to be updated asynchronously
    Thread.sleep(5000); // Wait 5 seconds for OpenSearch/Elasticsearch to index the data

    // Debug: Get the actual document from the index to see what was indexed
    WebTarget searchTarget = getResource("search/query");
    searchTarget = searchTarget.queryParam("q", "id:" + table.getId());
    searchTarget = searchTarget.queryParam("index", "table_search_index");
    searchTarget = searchTarget.queryParam("size", 1);
    String docJson = get(searchTarget, String.class, TEST_AUTH_HEADERS);
    LOG.info("DEBUG: Indexed document search result: {}", docJson);

    // First, let's try searching without locale to see if the translationsSearchText field is
    // searchable at all
    Response plainSearchResponse = searchWithLocale("Órdenes", "table_search_index", null);
    assertEquals(200, plainSearchResponse.getStatus());
    String plainResponseBody = (String) plainSearchResponse.getEntity();
    LOG.info("Plain search response for 'Órdenes' (no locale): {}", plainResponseBody);

    // Test 1: Search in Spanish for "órdenes" should find the table
    Response spanishSearchResponse = searchWithLocale("órdenes", "table_search_index", "es");
    assertEquals(200, spanishSearchResponse.getStatus());
    String responseBody = (String) spanishSearchResponse.getEntity();
    LOG.info("Spanish search response for 'órdenes': {}", responseBody);

    // Parse JSON response to check hits
    JsonNode jsonResponse = mapper.readTree(responseBody);
    assertTrue(jsonResponse.has("hits"), "Response should have hits");
    JsonNode hits = jsonResponse.get("hits");
    assertTrue(hits.has("total"), "Hits should have total");
    JsonNode total = hits.get("total");
    int totalHits = total.has("value") ? total.get("value").asInt() : total.asInt();
    assertTrue(totalHits > 0, "Spanish search for 'órdenes' should find at least one result");

    // Test 2: Search in Spanish for "cliente" should find the table
    Response clienteSearchResponse = searchWithLocale("cliente", "table_search_index", "es");
    assertEquals(200, clienteSearchResponse.getStatus());
    responseBody = (String) clienteSearchResponse.getEntity();
    jsonResponse = mapper.readTree(responseBody);
    hits = jsonResponse.get("hits");
    total = hits.get("total");
    totalHits = total.has("value") ? total.get("value").asInt() : total.asInt();
    assertTrue(totalHits > 0, "Spanish search for 'cliente' should find at least one result");

    // Test 3: Search in Spanish for "monto" should find the table (column translation)
    Response montoSearchResponse = searchWithLocale("monto", "table_search_index", "es");
    assertEquals(200, montoSearchResponse.getStatus());
    responseBody = (String) montoSearchResponse.getEntity();
    jsonResponse = mapper.readTree(responseBody);
    hits = jsonResponse.get("hits");
    total = hits.get("total");
    totalHits = total.has("value") ? total.get("value").asInt() : total.asInt();
    assertTrue(totalHits > 0, "Spanish search for 'monto' should find at least one result");

    // Test 4: English search should still work with default fields
    Response englishSearchResponse = searchWithLocale("customer", "table_search_index", "en");
    assertEquals(200, englishSearchResponse.getStatus());
    responseBody = (String) englishSearchResponse.getEntity();
    jsonResponse = mapper.readTree(responseBody);
    hits = jsonResponse.get("hits");
    total = hits.get("total");
    totalHits = total.has("value") ? total.get("value").asInt() : total.asInt();
    assertTrue(totalHits > 0, "English search for 'customer' should find at least one result");
  }

  @Test
  void testTopicSearchWithFrenchTranslations() throws IOException, InterruptedException {
    // Create a topic with French translations
    String topicName = "user_events_" + System.currentTimeMillis();
    List<Field> schemaFields =
        List.of(
            new Field()
                .withName("event_id")
                .withDataType(FieldDataType.STRING)
                .withDescription("Event unique identifier"),
            new Field()
                .withName("user_id")
                .withDataType(FieldDataType.STRING)
                .withDescription("User identifier"),
            new Field()
                .withName("event_type")
                .withDataType(FieldDataType.STRING)
                .withDescription("Type of event"));

    MessageSchema messageSchema =
        new MessageSchema().withSchemaType(SchemaType.JSON).withSchemaFields(schemaFields);

    CreateTopic createTopic =
        topicResourceTest
            .createRequest("multiLangTopicTest_" + System.currentTimeMillis())
            .withName(topicName)
            .withMessageSchema(messageSchema)
            .withDescription("User activity events stream");

    Topic topic = topicResourceTest.createEntity(createTopic, ADMIN_AUTH_HEADERS);
    assertNotNull(topic);

    // Add French translations
    List<Translation> frenchTranslations =
        List.of(
            new Translation()
                .withLocale("fr")
                .withDisplayName("Événements Utilisateur")
                .withDescription("Flux d'événements d'activité utilisateur"));

    // Add field translations
    List<Translation> eventIdTranslations =
        List.of(
            new Translation()
                .withLocale("fr")
                .withDisplayName("ID d'Événement")
                .withDescription("Identifiant unique de l'événement"));

    List<Translation> userIdTranslations =
        List.of(
            new Translation()
                .withLocale("fr")
                .withDisplayName("ID Utilisateur")
                .withDescription("Identifiant de l'utilisateur"));

    // Update topic with translations via PATCH
    String patchJson =
        JsonUtils.pojoToJson(
            List.of(
                Map.of(
                    "op", "add",
                    "path", "/translations",
                    "value", new Translations().withTranslations(frenchTranslations)),
                Map.of(
                    "op", "add",
                    "path", "/messageSchema/schemaFields/0/translations",
                    "value", new Translations().withTranslations(eventIdTranslations)),
                Map.of(
                    "op", "add",
                    "path", "/messageSchema/schemaFields/1/translations",
                    "value", new Translations().withTranslations(userIdTranslations))));

    topicResourceTest.patchEntity(topic.getId(), JsonUtils.readTree(patchJson), ADMIN_AUTH_HEADERS);

    // Wait for indexing
    Thread.sleep(5000); // Wait for search index to be updated

    // Test 1: Search in French for "événements" should find the topic
    Response frenchSearchResponse = searchWithLocale("événements", "topic_search_index", "fr");
    assertEquals(200, frenchSearchResponse.getStatus());
    String responseBody = (String) frenchSearchResponse.getEntity();
    assertTrue(
        responseBody.contains(topicName), "French search for 'événements' should find the topic");

    // Test 2: Search in French for "utilisateur" should find the topic
    Response utilisateurSearchResponse =
        searchWithLocale("utilisateur", "topic_search_index", "fr");
    assertEquals(200, utilisateurSearchResponse.getStatus());
    responseBody = (String) utilisateurSearchResponse.getEntity();
    assertTrue(
        responseBody.contains(topicName), "French search for 'utilisateur' should find the topic");

    // Test 3: English search should still work
    Response englishSearchResponse = searchWithLocale("events", "topic_search_index", "en");
    assertEquals(200, englishSearchResponse.getStatus());
    responseBody = (String) englishSearchResponse.getEntity();
    assertTrue(
        responseBody.contains(topicName),
        "English search for 'events' should still find the topic");
  }

  @Test
  void testSearchWithLocaleFallback() throws IOException, InterruptedException {
    // Create a table with translations in base language (es) but search with regional variant
    // (es-MX)
    String tableName = "product_catalog_" + System.currentTimeMillis();

    CreateTable createTable =
        tableResourceTest
            .createRequest("testFallback")
            .withName(tableName)
            .withColumns(
                List.of(
                    new Column()
                        .withName("product_id")
                        .withDataType(ColumnDataType.BIGINT)
                        .withDescription("Product identifier")))
            .withTableConstraints(null)
            .withDescription("Product catalog table");

    Table table = tableResourceTest.createEntity(createTable, ADMIN_AUTH_HEADERS);

    // Add Spanish (es) translations
    List<Translation> spanishTranslations =
        List.of(
            new Translation()
                .withLocale("es")
                .withDisplayName("Catálogo de Productos")
                .withDescription("Tabla del catálogo de productos"));

    String patchJson =
        JsonUtils.pojoToJson(
            List.of(
                Map.of(
                    "op", "add",
                    "path", "/translations",
                    "value", new Translations().withTranslations(spanishTranslations))));

    tableResourceTest.patchEntity(table.getId(), JsonUtils.readTree(patchJson), ADMIN_AUTH_HEADERS);

    // Wait for indexing
    Thread.sleep(5000); // Wait for search index to be updated

    // Search with regional variant es-MX should fall back to es translations
    Response searchResponse = searchWithLocale("catálogo", "table_search_index", "es-MX");
    assertEquals(200, searchResponse.getStatus());
    String responseBody = (String) searchResponse.getEntity();
    assertTrue(
        responseBody.contains(tableName),
        "Search with locale es-MX should fall back to es translations");
  }

  @Test
  void testGlobalSearchWithMultipleLanguages() throws IOException, InterruptedException {
    // Create entities with different language translations
    String timestamp = String.valueOf(System.currentTimeMillis());

    // Create a table with German translations
    String tableName = "inventory_" + timestamp;
    CreateTable createTable =
        tableResourceTest
            .createRequest("testGerman")
            .withName(tableName)
            .withTableConstraints(null)
            .withDescription("Inventory management table");

    Table table = tableResourceTest.createEntity(createTable, ADMIN_AUTH_HEADERS);

    List<Translation> germanTranslations =
        List.of(
            new Translation()
                .withLocale("de")
                .withDisplayName("Bestandsverwaltung")
                .withDescription("Tabelle zur Bestandsverwaltung"));

    String tableTranslationPatch =
        JsonUtils.pojoToJson(
            List.of(
                Map.of(
                    "op", "add",
                    "path", "/translations",
                    "value", new Translations().withTranslations(germanTranslations))));

    tableResourceTest.patchEntity(
        table.getId(), JsonUtils.readTree(tableTranslationPatch), ADMIN_AUTH_HEADERS);

    // Create a topic with Japanese translations
    String topicName = "notifications_" + timestamp;
    CreateTopic createTopic =
        topicResourceTest
            .createRequest("testJapanese")
            .withName(topicName)
            .withDescription("Notification events topic");

    Topic topic = topicResourceTest.createEntity(createTopic, ADMIN_AUTH_HEADERS);

    List<Translation> japaneseTranslations =
        List.of(
            new Translation()
                .withLocale("ja")
                .withDisplayName("通知イベント")
                .withDescription("通知イベントトピック"));

    String topicTranslationPatch =
        JsonUtils.pojoToJson(
            List.of(
                Map.of(
                    "op", "add",
                    "path", "/translations",
                    "value", new Translations().withTranslations(japaneseTranslations))));

    topicResourceTest.patchEntity(
        topic.getId(), JsonUtils.readTree(topicTranslationPatch), ADMIN_AUTH_HEADERS);

    // Wait for indexing
    Thread.sleep(5000); // Wait for search index to be updated

    // Test global search with German locale
    Response germanSearchResponse = searchWithLocale("Bestandsverwaltung", "all", "de");
    assertEquals(200, germanSearchResponse.getStatus());
    String germanResponseBody = (String) germanSearchResponse.getEntity();
    assertTrue(
        germanResponseBody.contains(tableName), "Global search in German should find the table");

    // Test global search with Japanese locale
    Response japaneseSearchResponse = searchWithLocale("通知", "all", "ja");
    assertEquals(200, japaneseSearchResponse.getStatus());
    String japaneseResponseBody = (String) japaneseSearchResponse.getEntity();
    assertTrue(
        japaneseResponseBody.contains(topicName),
        "Global search in Japanese should find the topic");

    // Test that English search still works globally
    Response englishInventoryResponse = searchWithLocale("inventory", "all", "en");
    assertEquals(200, englishInventoryResponse.getStatus());
    String englishResponseBody = (String) englishInventoryResponse.getEntity();
    assertTrue(
        englishResponseBody.contains(tableName),
        "Global English search should still find entities by original names");
  }

  @Test
  void testSearchPerformanceWithTranslations() throws IOException, InterruptedException {
    // Create multiple tables with translations to test performance
    List<Table> tables = new ArrayList<>();
    String timestamp = String.valueOf(System.currentTimeMillis());

    for (int i = 0; i < 5; i++) {
      String tableName = "perf" + i + "_" + timestamp;
      CreateTable createTable =
          tableResourceTest
              .createRequest("testPerf" + i)
              .withName(tableName)
              .withTableConstraints(null)
              .withDescription("Performance test table " + i);

      Table table = tableResourceTest.createEntity(createTable, ADMIN_AUTH_HEADERS);

      // Add translations in multiple languages
      List<Translation> translations =
          List.of(
              new Translation()
                  .withLocale("es")
                  .withDisplayName("Tabla de Prueba " + i)
                  .withDescription("Tabla de prueba de rendimiento " + i),
              new Translation()
                  .withLocale("fr")
                  .withDisplayName("Table de Test " + i)
                  .withDescription("Table de test de performance " + i),
              new Translation()
                  .withLocale("de")
                  .withDisplayName("Testtabelle " + i)
                  .withDescription("Leistungstesttabelle " + i));

      String patchJson =
          JsonUtils.pojoToJson(
              List.of(
                  Map.of(
                      "op", "add",
                      "path", "/translations",
                      "value", new Translations().withTranslations(translations))));

      tableResourceTest.patchEntity(
          table.getId(), JsonUtils.readTree(patchJson), ADMIN_AUTH_HEADERS);

      tables.add(table);
    }

    // Wait for all entities to be indexed
    Thread.sleep(5000); // Wait for search index to be updated

    // Measure search performance with translations
    long startTime = System.currentTimeMillis();
    Response spanishSearchResponse = searchWithLocale("prueba", "table_search_index", "es");
    long spanishSearchTime = System.currentTimeMillis() - startTime;

    assertEquals(200, spanishSearchResponse.getStatus());
    String responseBody = (String) spanishSearchResponse.getEntity();
    JsonNode jsonResponse = mapper.readTree(responseBody);

    // Should find all 5 tables
    assertTrue(jsonResponse.has("hits"));
    JsonNode hits = jsonResponse.get("hits");
    assertTrue(hits.has("hits"));
    assertTrue(
        hits.get("hits").size() >= 5,
        "Should find at least 5 tables with Spanish translation 'prueba'");

    // Search time should be reasonable (less than 2 seconds)
    assertTrue(
        spanishSearchTime < 2000, "Search with translations should complete in reasonable time");

    LOG.info("Spanish search completed in {} ms", spanishSearchTime);

    // Test French search
    startTime = System.currentTimeMillis();
    Response frenchSearchResponse = searchWithLocale("test", "table_search_index", "fr");
    long frenchSearchTime = System.currentTimeMillis() - startTime;

    assertEquals(200, frenchSearchResponse.getStatus());
    assertTrue(frenchSearchTime < 2000, "French search should also complete in reasonable time");

    LOG.info("French search completed in {} ms", frenchSearchTime);
  }

  private Response searchWithQuery(String query, String index) throws IOException {
    WebTarget target = getResource("search/query");
    target = target.queryParam("q", URLEncoder.encode(query, StandardCharsets.UTF_8));
    target = target.queryParam("index", index);

    try {
      String result = get(target, String.class, ADMIN_AUTH_HEADERS);
      return Response.ok(result).build();
    } catch (Exception e) {
      LOG.error("Error occurred while executing search query: {}", e.getMessage());
      return Response.status(500).entity(e.getMessage()).build();
    }
  }

  private Response searchWithLocale(String query, String index, String locale) throws IOException {
    WebTarget target = getResource("search/query");
    target = target.queryParam("q", query);
    target = target.queryParam("index", index);
    target = target.queryParam("locale", locale);
    target = target.queryParam("from", 0);
    target = target.queryParam("size", 10);
    target = target.queryParam("track_total_hits", true);

    try {
      String result = get(target, String.class, ADMIN_AUTH_HEADERS);
      return Response.ok(result).build();
    } catch (Exception e) {
      LOG.error("Error occurred while executing search query with locale: {}", e.getMessage());
      return Response.status(500).entity(e.getMessage()).build();
    }
  }
}

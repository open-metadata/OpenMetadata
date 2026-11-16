/*
 *  Copyright 2026 Collate
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

package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.Duration;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import org.awaitility.Awaitility;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.data.CreateDatabase;
import org.openmetadata.schema.api.data.CreateDatabaseSchema;
import org.openmetadata.schema.api.data.CreateTable;
import org.openmetadata.schema.entity.data.Database;
import org.openmetadata.schema.entity.data.DatabaseSchema;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.services.DatabaseService;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.ColumnDataType;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.fluent.DatabaseServices;

/**
 * Issue #22011 — search must be accent-insensitive. A Portuguese speaker whose table is named
 * "Manutenção" types "Manutencao" and gets nothing back. The mirror case matters just as much: the
 * person searching does not know whether whoever named the asset used accents, so "Ambulatório" must
 * also reach a table named "Ambulatorio".
 *
 * <p>Nothing here is mocked. Tables are created through the real API and searched through {@code
 * /v1/search/query}, so the assertions run against the shipped {@code searchSettings.json}, the real
 * {@code en} index mappings and their {@code om_analyzer}/{@code om_ngram}/{@code lowercase_normalizer}
 * definitions, and a live search engine.
 *
 * <p>Accents break search in two distinct ways, and both are asserted because a fix for one does not
 * imply the other:
 *
 * <ul>
 *   <li><b>Reachability</b> — with no un-accented token left in the name to carry the match, the
 *       asset is simply not found. These return zero hits.
 *   <li><b>Ranking</b> — where some other token does carry the match, the asset is found but never
 *       reaches the exact or phrase bands, so an unrelated row holding the query as a literal token
 *       takes the top row away from the asset the query actually names.
 * </ul>
 *
 * <p>Every search is scoped to the schema the test just created, so the corpus is this test's own
 * rows and a parallel lane cannot move the ranking being asserted on. Indexing is async post-commit,
 * so each test first waits for its fixtures via a match-all — keeping "not indexed yet" from being
 * reported as "accents are broken".
 */
@Execution(ExecutionMode.CONCURRENT)
@ExtendWith(TestNamespaceExtension.class)
public class AccentInsensitiveSearchIT {

  private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();
  private static final Duration POLL_AT_MOST = Duration.ofSeconds(90);
  private static final Duration POLL_INTERVAL = Duration.ofMillis(500);
  private static final String TABLE_SEARCH_INDEX = "table_search_index";

  private String schemaFilter;

  /**
   * The reported case. "Manutenção" carries no un-accented word, so nothing rescues the match: the
   * n-gram band cannot help either, because every 3-gram spanning ç or ã differs from the query's.
   */
  @Test
  @DisplayName("An un-accented query finds the accented table it names")
  void unaccentedQueryFindsAccentedTable(TestNamespace ns) {
    DatabaseSchema schema = createSchema(ns, "accent_fold");
    createTable(schema, "Manutenção");
    createTable(schema, "Inventario");
    awaitIndexed(2);

    Map<String, Double> scores = search("Manutencao");

    assertTrue(
        scores.containsKey("Manutenção"),
        "'Manutencao' must reach the table named 'Manutenção', got: " + scores);
  }

  /** The mirror: the asset is plain ASCII and the person searching does type the accents. */
  @Test
  @DisplayName("An accented query finds the un-accented table it names")
  void accentedQueryFindsUnaccentedTable(TestNamespace ns) {
    DatabaseSchema schema = createSchema(ns, "accent_strip");
    createTable(schema, "Ambulatorio_Geral");
    createTable(schema, "Inventario");
    awaitIndexed(2);

    Map<String, Double> scores = search("Ambulatório_Geral");

    assertTrue(
        scores.containsKey("Ambulatorio_Geral"),
        "'Ambulatório_Geral' must reach the table named 'Ambulatorio_Geral', got: " + scores);
  }

  /** Description is a searched field, and its accents must fold on the same terms as a name. */
  @Test
  @DisplayName("An un-accented query matches an accented description")
  void unaccentedQueryMatchesAccentedDescription(TestNamespace ns) {
    DatabaseSchema schema = createSchema(ns, "accent_desc");
    createTable(schema, "Tabela_Registos", "Registos do bloco cirúrgico do hospital.");
    createTable(schema, "Inventario", "Registos de stock.");
    awaitIndexed(2);

    Map<String, Double> scores = search("cirurgico");

    assertTrue(
        scores.containsKey("Tabela_Registos"),
        "'cirurgico' must match the description 'bloco cirúrgico', got: " + scores);
  }

  /**
   * Ranking, not reachability. "Operatório" is the table the query names; "Operatorio_Backup" merely
   * starts with the query as a literal token. Without folding, only the latter can reach the exact
   * and phrase bands, so the table the user asked for is pushed below it.
   */
  @Test
  @DisplayName("An accented name ranks as the exact match for its un-accented query")
  void accentedNameRanksAsTheExactMatch(TestNamespace ns) {
    DatabaseSchema schema = createSchema(ns, "accent_rank");
    createTable(schema, "Operatório");
    createTable(schema, "Operatorio_Backup");
    awaitIndexed(2);

    Map<String, Double> scores = search("Operatorio");

    assertTrue(
        scores.containsKey("Operatório"),
        "'Operatorio' must reach the table named 'Operatório', got: " + scores);
    assertEquals(
        "Operatório",
        scores.keySet().iterator().next(),
        "the table the query names must outrank one that merely starts with it, got: " + scores);
  }

  /**
   * Waits until every fixture in this test's schema is searchable. The probe is a match-all rather
   * than the accented query under test, so a fixture that is simply not indexed yet fails as a
   * timeout here instead of masquerading as an accent-folding failure in the assertion.
   */
  private void awaitIndexed(int expectedRows) {
    OpenMetadataClient client = SdkClients.adminClient();
    Awaitility.await("fixtures indexed")
        .pollInterval(POLL_INTERVAL)
        .atMost(POLL_AT_MOST)
        .ignoreExceptions()
        .untilAsserted(
            () -> {
              Map<String, Double> indexed = fetchScores(client, "*");
              assertEquals(expectedRows, indexed.size(), "not every table is indexed yet");
            });
  }

  /** Runs the real search endpoint and returns name to score, ordered by descending score. */
  private Map<String, Double> search(String query) {
    try {
      return fetchScores(SdkClients.adminClient(), query);
    } catch (Exception searchFailed) {
      throw new AssertionError("search for '" + query + "' failed", searchFailed);
    }
  }

  private Map<String, Double> fetchScores(OpenMetadataClient client, String query)
      throws Exception {
    String response =
        client
            .search()
            .query(query)
            .index(TABLE_SEARCH_INDEX)
            .queryFilter(schemaFilter)
            .size(20)
            .deleted(false)
            .execute();
    JsonNode hits = OBJECT_MAPPER.readTree(response).path("hits").path("hits");
    Map<String, Double> scores = new LinkedHashMap<>();
    for (JsonNode hit : hits) {
      scores.put(hit.path("_source").path("name").asText(""), hit.path("_score").asDouble());
    }
    return scores;
  }

  private DatabaseSchema createSchema(TestNamespace ns, String baseName) {
    String shortId = ns.shortPrefix();
    DatabaseService service =
        DatabaseServices.builder()
            .name("accent_svc_" + shortId + "_" + baseName)
            .connection(
                DatabaseServices.postgresConnection()
                    .hostPort("localhost:5432")
                    .username("test")
                    .build())
            .description("Test service for accent-insensitive search")
            .create();

    CreateDatabase databaseRequest = new CreateDatabase();
    databaseRequest.setName("accent_db_" + shortId + "_" + baseName);
    databaseRequest.setService(service.getFullyQualifiedName());
    Database database = SdkClients.adminClient().databases().create(databaseRequest);

    CreateDatabaseSchema schemaRequest = new CreateDatabaseSchema();
    schemaRequest.setName("accent_schema_" + shortId + "_" + baseName);
    schemaRequest.setDatabase(database.getFullyQualifiedName());
    DatabaseSchema schema = SdkClients.adminClient().databaseSchemas().create(schemaRequest);
    schemaFilter =
        "{\"query\":{\"term\":{\"databaseSchema.fullyQualifiedName.keyword\":\""
            + schema.getFullyQualifiedName().toLowerCase(Locale.ROOT)
            + "\"}}}";
    return schema;
  }

  private Table createTable(DatabaseSchema schema, String name) {
    return createTable(schema, name, "Records used by the accent-insensitive search test.");
  }

  private Table createTable(DatabaseSchema schema, String name, String description) {
    CreateTable request = new CreateTable();
    request.setName(name);
    request.setDatabaseSchema(schema.getFullyQualifiedName());
    request.setDescription(description);
    request.setColumns(
        List.of(
            new Column()
                .withName("id")
                .withDataType(ColumnDataType.BIGINT)
                .withDescription("Identifier")));
    Table table = SdkClients.adminClient().tables().create(request);
    assertNotNull(table.getId(), "table " + name + " should have been created");
    return table;
  }
}

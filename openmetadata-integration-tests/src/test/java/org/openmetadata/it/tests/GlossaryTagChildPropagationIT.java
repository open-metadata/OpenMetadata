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

import static org.awaitility.Awaitility.await;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInstance;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.bootstrap.SharedEntities;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.AddGlossaryToAssetsRequest;
import org.openmetadata.schema.api.data.CreateDatabase;
import org.openmetadata.schema.api.data.CreateDatabaseSchema;
import org.openmetadata.schema.api.data.CreateGlossary;
import org.openmetadata.schema.api.data.CreateGlossaryTerm;
import org.openmetadata.schema.api.data.CreateTable;
import org.openmetadata.schema.api.tests.CreateTestCase;
import org.openmetadata.schema.entity.data.Database;
import org.openmetadata.schema.entity.data.DatabaseSchema;
import org.openmetadata.schema.entity.data.Glossary;
import org.openmetadata.schema.entity.data.GlossaryTerm;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.tests.TestCase;
import org.openmetadata.schema.tests.TestCaseParameterValue;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.ColumnDataType;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.schema.type.api.BulkOperationResult;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.network.HttpMethod;
import org.openmetadata.service.Entity;

/**
 * Regression for issue #31756 — a glossary term applied to a Table must reach its columns on both
 * sides of the system, and removing it must reach them too.
 *
 * <p>Bug B: {@code GET /tables/{id}?fields=columns,tags} returned each column's own tags only, so
 * the column tag panel showed nothing while Explore and the glossary Assets tab (both search-backed)
 * showed the term. {@code Entity.populateEntityFieldTags} now projects the parent's glossary terms
 * onto every field on read.
 *
 * <p>Bug A: removing the term left the label behind on the child search docs.
 *
 * <p>The projected label is {@code PROPAGATED}, not {@code DERIVED} as the issue proposed:
 * {@code DERIVED} means "recomputed on read from the glossary term's own classification tags" and is
 * stripped by every write path ({@code EntityRepository.applyTags}) and regenerated on every read
 * ({@code TagLabelUtil.addDerivedTags}), so it cannot survive a round trip.
 */
@Execution(ExecutionMode.CONCURRENT)
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
@ExtendWith(TestNamespaceExtension.class)
public class GlossaryTagChildPropagationIT {

  private static final ObjectMapper MAPPER = new ObjectMapper();
  private static final Duration AWAIT_TIMEOUT = Duration.ofMinutes(3);
  private static final Duration POLL_INTERVAL = Duration.ofSeconds(2);
  private static final String COLUMN_INDEX = "column_search_index";
  private static final String TOP_LEVEL_COLUMN = "payload";
  private static final String NESTED_COLUMN = "inner";
  private static final String CLEAR_TAGS_PATCH =
      """
      [{"op": "replace", "path": "/tags", "value": []}]
      """;

  @Test
  void termOnTable_isReturnedOnEveryColumnIncludingNested(TestNamespace ns) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();
    Database database = null;
    try {
      Fixture fixture = createSchema(client, ns);
      database = fixture.database();
      Table table =
          createTableWithNestedColumn(client, fixture.schema(), ns.shortPrefix("prop_tbl"));
      GlossaryTerm term = createTerm(client, ns, "prop");

      applyTermToTable(client, table, term);

      Table tagged = client.tables().get(table.getId().toString(), "columns,tags");
      assertEquals(
          TagLabel.LabelType.PROPAGATED,
          labelOn(tagged, TOP_LEVEL_COLUMN, term).getLabelType(),
          "top-level column should carry the table's term as PROPAGATED");
      assertEquals(
          TagLabel.LabelType.PROPAGATED,
          labelOn(tagged, NESTED_COLUMN, term).getLabelType(),
          "nested column should carry the table's term as PROPAGATED");

      clearTableTags(client, table);

      Table cleared = client.tables().get(table.getId().toString(), "columns,tags");
      assertTrue(
          findLabel(cleared, TOP_LEVEL_COLUMN, term).isEmpty(),
          "top-level column should lose the term once the table no longer carries it");
      assertTrue(
          findLabel(cleared, NESTED_COLUMN, term).isEmpty(),
          "nested column should lose the term once the table no longer carries it");
    } finally {
      cleanUp(client, database);
    }
  }

  @Test
  void columnWithItsOwnTerm_keepsManualLabelAndSurvivesTableTagRemoval(TestNamespace ns)
      throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();
    Database database = null;
    try {
      Fixture fixture = createSchema(client, ns);
      database = fixture.database();
      Table table =
          createTableWithNestedColumn(client, fixture.schema(), ns.shortPrefix("manual_tbl"));
      GlossaryTerm term = createTerm(client, ns, "manual");

      // The column carries the term itself, before the table ever does.
      Table withColumnTag = client.tables().get(table.getId().toString(), "columns,tags");
      columnNamed(withColumnTag, TOP_LEVEL_COLUMN).setTags(List.of(manualLabel(term)));
      client.tables().update(withColumnTag.getId(), withColumnTag);

      applyTermToTable(client, table, term);

      Table tagged = client.tables().get(table.getId().toString(), "columns,tags");
      List<TagLabel> columnLabels = labelsFor(tagged, TOP_LEVEL_COLUMN, term);
      assertEquals(1, columnLabels.size(), "the term should not be duplicated on the column");
      assertEquals(
          TagLabel.LabelType.MANUAL,
          columnLabels.getFirst().getLabelType(),
          "a column's own label must win over the projected one");

      clearTableTags(client, table);

      Table cleared = client.tables().get(table.getId().toString(), "columns,tags");
      assertEquals(
          TagLabel.LabelType.MANUAL,
          labelOn(cleared, TOP_LEVEL_COLUMN, term).getLabelType(),
          "removing the table's term must not remove the column's own term");
    } finally {
      cleanUp(client, database);
    }
  }

  /**
   * The search half of #31756: whatever shows up under a glossary term's assets must actually lose
   * the term when it is removed. Column docs are rebuilt from the table entity, which carries the
   * projected labels, so a tags change has to force that rebuild — the inherited-field script path
   * never writes {@code tags}, so a removed term used to linger and keep the column listed as an
   * asset. See SearchRepository.hasColumnsChanged.
   */
  @Test
  void termRemovalFromTable_clearsPropagatedLabelFromColumnSearchDoc(TestNamespace ns)
      throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();
    Database database = null;
    try {
      Fixture fixture = createSchema(client, ns);
      database = fixture.database();
      Table table =
          createTableWithNestedColumn(client, fixture.schema(), ns.shortPrefix("search_tbl"));
      GlossaryTerm term = createTerm(client, ns, "search");
      String columnFqn = table.getFullyQualifiedName() + "." + TOP_LEVEL_COLUMN;

      applyTermToTable(client, table, term);
      awaitColumnDocHasTerm(client, columnFqn, term, true);

      clearTableTags(client, table);
      awaitColumnDocHasTerm(client, columnFqn, term, false);
    } finally {
      cleanUp(client, database);
    }
  }

  /**
   * Ram's first question on #31756: tag a table, then delete the asset from the glossary term's
   * Assets tab — does the term still show on the table's test cases?
   *
   * <p>Test cases are entities, not fields, so nothing rebuilds their docs from the parent the way
   * column docs are rebuilt. The bulk API also re-indexes through {@code updateEntity(ref)}, which
   * clears the change description, so the descriptor-driven cascade never fired and the term stayed
   * on the test case doc. {@code SearchRepository.propagateTagChangeToChildren} drives it explicitly.
   */
  @Test
  void bulkRemoveFromGlossary_clearsPropagatedLabelFromTestCaseSearchDoc(TestNamespace ns)
      throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();
    Database database = null;
    try {
      Fixture fixture = createSchema(client, ns);
      database = fixture.database();
      Table table =
          createTableWithNestedColumn(client, fixture.schema(), ns.shortPrefix("bulk_tbl"));
      GlossaryTerm term = createTerm(client, ns, "bulk");
      TestCase testCase = createTestCase(client, ns, table);

      applyTermToTable(client, table, term);
      awaitTestCaseDocHasTerm(client, testCase.getFullyQualifiedName(), term, true);

      bulkRemoveAssetFromTerm(client, term, table);
      awaitTestCaseDocHasTerm(client, testCase.getFullyQualifiedName(), term, false);
    } finally {
      cleanUp(client, database);
    }
  }

  // ===================================================================
  // Helpers
  // ===================================================================

  /** The Database is carried alongside the schema purely so the test can hard-delete it. */
  private record Fixture(Database database, DatabaseSchema schema) {}

  private static Fixture createSchema(OpenMetadataClient client, TestNamespace ns) {
    Database database =
        client
            .databases()
            .create(
                new CreateDatabase()
                    .withName(ns.shortPrefix("prop_db"))
                    .withService(SharedEntities.get().MYSQL_SERVICE.getFullyQualifiedName()));
    DatabaseSchema schema =
        client
            .databaseSchemas()
            .create(
                new CreateDatabaseSchema()
                    .withName(ns.shortPrefix("prop_sch"))
                    .withDatabase(database.getFullyQualifiedName()));
    return new Fixture(database, schema);
  }

  private static Table createTableWithNestedColumn(
      OpenMetadataClient client, DatabaseSchema schema, String tableName) {
    Column nested = new Column().withName(NESTED_COLUMN).withDataType(ColumnDataType.STRING);
    Column topLevel =
        new Column()
            .withName(TOP_LEVEL_COLUMN)
            .withDataType(ColumnDataType.STRUCT)
            .withChildren(List.of(nested));
    return client
        .tables()
        .create(
            new CreateTable()
                .withName(tableName)
                .withDatabaseSchema(schema.getFullyQualifiedName())
                .withColumns(List.of(topLevel)));
  }

  /**
   * The glossary is registered with {@code trackRoot} so TestNamespaceExtension tears it down;
   * without it a glossary and term leak per test and accumulate on a shared cluster. Deleting the
   * glossary removes its terms, so the term needs no separate registration.
   */
  private static GlossaryTerm createTerm(
      OpenMetadataClient client, TestNamespace ns, String suffix) {
    Glossary glossary =
        ns.trackRoot(
            Entity.GLOSSARY,
            client
                .glossaries()
                .create(
                    new CreateGlossary()
                        .withName(ns.prefix("prop_glossary_" + suffix))
                        .withDescription("Glossary for child tag propagation")));
    return client
        .glossaryTerms()
        .create(
            new CreateGlossaryTerm()
                .withName(ns.prefix("prop_term_" + suffix))
                .withGlossary(glossary.getFullyQualifiedName())
                .withDescription("Term propagated to table columns"));
  }

  /** PUT merges tags rather than replacing them, which is what we want for an add. */
  private static void applyTermToTable(OpenMetadataClient client, Table table, GlossaryTerm term) {
    Table toTag = client.tables().get(table.getId().toString(), "tags");
    List<TagLabel> tags = new ArrayList<>(Optional.ofNullable(toTag.getTags()).orElse(List.of()));
    tags.add(manualLabel(term));
    toTag.setTags(tags);
    client.tables().update(toTag.getId(), toTag);
  }

  /** PUT never deletes tags (see {@code EntityRepository.updateTags}), so removal needs PATCH. */
  private static void clearTableTags(OpenMetadataClient client, Table table) throws Exception {
    JsonNode patch = MAPPER.readTree(CLEAR_TAGS_PATCH);
    client.tables().patch(table.getId(), patch);
  }

  private static TagLabel manualLabel(GlossaryTerm term) {
    return new TagLabel()
        .withTagFQN(term.getFullyQualifiedName())
        .withSource(TagLabel.TagSource.GLOSSARY)
        .withLabelType(TagLabel.LabelType.MANUAL);
  }

  private static Column columnNamed(Table table, String name) {
    Column found = findColumn(table.getColumns(), name);
    assertNotNull(found, () -> "column " + name + " not found on " + table.getName());
    return found;
  }

  private static Column findColumn(List<Column> columns, String name) {
    Column result = null;
    for (Column column : Optional.ofNullable(columns).orElse(List.of())) {
      if (name.equals(column.getName())) {
        result = column;
      } else {
        Column nested = findColumn(column.getChildren(), name);
        if (nested != null) {
          result = nested;
        }
      }
      if (result != null) {
        break;
      }
    }
    return result;
  }

  private static List<TagLabel> labelsFor(Table table, String columnName, GlossaryTerm term) {
    return Optional.ofNullable(columnNamed(table, columnName).getTags()).orElse(List.of()).stream()
        .filter(tag -> term.getFullyQualifiedName().equals(tag.getTagFQN()))
        .toList();
  }

  private static Optional<TagLabel> findLabel(Table table, String columnName, GlossaryTerm term) {
    return labelsFor(table, columnName, term).stream().findFirst();
  }

  private static TagLabel labelOn(Table table, String columnName, GlossaryTerm term) {
    return findLabel(table, columnName, term)
        .orElseThrow(
            () ->
                new AssertionError(
                    "column "
                        + columnName
                        + " is missing term "
                        + term.getFullyQualifiedName()
                        + "; tags were "
                        + columnNamed(table, columnName).getTags()));
  }

  private static void awaitColumnDocHasTerm(
      OpenMetadataClient client, String columnFqn, GlossaryTerm term, boolean expected) {
    await(COLUMN_INDEX + " term presence=" + expected + " for " + columnFqn)
        .atMost(AWAIT_TIMEOUT)
        .pollInterval(POLL_INTERVAL)
        .ignoreExceptions()
        .untilAsserted(
            () -> {
              JsonNode source = fetchColumnSource(client, columnFqn);
              assertNotNull(source, () -> "column " + columnFqn + " not yet indexed");
              JsonNode tags = source.path("tags");
              boolean present = false;
              for (JsonNode tag : tags) {
                if (term.getFullyQualifiedName().equals(tag.path("tagFQN").asText())) {
                  present = true;
                  break;
                }
              }
              if (expected) {
                assertTrue(present, () -> "column doc missing the term; tags=" + tags);
              } else {
                assertFalse(present, () -> "column doc still carries the term; tags=" + tags);
              }
            });
  }

  /**
   * Resolves a column doc through a structured term on {@code fqnParts}, mirroring
   * {@code ColumnSearchIndexIT}. {@code fqnParts} is a plain keyword array with no normalizer, so the
   * FQN matches case-sensitively and exactly. A fielded query on {@code fullyQualifiedName.keyword}
   * would silently match nothing — the column index maps {@code fullyQualifiedName} as a normalized
   * keyword with no {@code .keyword} subfield, and a miss there is indistinguishable from an
   * unindexed doc.
   */
  private static JsonNode fetchColumnSource(OpenMetadataClient client, String columnFqn)
      throws Exception {
    String fqnPartsFilter =
        "{\"query\":{\"term\":{\"fqnParts\":\""
            + columnFqn.replace("\\", "\\\\").replace("\"", "\\\"")
            + "\"}}}";
    String rawJson =
        client
            .search()
            .query("*")
            .index(COLUMN_INDEX)
            .queryFilter(fqnPartsFilter)
            .size(10)
            .deleted(false)
            .execute();
    JsonNode hits = MAPPER.readTree(rawJson).path("hits").path("hits");
    JsonNode result = null;
    for (JsonNode hit : hits) {
      JsonNode source = hit.path("_source");
      if (columnFqn.equals(source.path("fullyQualifiedName").asText(""))) {
        result = source;
        break;
      }
    }
    return result;
  }

  private static TestCase createTestCase(OpenMetadataClient client, TestNamespace ns, Table table) {
    return client
        .testCases()
        .create(
            new CreateTestCase()
                .withName(ns.shortPrefix("prop_tc"))
                .withEntityLink("<#E::table::" + table.getFullyQualifiedName() + ">")
                .withTestDefinition("tableRowCountToEqual")
                .withParameterValues(
                    List.of(new TestCaseParameterValue().withName("value").withValue("100"))));
  }

  /** Removes the table through the glossary Assets tab route, not a table PATCH. */
  private static void bulkRemoveAssetFromTerm(
      OpenMetadataClient client, GlossaryTerm term, Table table) throws Exception {
    AddGlossaryToAssetsRequest request =
        new AddGlossaryToAssetsRequest()
            .withAssets(List.of(table.getEntityReference()))
            .withDryRun(false);
    client
        .getHttpClient()
        .execute(
            HttpMethod.PUT,
            "/v1/glossaryTerms/" + term.getId() + "/assets/remove",
            request,
            BulkOperationResult.class);
  }

  private static void awaitTestCaseDocHasTerm(
      OpenMetadataClient client, String testCaseFqn, GlossaryTerm term, boolean expected) {
    await("test_case_search_index term presence=" + expected + " for " + testCaseFqn)
        .atMost(AWAIT_TIMEOUT)
        .pollInterval(POLL_INTERVAL)
        .ignoreExceptions()
        .untilAsserted(
            () -> {
              String rawJson =
                  client
                      .search()
                      .query("fullyQualifiedName.keyword:\"" + testCaseFqn + "\"")
                      .index("test_case_search_index")
                      .size(1)
                      .execute();
              JsonNode hits = MAPPER.readTree(rawJson).path("hits").path("hits");
              assertTrue(
                  hits.isArray() && !hits.isEmpty(),
                  () -> "test case " + testCaseFqn + " not yet indexed; raw=" + rawJson);
              JsonNode tags = hits.get(0).path("_source").path("tags");
              boolean present = false;
              for (JsonNode tag : tags) {
                if (term.getFullyQualifiedName().equals(tag.path("tagFQN").asText())) {
                  present = true;
                  break;
                }
              }
              if (expected) {
                assertTrue(present, () -> "test case doc missing the term; tags=" + tags);
              } else {
                assertFalse(present, () -> "test case doc still carries the term; tags=" + tags);
              }
            });
  }

  private static void cleanUp(OpenMetadataClient client, Database database) {
    if (database != null) {
      try {
        client
            .databases()
            .delete(database.getId().toString(), Map.of("hardDelete", "true", "recursive", "true"));
      } catch (Exception ignored) {
        // best-effort cleanup; assertion failures take precedence
      }
    }
  }
}

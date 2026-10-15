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
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.openmetadata.it.tests.GlossaryTagChildFixtures.NESTED_COLUMN;
import static org.openmetadata.it.tests.GlossaryTagChildFixtures.TOP_LEVEL_COLUMN;
import static org.openmetadata.it.tests.GlossaryTagChildFixtures.applyTermToTable;
import static org.openmetadata.it.tests.GlossaryTagChildFixtures.changeTermAsset;
import static org.openmetadata.it.tests.GlossaryTagChildFixtures.cleanUp;
import static org.openmetadata.it.tests.GlossaryTagChildFixtures.clearTableTags;
import static org.openmetadata.it.tests.GlossaryTagChildFixtures.createSchema;
import static org.openmetadata.it.tests.GlossaryTagChildFixtures.createTableWithNestedColumn;
import static org.openmetadata.it.tests.GlossaryTagChildFixtures.createTerm;
import static org.openmetadata.it.tests.GlossaryTagChildFixtures.createTestCase;
import static org.openmetadata.it.tests.GlossaryTagChildFixtures.findLabel;
import static org.openmetadata.it.tests.GlossaryTagChildFixtures.label;
import static org.openmetadata.it.tests.GlossaryTagChildFixtures.labelOn;
import static org.openmetadata.it.tests.GlossaryTagChildFixtures.labelsFor;
import static org.openmetadata.it.tests.GlossaryTagChildFixtures.setColumnLabels;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.Duration;
import java.util.List;
import java.util.concurrent.Callable;
import java.util.stream.StreamSupport;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInstance;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.tests.GlossaryTagChildFixtures.Fixture;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.entity.data.Database;
import org.openmetadata.schema.entity.data.GlossaryTerm;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.tests.TestCase;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.models.ListParams;

/**
 * Regression for issue #31756 — a glossary term applied to a Table must reach its columns on both
 * sides of the system, and removing it must reach them too.
 *
 * <p>Bug B: {@code GET /tables/{id}?fields=columns,tags} returned each column's own tags only, so
 * the column tag panel showed nothing while Explore and the glossary Assets tab (both search-backed)
 * showed the term. {@code Entity.populateEntityFieldTags} now has every field inherit the parent's
 * glossary terms on read, marked {@code DERIVED} the way an entity inherits its parent's tags.
 *
 * <p>Bug A: removing the term left the label behind on the child search docs.
 *
 * <p>The write side — what a client sending these labels back can and cannot store — is in {@code
 * GlossaryTagChildPersistenceIT}.
 */
@Execution(ExecutionMode.CONCURRENT)
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
@ExtendWith(TestNamespaceExtension.class)
public class GlossaryTagChildPropagationIT {

  private static final ObjectMapper MAPPER = new ObjectMapper();
  private static final Duration AWAIT_TIMEOUT = Duration.ofMinutes(3);
  private static final Duration POLL_INTERVAL = Duration.ofSeconds(2);
  private static final String COLUMN_INDEX = "column_search_index";
  private static final String TEST_CASE_INDEX = "test_case_search_index";

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
          TagLabel.LabelType.DERIVED,
          labelOn(tagged, TOP_LEVEL_COLUMN, term).getLabelType(),
          "top-level column should inherit the table's term as DERIVED");
      assertEquals(
          TagLabel.LabelType.DERIVED,
          labelOn(tagged, NESTED_COLUMN, term).getLabelType(),
          "nested column should inherit the table's term as DERIVED");

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

  /**
   * A list returns the same column tags as a get: the bulk read inherits the table's terms too,
   * whether or not the list also asks for the table's own tags. The bulk field fetchers run in no
   * fixed order, and a table's columns are fetched before its tags.
   */
  @Test
  void termOnTable_isReturnedOnColumnsByTheListEndpoint(TestNamespace ns) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();
    Database database = null;
    try {
      Fixture fixture = createSchema(client, ns);
      database = fixture.database();
      Table table =
          createTableWithNestedColumn(client, fixture.schema(), ns.shortPrefix("list_tbl"));
      GlossaryTerm term = createTerm(client, ns, "list");

      applyTermToTable(client, table, term);

      for (String fields : List.of("columns,tags", "columns")) {
        Table fromList = listedTable(client, fixture, table, fields);
        for (String column : List.of(TOP_LEVEL_COLUMN, NESTED_COLUMN)) {
          assertEquals(
              TagLabel.LabelType.DERIVED,
              labelOn(fromList, column, term).getLabelType(),
              column + " listed with fields=" + fields);
        }
      }
    } finally {
      cleanUp(client, database);
    }
  }

  private static Table listedTable(
      OpenMetadataClient client, Fixture fixture, Table table, String fields) {
    List<Table> listed =
        client
            .tables()
            .list(
                new ListParams()
                    .setFields(fields)
                    .setDatabaseSchema(fixture.schema().getFullyQualifiedName())
                    .setLimit(10))
            .getData();
    return listed.stream()
        .filter(candidate -> table.getId().equals(candidate.getId()))
        .findFirst()
        .orElseThrow(() -> new AssertionError("table missing from the list: " + listed));
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
      setColumnLabels(
          client, table, TOP_LEVEL_COLUMN, List.of(label(term, TagLabel.LabelType.MANUAL)));
      applyTermToTable(client, table, term);

      Table tagged = client.tables().get(table.getId().toString(), "columns,tags");
      List<TagLabel> columnLabels = labelsFor(tagged, TOP_LEVEL_COLUMN, term);
      assertEquals(1, columnLabels.size(), "the term should not be duplicated on the column");
      assertEquals(
          TagLabel.LabelType.MANUAL,
          columnLabels.getFirst().getLabelType(),
          "a column's own label must win over the inherited one");

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
   * the term when it is removed. A tags-only table change reaches the column documents through the
   * tag cascade, whose delete script removes the column's DERIVED copy of the term; a term removed
   * used to linger there and keep the column listed as an asset.
   */
  @Test
  void termRemovalFromTable_clearsTheInheritedTermFromColumnSearchDoc(TestNamespace ns)
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
      awaitColumnDocCarriesTerm(client, columnFqn, term, true);

      clearTableTags(client, table);
      awaitColumnDocCarriesTerm(client, columnFqn, term, false);
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
   *
   * <p>The time-series documents that embed a copy of the test case are covered by {@code
   * CustomIndexTest#testTestCaseResultIndex_derivesParentTableGlossaryTerms} and its
   * resolution-status twin, not here. Their builders derive the parent's terms, so a result or
   * incident written at any point after tagging carries the term — that part is deterministic and
   * belongs in a unit test. Bringing documents that already existed back in line is left to the same
   * child fan-out as everything else, and that is best-effort: it is submitted as an update-by-query
   * with {@code wait_for_completion=false} and {@code conflicts=proceed}, so a dropped update
   * reports nothing and cannot be told apart from one that never ran.
   */
  @Test
  void bulkRemoveFromGlossary_clearsTheInheritedTermFromTestCaseDoc(TestNamespace ns)
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
      awaitTestCaseDocCarriesTerm(client, testCase.getFullyQualifiedName(), term, true);

      // Removes the table through the glossary Assets tab route, not a table PATCH.
      changeTermAsset(client, term, table.getEntityReference(), "remove");
      awaitTestCaseDocCarriesTerm(client, testCase.getFullyQualifiedName(), term, false);
    } finally {
      cleanUp(client, database);
    }
  }

  private static void awaitColumnDocCarriesTerm(
      OpenMetadataClient client, String columnFqn, GlossaryTerm term, boolean expected) {
    awaitDocCarriesTerm(
        COLUMN_INDEX + " doc " + columnFqn,
        term,
        expected,
        () -> fetchColumnSource(client, columnFqn));
  }

  private static void awaitTestCaseDocCarriesTerm(
      OpenMetadataClient client, String testCaseFqn, GlossaryTerm term, boolean expected) {
    awaitDocCarriesTerm(
        TEST_CASE_INDEX + " doc " + testCaseFqn,
        term,
        expected,
        () -> fetchTestCaseSource(client, testCaseFqn));
  }

  private static void awaitDocCarriesTerm(
      String doc, GlossaryTerm term, boolean expected, Callable<JsonNode> fetchSource) {
    await(doc + " term presence=" + expected)
        .atMost(AWAIT_TIMEOUT)
        .pollInterval(POLL_INTERVAL)
        .ignoreExceptions()
        .untilAsserted(
            () -> {
              JsonNode source = fetchSource.call();
              assertNotNull(source, () -> doc + " not yet indexed");
              JsonNode tags = source.path("tags");
              assertEquals(
                  expected,
                  carriesTerm(tags, term),
                  () -> doc + " term presence should be " + expected + "; tags=" + tags);
            });
  }

  private static boolean carriesTerm(JsonNode tags, GlossaryTerm term) {
    return StreamSupport.stream(tags.spliterator(), false)
        .anyMatch(tag -> term.getFullyQualifiedName().equals(tag.path("tagFQN").asText()));
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
    return StreamSupport.stream(hits.spliterator(), false)
        .map(hit -> hit.path("_source"))
        .filter(source -> columnFqn.equals(source.path("fullyQualifiedName").asText("")))
        .findFirst()
        .orElse(null);
  }

  private static JsonNode fetchTestCaseSource(OpenMetadataClient client, String testCaseFqn)
      throws Exception {
    String rawJson =
        client
            .search()
            .query("fullyQualifiedName.keyword:\"" + testCaseFqn + "\"")
            .index(TEST_CASE_INDEX)
            .size(1)
            .execute();
    JsonNode hits = MAPPER.readTree(rawJson).path("hits").path("hits");
    return hits.isEmpty() ? null : hits.get(0).path("_source");
  }
}

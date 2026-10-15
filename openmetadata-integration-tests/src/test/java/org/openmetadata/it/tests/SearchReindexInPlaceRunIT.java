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
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.junit.jupiter.api.Assumptions.assumeFalse;

import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.junit.jupiter.api.parallel.Isolated;
import org.openmetadata.it.bootstrap.TestSuiteBootstrap;
import org.openmetadata.it.factories.DatabaseSchemaTestFactory;
import org.openmetadata.it.factories.DatabaseServiceTestFactory;
import org.openmetadata.it.factories.TableTestFactory;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.SearchDocuments;
import org.openmetadata.it.util.SearchIndexingAppRuns;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.schema.entity.data.DatabaseSchema;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.service.Entity;
import org.openmetadata.service.search.SearchRepository;
import org.openmetadata.service.search.SearchVersionGuard;

/**
 * One table reindex over a live index whose definition has not changed. It must rewrite the index
 * that serves, repair a document that drifted, remove a document whose row is gone, and keep a
 * document whose content was read after the run read that row.
 */
@Execution(ExecutionMode.SAME_THREAD)
@Isolated("Runs the shared search indexing application")
class SearchReindexInPlaceRunIT {
  private static final String CATALOG_DESCRIPTION = "described in the catalog";
  private static final String DRIFTED_DESCRIPTION = "drifted in search only";
  private static final String LATER_DESCRIPTION = "read after the reindex read this row";
  private static final String DESCRIPTION = "description";
  private static final long ONE_HOUR_MS = 3_600_000L;

  private static String servingIndexBefore;
  private static String driftedId;
  private static String readLaterId;
  private static String orphanId;

  @BeforeAll
  static void rewriteTheTableIndexInPlace() throws Exception {
    assumeFalse(
        TestSuiteBootstrap.isK8sEnabled(), "App trigger not compatible with K8s pipeline backend");
    final TestNamespace ns = new TestNamespace("SearchReindexInPlaceRunIT");
    final DatabaseSchema schema =
        DatabaseSchemaTestFactory.createSimple(ns, DatabaseServiceTestFactory.createPostgres(ns));
    driftedId = describedTable(ns, schema, "drifted");
    readLaterId = describedTable(ns, schema, "readlater");
    orphanId = UUID.randomUUID().toString();
    // The first run leaves the table index recorded as built from the current definition.
    reindexTables();
    servingIndexBefore = SearchDocuments.servingIndex(tableIndex());

    SearchDocuments.update(tableIndex(), driftedId, Map.of(DESCRIPTION, DRIFTED_DESCRIPTION));
    SearchDocuments.update(
        tableIndex(),
        readLaterId,
        Map.of(
            DESCRIPTION,
            LATER_DESCRIPTION,
            SearchVersionGuard.SOURCE_READ_AT,
            System.currentTimeMillis() + ONE_HOUR_MS));
    SearchDocuments.put(
        tableIndex(),
        orphanId,
        Map.of("id", orphanId, "name", ns.prefix("orphan"), "entityType", Entity.TABLE));
    reindexTables();
  }

  @Test
  void theRerunKeepsServingFromTheSameIndex() {
    assertEquals(servingIndexBefore, SearchDocuments.servingIndex(tableIndex()));
  }

  @Test
  void theRerunRepairsADocumentThatDrifted() throws Exception {
    assertEquals(CATALOG_DESCRIPTION, description(driftedId));
  }

  @Test
  void theRerunRemovesADocumentWhoseRowIsGone() throws Exception {
    assertTrue(SearchDocuments.find(tableIndex(), orphanId).isEmpty());
  }

  @Test
  void theRerunKeepsADocumentReadAfterItReadTheRow() throws Exception {
    assertEquals(LATER_DESCRIPTION, description(readLaterId));
  }

  private static void reindexTables() {
    SearchIndexingAppRuns.runToSuccess(
        SdkClients.adminClient().getHttpClient(),
        Map.of("entities", List.of(Entity.TABLE), "batchSize", 100));
  }

  private static String describedTable(
      final TestNamespace ns, final DatabaseSchema schema, final String name) {
    final Table table = TableTestFactory.createWithName(ns, schema.getFullyQualifiedName(), name);
    return SdkClients.adminClient()
        .tables()
        .update(table.getId().toString(), table.withDescription(CATALOG_DESCRIPTION))
        .getId()
        .toString();
  }

  private static String description(final String id) throws Exception {
    return SearchDocuments.find(tableIndex(), id).orElseThrow().path(DESCRIPTION).asText();
  }

  private static String tableIndex() {
    final SearchRepository searchRepository = Entity.getSearchRepository();
    return searchRepository
        .getIndexMapping(Entity.TABLE)
        .getIndexName(searchRepository.getClusterAlias());
  }
}

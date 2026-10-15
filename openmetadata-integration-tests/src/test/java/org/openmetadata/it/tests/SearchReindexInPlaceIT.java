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
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.junit.jupiter.api.Assumptions.assumeFalse;

import java.time.Duration;
import java.util.List;
import java.util.Map;
import org.awaitility.Awaitility;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.junit.jupiter.api.parallel.Isolated;
import org.openmetadata.it.bootstrap.TestSuiteBootstrap;
import org.openmetadata.it.factories.DatabaseSchemaTestFactory;
import org.openmetadata.it.factories.DatabaseServiceTestFactory;
import org.openmetadata.it.factories.PipelineServiceTestFactory;
import org.openmetadata.it.factories.TableTestFactory;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.SearchDocuments;
import org.openmetadata.it.util.SearchIndexingAppRuns;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.data.CreatePipeline;
import org.openmetadata.schema.entity.data.DatabaseSchema;
import org.openmetadata.schema.entity.data.Pipeline;
import org.openmetadata.schema.entity.data.PipelineStatus;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.services.PipelineService;
import org.openmetadata.schema.type.StatusType;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.schema.utils.VersionUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.search.SearchDocumentUpdate;
import org.openmetadata.service.search.SearchRepository;
import org.openmetadata.service.search.SearchVersionGuard;
import org.openmetadata.service.search.indexes.PipelineExecutionIndex;

/** Search reindexing must never lose or regress documents that are already correct. */
@Execution(ExecutionMode.SAME_THREAD)
@Isolated("Runs the shared search indexing application")
@ExtendWith(TestNamespaceExtension.class)
class SearchReindexInPlaceIT {
  private static final Duration SEARCH_WAIT = Duration.ofSeconds(60);
  private static final String PIPELINE_STATUS_INDEX = "pipeline_status_search_index";

  @BeforeAll
  static void setup() {
    SdkClients.adminClient();
  }

  @Test
  void aReindexKeepsPipelineExecutionHistory(final TestNamespace ns) throws Exception {
    assumeFalse(
        TestSuiteBootstrap.isK8sEnabled(), "App trigger not compatible with K8s pipeline backend");
    final Pipeline pipeline = createPipeline(ns, "history");
    final PipelineStatus run =
        new PipelineStatus()
            .withExecutionId(ns.prefix("run"))
            .withExecutionStatus(StatusType.Successful)
            .withTimestamp(System.currentTimeMillis());
    SdkClients.adminClient().pipelines().addPipelineStatus(pipeline.getFullyQualifiedName(), run);
    final String index = searchRepository().getIndexOrAliasName(PIPELINE_STATUS_INDEX);
    final String documentId = PipelineExecutionIndex.getDocumentId(pipeline, run);
    Awaitility.await("Pipeline execution indexed")
        .atMost(SEARCH_WAIT)
        .ignoreExceptions()
        .until(() -> SearchDocuments.find(index, documentId).isPresent());

    SearchIndexingAppRuns.runToSuccess(
        SdkClients.adminClient().getHttpClient(),
        Map.of("entities", List.of("pipelineStatus"), "batchSize", 100));

    // Execution documents have no reindex source: a rebuild that replaces their index erases them.
    assertTrue(
        SearchDocuments.find(index, documentId).isPresent(),
        "Reindexing must keep pipeline execution history it cannot rebuild");
  }

  @Test
  void aReindexKeepsThePipelineRunStatus(final TestNamespace ns) throws Exception {
    assumeFalse(
        TestSuiteBootstrap.isK8sEnabled(), "App trigger not compatible with K8s pipeline backend");
    final Pipeline pipeline = createPipeline(ns, "status");
    final PipelineStatus run =
        new PipelineStatus()
            .withExecutionId(ns.prefix("run"))
            .withExecutionStatus(StatusType.Failed)
            .withTimestamp(System.currentTimeMillis());
    SdkClients.adminClient().pipelines().addPipelineStatus(pipeline.getFullyQualifiedName(), run);
    final String index =
        searchRepository()
            .getIndexMapping(Entity.PIPELINE)
            .getIndexName(searchRepository().getClusterAlias());
    final String id = pipeline.getId().toString();
    Awaitility.await("Pipeline status indexed")
        .atMost(SEARCH_WAIT)
        .ignoreExceptions()
        .until(() -> isFailedRun(index, id));

    SearchIndexingAppRuns.runToSuccess(
        SdkClients.adminClient().getHttpClient(),
        Map.of("entities", List.of(Entity.PIPELINE), "batchSize", 100));

    assertTrue(isFailedRun(index, id), "Reindexing must keep the pipeline's latest run status");
  }

  @Test
  void aChangedIndexDefinitionIsRebuiltIntoANewIndex(final TestNamespace ns) {
    assumeFalse(
        TestSuiteBootstrap.isK8sEnabled(), "App trigger not compatible with K8s pipeline backend");
    createTable(ns, "redefined");
    final String servingBefore = SearchDocuments.servingIndex(tableIndex());
    recordTableIndexAsBuiltFrom("an older definition");

    SearchIndexingAppRuns.runToSuccess(
        SdkClients.adminClient().getHttpClient(),
        Map.of("entities", List.of(Entity.TABLE), "batchSize", 100));

    assertNotEquals(
        servingBefore,
        SearchDocuments.servingIndex(tableIndex()),
        "A changed index definition cannot be applied in place");
  }

  private static void recordTableIndexAsBuiltFrom(final String mappingHash) {
    Entity.getCollectionDAO()
        .indexMappingVersionDAO()
        .upsertIndexMappingVersion(
            Entity.TABLE,
            mappingHash,
            "{}",
            VersionUtils.getOpenMetadataServerVersion("/catalog/VERSION").getVersion(),
            System.currentTimeMillis(),
            SearchReindexInPlaceIT.class.getSimpleName());
  }

  private static boolean isFailedRun(final String index, final String id) throws Exception {
    return "Failed"
        .equals(
            SearchDocuments.find(index, id)
                .orElseThrow()
                .path("pipelineStatus")
                .path("executionStatus")
                .asText());
  }

  @Test
  void aWriteReadBeforeANewerOneCannotReplaceIt(final TestNamespace ns) throws Exception {
    final Table created = createTable(ns, "versioned");
    final String id = created.getId().toString();
    final Table older =
        SdkClients.adminClient().tables().update(id, created.withDescription("older"));
    // Prepared now, as a retry or a slow writer would have prepared it, and delivered last.
    final SearchDocumentUpdate late = preparedLiveWrite(older);
    SdkClients.adminClient()
        .tables()
        .update(id, JsonUtils.deepCopy(older, Table.class).withDescription("newer"));

    deliver(late, id);

    assertEquals(
        "newer",
        SearchDocuments.find(tableIndex(), id).orElseThrow().path("description").asText(),
        "A write read before a newer one must not replace it");
  }

  @Test
  void aWriteReadBeforeASoftDeleteCannotUndoIt(final TestNamespace ns) throws Exception {
    final Table live = createTable(ns, "softdeleted");
    final String id = live.getId().toString();
    final SearchDocumentUpdate late = preparedLiveWrite(live);
    SdkClients.adminClient().tables().delete(id);
    Awaitility.await("Soft delete indexed")
        .atMost(SEARCH_WAIT)
        .ignoreExceptions()
        .until(
            () -> SearchDocuments.find(tableIndex(), id).orElseThrow().path("deleted").asBoolean());

    deliver(late, id);

    assertTrue(
        SearchDocuments.find(tableIndex(), id).orElseThrow().path("deleted").asBoolean(),
        "A write read before the soft delete must not restore the document");
  }

  private static SearchDocumentUpdate preparedLiveWrite(final Table table) {
    return SearchVersionGuard.apply(
        searchRepository().getDocumentBuilder().prepareUpdate(table, null), table);
  }

  private static void deliver(final SearchDocumentUpdate update, final String id) throws Exception {
    searchRepository()
        .getSearchClient()
        .updateEntity(
            tableIndex(), id, update.parametersForIndexing(), update.script(), Entity.TABLE);
  }

  private static String tableIndex() {
    return searchRepository()
        .getIndexMapping(Entity.TABLE)
        .getIndexName(searchRepository().getClusterAlias());
  }

  private static Pipeline createPipeline(final TestNamespace ns, final String name) {
    final PipelineService service = PipelineServiceTestFactory.createAirflow(ns);
    return SdkClients.adminClient()
        .pipelines()
        .create(
            new CreatePipeline()
                .withName(ns.prefix(name))
                .withService(service.getFullyQualifiedName()));
  }

  private static Table createTable(final TestNamespace ns, final String name) {
    final DatabaseSchema schema =
        DatabaseSchemaTestFactory.createSimple(ns, DatabaseServiceTestFactory.createPostgres(ns));
    return TableTestFactory.createWithName(ns, schema.getFullyQualifiedName(), name);
  }

  private static SearchRepository searchRepository() {
    return Entity.getSearchRepository();
  }
}

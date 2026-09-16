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
package org.openmetadata.service.workflows.searchIndex;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.when;

import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.stream.Stream;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;
import org.mockito.MockedStatic;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.jdbi3.EntityRepository;
import org.openmetadata.service.search.SearchClient;
import org.openmetadata.service.search.SearchIndexFactory;
import org.openmetadata.service.search.SearchRepository;
import org.openmetadata.service.util.EntityUtil;

/**
 * Unit tests for {@link ReindexingUtil#getSearchIndexFields(String)}. The interesting
 * behaviour is the intersection with {@code EntityRepository.allowedFields}: many entity types
 * have JSON schemas that omit one or more {@code COMMON_REINDEX_FIELDS} (e.g. {@code
 * storageService} has no {@code reviewers}). Without the filter, downstream {@link
 * org.openmetadata.service.workflows.searchIndex.PaginatedEntitiesSource} throws {@code
 * IllegalArgumentException} on the first batch of those entities.
 */
class ReindexingUtilTest {

  private SearchRepository searchRepository;
  private SearchIndexFactory searchIndexFactory;
  private SearchRepository previousSearchRepository;

  @BeforeEach
  void setUp() {
    previousSearchRepository = Entity.getSearchRepository();
    searchRepository = mock(SearchRepository.class);
    searchIndexFactory = mock(SearchIndexFactory.class);
    when(searchRepository.getSearchClient()).thenReturn(mock(SearchClient.class));
    when(searchRepository.getSearchIndexFactory()).thenReturn(searchIndexFactory);
    Entity.setSearchRepository(searchRepository);
  }

  @AfterEach
  void tearDown() {
    Entity.setSearchRepository(previousSearchRepository);
  }

  @Test
  void timeSeriesEntitiesGetEmptyFieldList() {
    List<String> fields = ReindexingUtil.getSearchIndexFields(Entity.ENTITY_REPORT_DATA);
    assertTrue(fields.isEmpty(), "Time-series entities must skip the entity-fields machinery");
  }

  @Test
  void missingSearchRepositoryFallsBackToWildcard() {
    Entity.setSearchRepository(null);
    List<String> fields = ReindexingUtil.getSearchIndexFields("doesNotMatter");
    assertEquals(List.of("*"), fields);
  }

  @Test
  void filtersOutFieldsNotInAllowedFields() {
    String entityType = "fakeFiltered";
    Set<String> required = Set.of("owners", "domains", "reviewers", "extension", "tags");
    Set<String> allowed = Set.of("owners", "domains", "tags", "id", "name");
    when(searchIndexFactory.getReindexFieldsFor(entityType)).thenReturn(required);

    List<String> fields = withAllowedFields(entityType, allowed);

    assertTrue(fields.contains("owners"));
    assertTrue(fields.contains("domains"));
    assertTrue(fields.contains("tags"));
    assertFalse(
        fields.contains("reviewers"), "Field absent from allowedFields must be dropped: " + fields);
    assertFalse(
        fields.contains("extension"), "Field absent from allowedFields must be dropped: " + fields);
  }

  @Test
  void keepsAllRequiredFieldsWhenAllAreAllowed() {
    String entityType = "fakeAllowed";
    Set<String> required = Set.of("owners", "domains", "tags");
    Set<String> allowed = Set.of("owners", "domains", "tags", "id", "name", "description");
    when(searchIndexFactory.getReindexFieldsFor(entityType)).thenReturn(required);

    List<String> fields = withAllowedFields(entityType, allowed);

    assertEquals(new HashSet<>(required), new HashSet<>(fields));
  }

  @Test
  void unregisteredRepositoryReturnsRequiredUnfiltered() {
    String entityType = "unregisteredEntityType";
    Set<String> required = Set.of("owners", "domains", "reviewers");
    when(searchIndexFactory.getReindexFieldsFor(entityType)).thenReturn(required);

    List<String> fields;
    try (MockedStatic<Entity> entityMock =
        mockStatic(Entity.class, org.mockito.Mockito.CALLS_REAL_METHODS)) {
      entityMock
          .when(() -> Entity.getEntityRepository(eq(entityType)))
          .thenThrow(EntityNotFoundException.byMessage("not registered: " + entityType));
      fields = ReindexingUtil.getSearchIndexFields(entityType);
    }

    // No EntityRepository registered → degrades to the unfiltered required set so reindex
    // still attempts the work; the JSON-schema-driven validation will surface any drift at the
    // PaginatedEntitiesSource boundary, but the helper itself stays defensive.
    assertEquals(new HashSet<>(required), new HashSet<>(fields));
  }

  /**
   * For every entity type that has both a real {@link com.fasterxml.jackson.annotation.JsonPropertyOrder}
   * (the source-of-truth for {@code EntityRepository.allowedFields}) and a real
   * {@link org.openmetadata.service.search.indexes.SearchIndex} class, prove the post-filter
   * field list is a subset of {@code allowedFields}. This is the contract that prevents
   * {@code Entity.getFields → EntityUtil.Fields} from throwing {@code IllegalArgumentException}
   * downstream. Uses the real {@link SearchIndexFactory} (not the mock) so any new entity type
   * exercises the actual probe path.
   */
  @ParameterizedTest(name = "{0}")
  @MethodSource("entityTypeAndClass")
  void filteredFieldsAreSubsetOfEntityAllowedFields(String entityType, Class<?> entityClass) {
    // Use the real SearchIndexFactory for this test — we want the actual production probe
    // output to flow through, not a stubbed one.
    when(searchRepository.getSearchIndexFactory()).thenReturn(new SearchIndexFactory());
    Set<String> declared = Entity.getEntityFields(entityClass);

    EntityRepository<?> repo = mockRepoWithAllowedFields(declared);

    List<String> filtered;
    try (MockedStatic<Entity> entityMock =
        mockStatic(Entity.class, org.mockito.Mockito.CALLS_REAL_METHODS)) {
      entityMock.when(() -> Entity.getEntityRepository(eq(entityType))).thenReturn(repo);
      filtered = ReindexingUtil.getSearchIndexFields(entityType);
    }

    Set<String> leak = new HashSet<>(filtered);
    leak.removeAll(declared);
    assertTrue(
        leak.isEmpty(),
        () ->
            "ReindexingUtil.getSearchIndexFields("
                + entityType
                + ") leaked fields not in "
                + entityClass.getSimpleName()
                + " @JsonPropertyOrder: "
                + leak);
  }

  /**
   * Hand-curated list of {@code (entityType, entityClass)} pairs covering the entity types
   * verified to be missing one or more {@code COMMON_REINDEX_FIELDS} as of this commit, plus a
   * few that are complete (Glossary, GlossaryTerm) as a control. New entity types added to the
   * SearchIndex factory should be appended here so the filter is exercised across all real
   * schemas.
   */
  private static Stream<Arguments> entityTypeAndClass() {
    return Stream.of(
        Arguments.of(Entity.CONTAINER, org.openmetadata.schema.entity.data.Container.class),
        Arguments.of(
            Entity.STORAGE_SERVICE, org.openmetadata.schema.entity.services.StorageService.class),
        Arguments.of(
            Entity.DATABASE_SERVICE, org.openmetadata.schema.entity.services.DatabaseService.class),
        Arguments.of(
            Entity.MESSAGING_SERVICE,
            org.openmetadata.schema.entity.services.MessagingService.class),
        Arguments.of(
            Entity.PIPELINE_SERVICE, org.openmetadata.schema.entity.services.PipelineService.class),
        Arguments.of(
            Entity.DASHBOARD_SERVICE,
            org.openmetadata.schema.entity.services.DashboardService.class),
        Arguments.of(
            Entity.SEARCH_SERVICE, org.openmetadata.schema.entity.services.SearchService.class),
        Arguments.of(
            Entity.METADATA_SERVICE, org.openmetadata.schema.entity.services.MetadataService.class),
        Arguments.of(
            Entity.MLMODEL_SERVICE, org.openmetadata.schema.entity.services.MlModelService.class),
        Arguments.of(Entity.API_SERVICE, org.openmetadata.schema.entity.services.ApiService.class),
        Arguments.of(
            Entity.INGESTION_PIPELINE,
            org.openmetadata.schema.entity.services.ingestionPipelines.IngestionPipeline.class),
        Arguments.of(Entity.USER, org.openmetadata.schema.entity.teams.User.class),
        Arguments.of(Entity.TEAM, org.openmetadata.schema.entity.teams.Team.class),
        Arguments.of(Entity.TAG, org.openmetadata.schema.entity.classification.Tag.class),
        Arguments.of(
            Entity.CLASSIFICATION,
            org.openmetadata.schema.entity.classification.Classification.class),
        Arguments.of(Entity.GLOSSARY, org.openmetadata.schema.entity.data.Glossary.class),
        Arguments.of(Entity.GLOSSARY_TERM, org.openmetadata.schema.entity.data.GlossaryTerm.class),
        Arguments.of(Entity.TABLE, org.openmetadata.schema.entity.data.Table.class),
        Arguments.of(Entity.DATABASE, org.openmetadata.schema.entity.data.Database.class),
        Arguments.of(
            Entity.DATABASE_SCHEMA, org.openmetadata.schema.entity.data.DatabaseSchema.class),
        Arguments.of(Entity.TOPIC, org.openmetadata.schema.entity.data.Topic.class),
        Arguments.of(Entity.DASHBOARD, org.openmetadata.schema.entity.data.Dashboard.class),
        Arguments.of(Entity.PIPELINE, org.openmetadata.schema.entity.data.Pipeline.class),
        Arguments.of(Entity.MLMODEL, org.openmetadata.schema.entity.data.MlModel.class),
        Arguments.of(Entity.CHART, org.openmetadata.schema.entity.data.Chart.class),
        Arguments.of(
            Entity.STORED_PROCEDURE, org.openmetadata.schema.entity.data.StoredProcedure.class),
        Arguments.of(Entity.SEARCH_INDEX, org.openmetadata.schema.entity.data.SearchIndex.class),
        Arguments.of(Entity.QUERY, org.openmetadata.schema.entity.data.Query.class),
        Arguments.of(Entity.METRIC, org.openmetadata.schema.entity.data.Metric.class),
        Arguments.of(Entity.DOMAIN, org.openmetadata.schema.entity.domains.Domain.class),
        Arguments.of(Entity.DATA_PRODUCT, org.openmetadata.schema.entity.domains.DataProduct.class),
        // Mid-tree assets that share the DataAsset shape — same risk surface as the entries
        // above, included so the parametrized contract spans every category buildIndex covers.
        Arguments.of(
            Entity.API_COLLECTION, org.openmetadata.schema.entity.data.APICollection.class),
        Arguments.of(Entity.API_ENDPOINT, org.openmetadata.schema.entity.data.APIEndpoint.class),
        Arguments.of(
            Entity.DASHBOARD_DATA_MODEL,
            org.openmetadata.schema.entity.data.DashboardDataModel.class),
        Arguments.of(Entity.DIRECTORY, org.openmetadata.schema.entity.data.Directory.class),
        Arguments.of(Entity.FILE, org.openmetadata.schema.entity.data.File.class),
        Arguments.of(Entity.SPREADSHEET, org.openmetadata.schema.entity.data.Spreadsheet.class),
        Arguments.of(Entity.WORKSHEET, org.openmetadata.schema.entity.data.Worksheet.class),
        Arguments.of(Entity.TEST_CASE, org.openmetadata.schema.tests.TestCase.class),
        Arguments.of(Entity.TEST_SUITE, org.openmetadata.schema.tests.TestSuite.class),
        // AI/LLM/MCP types — newer additions that need the same parity guarantee.
        Arguments.of(Entity.AI_APPLICATION, org.openmetadata.schema.entity.ai.AIApplication.class),
        Arguments.of(
            Entity.AI_GOVERNANCE_POLICY,
            org.openmetadata.schema.entity.ai.AIGovernancePolicy.class),
        Arguments.of(
            Entity.AI_GOVERNANCE_FRAMEWORK,
            org.openmetadata.schema.entity.ai.AIGovernanceFramework.class),
        Arguments.of(
            Entity.AI_FRAMEWORK_CONTROL,
            org.openmetadata.schema.entity.ai.AIFrameworkControl.class),
        Arguments.of(Entity.AUDIT_REPORT, org.openmetadata.schema.entity.ai.AuditReport.class),
        Arguments.of(Entity.LLM_MODEL, org.openmetadata.schema.entity.ai.LLMModel.class),
        Arguments.of(
            Entity.PROMPT_TEMPLATE, org.openmetadata.schema.entity.ai.PromptTemplate.class),
        Arguments.of(Entity.MCP_SERVER, org.openmetadata.schema.entity.ai.McpServer.class),
        Arguments.of(Entity.MCP_EXECUTION, org.openmetadata.schema.entity.ai.McpExecution.class),
        Arguments.of(Entity.LLM_SERVICE, org.openmetadata.schema.entity.services.LLMService.class),
        Arguments.of(Entity.MCP_SERVICE, org.openmetadata.schema.entity.services.McpService.class),
        Arguments.of(
            Entity.SECURITY_SERVICE, org.openmetadata.schema.entity.services.SecurityService.class),
        Arguments.of(
            Entity.DRIVE_SERVICE, org.openmetadata.schema.entity.services.DriveService.class));
  }

  private List<String> withAllowedFields(String entityType, Set<String> allowed) {
    EntityRepository<?> repo = mockRepoWithAllowedFields(allowed);
    try (MockedStatic<Entity> entityMock =
        mockStatic(Entity.class, org.mockito.Mockito.CALLS_REAL_METHODS)) {
      entityMock.when(() -> Entity.getEntityRepository(eq(entityType))).thenReturn(repo);
      return ReindexingUtil.getSearchIndexFields(entityType);
    }
  }

  /**
   * Build a mock EntityRepository whose {@code getOnlySupportedFields(...)} returns a real
   * {@link EntityUtil.Fields} built against {@code allowed} with extras silently dropped — the
   * same contract as the production method (see {@code EntityRepository#getOnlySupportedFields}).
   * {@code ReindexingUtil.getSearchIndexFields} reaches into the repository through {@code
   * Entity.getOnlySupportedFields(...)}, so this is the method that has to be stubbed.
   */
  private static EntityRepository<?> mockRepoWithAllowedFields(Set<String> allowed) {
    EntityRepository<?> repo = mock(EntityRepository.class);
    Set<String> allowedCopy = new HashSet<>(allowed);
    when(repo.getAllowedFieldsCopy()).thenReturn(allowedCopy);
    when(repo.getOnlySupportedFields(anyString()))
        .thenAnswer(inv -> new EntityUtil.Fields(allowedCopy, inv.getArgument(0), true));
    return repo;
  }
}

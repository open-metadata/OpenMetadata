package org.openmetadata.service.search;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertInstanceOf;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.doCallRealMethod;
import static org.mockito.Mockito.doNothing;
import static org.mockito.Mockito.doReturn;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.spy;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.openmetadata.schema.type.Include.NON_DELETED;

import java.net.URI;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.MockedStatic;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.service.configuration.elasticsearch.ElasticSearchConfiguration;
import org.openmetadata.schema.tests.TestSuite;
import org.openmetadata.schema.type.ChangeDescription;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.EntityStatus;
import org.openmetadata.schema.type.FieldChange;
import org.openmetadata.service.Entity;
import org.openmetadata.service.apps.bundles.searchIndex.BulkSink;
import org.openmetadata.service.apps.bundles.searchIndex.ElasticSearchBulkSink;
import org.openmetadata.service.apps.bundles.searchIndex.OpenSearchBulkSink;
import org.openmetadata.service.jdbi3.EntityRepository;
import org.openmetadata.service.jdbi3.TestCaseRepository;
import org.openmetadata.service.jdbi3.TestSuiteRepository;
import org.openmetadata.service.util.EntityUtil.Fields;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class SearchRepositoryTest {

  @Mock private SearchRepository searchRepository;

  @Mock
  private org.openmetadata.service.search.elasticsearch.ElasticSearchClient elasticSearchClient;

  @Mock private org.openmetadata.service.search.opensearch.OpenSearchClient openSearchClient;

  @BeforeEach
  void setUp() {
    // Create a real instance for testing the new methods
    searchRepository = mock(SearchRepository.class);

    // Mock the new Java API clients
    es.co.elastic.clients.elasticsearch.ElasticsearchClient mockEsNewClient =
        mock(es.co.elastic.clients.elasticsearch.ElasticsearchClient.class);
    es.co.elastic.clients.transport.ElasticsearchTransport mockEsTransport =
        mock(es.co.elastic.clients.transport.ElasticsearchTransport.class);
    lenient().when(mockEsNewClient._transport()).thenReturn(mockEsTransport);
    lenient().when(elasticSearchClient.getNewClient()).thenReturn(mockEsNewClient);
    lenient().when(elasticSearchClient.isClientAvailable()).thenReturn(true);

    os.org.opensearch.client.opensearch.OpenSearchClient mockOsNewClient =
        mock(os.org.opensearch.client.opensearch.OpenSearchClient.class);
    os.org.opensearch.client.transport.OpenSearchTransport mockOsTransport =
        mock(os.org.opensearch.client.transport.OpenSearchTransport.class);
    lenient().when(mockOsNewClient._transport()).thenReturn(mockOsTransport);
    lenient().when(openSearchClient.getNewClient()).thenReturn(mockOsNewClient);
    lenient().when(openSearchClient.isClientAvailable()).thenReturn(true);

    // Enable calling real methods for the methods we want to test
    lenient().when(searchRepository.createBulkSink(10, 2, 1000000L)).thenCallRealMethod();
    lenient().when(searchRepository.createBulkSink(1, 1, 1L)).thenCallRealMethod();
    lenient().when(searchRepository.createBulkSink(1000, 100, 100000000L)).thenCallRealMethod();
    lenient().when(searchRepository.createBulkSink(50, 5, 5000000L)).thenCallRealMethod();
    lenient().when(searchRepository.createBulkSink(100, 10, 10000000L)).thenCallRealMethod();
    lenient().when(searchRepository.isVectorEmbeddingEnabled()).thenCallRealMethod();
  }

  @Test
  void testCreateBulkSinkForElasticSearch() {
    // Mock SearchRepository to return ElasticSearch type
    lenient()
        .when(searchRepository.getSearchType())
        .thenReturn(ElasticSearchConfiguration.SearchType.ELASTICSEARCH);
    lenient().when(searchRepository.getSearchClient()).thenReturn(elasticSearchClient);

    BulkSink bulkSink = searchRepository.createBulkSink(10, 2, 1000000L);

    assertNotNull(bulkSink);
    assertInstanceOf(ElasticSearchBulkSink.class, bulkSink);
  }

  @Test
  void testCreateBulkSinkForOpenSearch() {
    // Mock SearchRepository to return OpenSearch type
    lenient()
        .when(searchRepository.getSearchType())
        .thenReturn(ElasticSearchConfiguration.SearchType.OPENSEARCH);
    lenient().when(searchRepository.getSearchClient()).thenReturn(openSearchClient);

    BulkSink bulkSink = searchRepository.createBulkSink(10, 2, 1000000L);

    assertNotNull(bulkSink);
    assertInstanceOf(OpenSearchBulkSink.class, bulkSink);
  }

  @Test
  void testCreateBulkSinkWithDifferentParameters() {
    // Test with different parameter values
    lenient()
        .when(searchRepository.getSearchType())
        .thenReturn(ElasticSearchConfiguration.SearchType.ELASTICSEARCH);
    lenient().when(searchRepository.getSearchClient()).thenReturn(elasticSearchClient);

    BulkSink bulkSink1 = searchRepository.createBulkSink(50, 5, 5000000L);
    assertNotNull(bulkSink1);
    assertInstanceOf(ElasticSearchBulkSink.class, bulkSink1);

    BulkSink bulkSink2 = searchRepository.createBulkSink(100, 10, 10000000L);
    assertNotNull(bulkSink2);
    assertInstanceOf(ElasticSearchBulkSink.class, bulkSink2);
  }

  @Test
  void testIsVectorEmbeddingEnabled() {
    // Test default implementation returns false
    boolean result = searchRepository.isVectorEmbeddingEnabled();
    assertFalse(result);
  }

  @Test
  void updateEntitiesByReference_skipsConcurrentlyDeletedRefAndIndexesSurvivors() {
    searchRepository.searchIndexFactory = mock(SearchIndexFactory.class);
    lenient()
        .when(searchRepository.searchIndexFactory.getReindexFieldsFor(anyString()))
        .thenReturn(Set.of("name"));
    doCallRealMethod().when(searchRepository).updateEntitiesByReference(anyList());
    doNothing().when(searchRepository).updateEntitiesIndex(anyList());

    UUID survivorId = UUID.randomUUID();
    UUID deletedId = UUID.randomUUID();
    EntityReference survivorRef = new EntityReference().withId(survivorId).withType(Entity.TABLE);
    EntityReference deletedRef = new EntityReference().withId(deletedId).withType(Entity.TABLE);

    EntityRepository<?> tableRepository = mock(EntityRepository.class);
    Fields fields = mock(Fields.class);
    doReturn(fields).when(tableRepository).getOnlySupportedFields(anyString());
    EntityInterface<?> survivor = mock(EntityInterface.class);
    doReturn(List.of(survivor))
        .when(tableRepository)
        .get(isNull(), eq(List.of(deletedId, survivorId)), eq(fields), eq(NON_DELETED));

    try (MockedStatic<Entity> entity = mockStatic(Entity.class)) {
      entity.when(() -> Entity.getEntityRepository(Entity.TABLE)).thenReturn(tableRepository);

      searchRepository.updateEntitiesByReference(List.of(deletedRef, survivorRef));

      verify(tableRepository)
          .get(isNull(), eq(List.of(deletedId, survivorId)), eq(fields), eq(NON_DELETED));
      @SuppressWarnings("unchecked")
      ArgumentCaptor<List<EntityInterface<?>>> indexed = ArgumentCaptor.forClass(List.class);
      verify(searchRepository).updateEntitiesIndex(indexed.capture());
      assertEquals(
          List.of(survivor),
          indexed.getValue(),
          "only the survivor is indexed; the concurrently-deleted ref is skipped, not fatal");
    }
  }

  @Test
  void updateEntitiesByReference_isNoOpForNullOrEmptyInput() {
    doCallRealMethod().when(searchRepository).updateEntitiesByReference(any());

    searchRepository.updateEntitiesByReference(null);
    searchRepository.updateEntitiesByReference(List.of());

    verify(searchRepository, never()).updateEntitiesIndex(any());
  }

  @Test
  void updateEntitiesByReference_dedupesRepeatedRefsAndResolvesEachOnce() {
    searchRepository.searchIndexFactory = mock(SearchIndexFactory.class);
    lenient()
        .when(searchRepository.searchIndexFactory.getReindexFieldsFor(anyString()))
        .thenReturn(Set.of("name"));
    doCallRealMethod().when(searchRepository).updateEntitiesByReference(anyList());
    doNothing().when(searchRepository).updateEntitiesIndex(anyList());

    UUID id = UUID.randomUUID();
    EntityReference ref = new EntityReference().withId(id).withType(Entity.TABLE);

    EntityRepository<?> tableRepository = mock(EntityRepository.class);
    Fields fields = mock(Fields.class);
    doReturn(fields).when(tableRepository).getOnlySupportedFields(anyString());
    EntityInterface<?> entity = mock(EntityInterface.class);
    doReturn(List.of(entity))
        .when(tableRepository)
        .get(isNull(), eq(List.of(id)), eq(fields), eq(NON_DELETED));

    try (MockedStatic<Entity> entityStatic = mockStatic(Entity.class)) {
      entityStatic.when(() -> Entity.getEntityRepository(Entity.TABLE)).thenReturn(tableRepository);

      searchRepository.updateEntitiesByReference(List.of(ref, ref, ref));

      verify(tableRepository, times(1)).get(isNull(), eq(List.of(id)), eq(fields), eq(NON_DELETED));
      @SuppressWarnings("unchecked")
      ArgumentCaptor<List<EntityInterface<?>>> indexed = ArgumentCaptor.forClass(List.class);
      verify(searchRepository).updateEntitiesIndex(indexed.capture());
      assertEquals(
          List.of(entity),
          indexed.getValue(),
          "a repeated reference is resolved and indexed once, not per duplicate");
    }
  }

  @Test
  void updateEntitiesByReference_loadsAndIndexesBoundedBatches() {
    searchRepository.searchIndexFactory = mock(SearchIndexFactory.class);
    lenient()
        .when(searchRepository.searchIndexFactory.getReindexFieldsFor(anyString()))
        .thenReturn(Set.of("name"));
    doCallRealMethod().when(searchRepository).updateEntitiesByReference(anyList());
    doNothing().when(searchRepository).updateEntitiesIndex(anyList());

    List<EntityReference> refs =
        java.util.stream.IntStream.range(0, 101)
            .mapToObj(
                ignored -> new EntityReference().withId(UUID.randomUUID()).withType(Entity.TABLE))
            .toList();
    EntityRepository<?> tableRepository = mock(EntityRepository.class);
    Fields fields = mock(Fields.class);
    doReturn(fields).when(tableRepository).getOnlySupportedFields(anyString());
    doAnswer(
            invocation -> {
              List<UUID> ids = invocation.getArgument(1);
              return ids.stream().map(ignored -> mock(EntityInterface.class)).toList();
            })
        .when(tableRepository)
        .get(isNull(), anyList(), eq(fields), eq(NON_DELETED));

    try (MockedStatic<Entity> entityStatic = mockStatic(Entity.class)) {
      entityStatic.when(() -> Entity.getEntityRepository(Entity.TABLE)).thenReturn(tableRepository);

      searchRepository.updateEntitiesByReference(refs);

      @SuppressWarnings("unchecked")
      ArgumentCaptor<List<UUID>> batches = ArgumentCaptor.forClass(List.class);
      verify(tableRepository, times(2))
          .get(isNull(), batches.capture(), eq(fields), eq(NON_DELETED));
      assertEquals(List.of(100, 1), batches.getAllValues().stream().map(List::size).toList());
      verify(searchRepository, times(2)).updateEntitiesIndex(anyList());
    }
  }

  @Test
  void testCreateBulkSinkParameterValidation() {
    lenient()
        .when(searchRepository.getSearchType())
        .thenReturn(ElasticSearchConfiguration.SearchType.ELASTICSEARCH);
    lenient().when(searchRepository.getSearchClient()).thenReturn(elasticSearchClient);

    // Test with minimum values
    BulkSink bulkSink1 = searchRepository.createBulkSink(1, 1, 1L);
    assertNotNull(bulkSink1);

    // Test with large values
    BulkSink bulkSink2 = searchRepository.createBulkSink(1000, 100, 100000000L);
    assertNotNull(bulkSink2);
  }

  @Test
  void buildBulkScriptedPartialUpdateFencesCompleteTestSuiteRelationshipSnapshots() {
    MockEntityWithType testCase = new MockEntityWithType(Entity.TEST_CASE, "testCase");
    TestSuite addedTestSuite =
        new TestSuite()
            .withId(UUID.randomUUID())
            .withName("addedLogicalSuite")
            .withFullyQualifiedName("addedLogicalSuite");
    testCase.setTestSuites(List.of(addedTestSuite));
    testCase.setChangeDescription(
        new ChangeDescription()
            .withPreviousVersion(testCase.getVersion())
            .withFieldsUpdated(
                List.of(
                    new FieldChange()
                        .withName(Entity.FIELD_TEST_SUITES)
                        .withNewValue(List.of(addedTestSuite)))));
    doCallRealMethod().when(searchRepository).buildBulkScriptedPartialUpdate(any(), any());

    SearchRepository.ScriptedPartialUpdate partialUpdate =
        searchRepository.buildBulkScriptedPartialUpdate(testCase, 42L);

    assertNotNull(partialUpdate);
    assertTrue(
        partialUpdate
            .script()
            .contains("params.testSuitesRevision >= ctx._source.testSuitesRevision"));
    assertTrue(partialUpdate.script().contains("ctx._source.testSuites = params.testSuites"));
    assertEquals(42L, partialUpdate.parameters().get("testSuitesRevision"));
    List<?> replacement = (List<?>) partialUpdate.parameters().get(Entity.FIELD_TEST_SUITES);
    assertEquals(
        addedTestSuite.getId().toString(),
        ((Map<?, ?>) replacement.getFirst()).get("id").toString());
    assertNull(searchRepository.buildBulkScriptedPartialUpdate(testCase, null));

    testCase.setChangeDescription(
        new ChangeDescription()
            .withPreviousVersion(testCase.getVersion())
            .withFieldsAdded(
                List.of(
                    new FieldChange()
                        .withName(Entity.FIELD_TEST_SUITES)
                        .withNewValue(testCase.getTestSuites()))));
    assertNull(searchRepository.buildBulkScriptedPartialUpdate(testCase, 43L));

    testCase.setChangeDescription(null);
    assertNotNull(searchRepository.buildBulkScriptedPartialUpdate(testCase, 44L));
  }

  @Test
  void buildRelationshipDocumentUpdatePreservesTestCaseRevisionOwnedFields() {
    doCallRealMethod().when(searchRepository).buildRelationshipDocumentUpdate(any(), any());
    MockEntityWithType testCase = new MockEntityWithType(Entity.TEST_CASE, "testCase");
    Map<String, Object> document =
        Map.of(
            "name",
            "testCase",
            Entity.FIELD_TEST_SUITES,
            List.of(Map.of("id", UUID.randomUUID().toString())),
            TestCaseRepository.TEST_SUITES_REVISION_FIELD,
            12L);

    SearchRepository.ScriptedPartialUpdate update =
        searchRepository.buildRelationshipDocumentUpdate(testCase, document);

    assertNotNull(update);
    assertEquals(document, update.parameters());
    assertTrue(update.scriptedUpsert());
    assertTrue(update.script().contains("preserveRelationship"));
    assertTrue(update.script().contains("k != 'testSuites'"));
    assertTrue(update.script().contains("k != 'testSuitesRevision'"));
    assertNull(
        searchRepository.buildRelationshipDocumentUpdate(
            new MockEntityWithType(Entity.TABLE, "table"), document));
  }

  @Test
  void relationshipDocumentUpdateConvertsNullFieldsIntoExplicitRemovals() {
    doCallRealMethod().when(searchRepository).buildRelationshipDocumentUpdate(any(), any());
    MockEntityWithType testCase = new MockEntityWithType(Entity.TEST_CASE, "testCase");
    Map<String, Object> document = new HashMap<>();
    document.put("name", "testCase");
    document.put("description", null);
    document.put("fieldsToRemove", List.of("displayName"));

    SearchRepository.ScriptedPartialUpdate update =
        searchRepository.buildRelationshipDocumentUpdate(testCase, document);

    assertNotNull(update);
    Map<String, Object> parameters = update.parametersForIndexing();
    assertEquals("testCase", parameters.get("name"));
    assertFalse(parameters.containsKey("description"));
    assertEquals(List.of("description", "displayName"), parameters.get("fieldsToRemove"));
  }

  @Test
  void buildLogicalTestSuiteUpdatesFenceAndPreserveTests() {
    doCallRealMethod().when(searchRepository).buildBulkScriptedPartialUpdate(any(), any());
    doCallRealMethod().when(searchRepository).buildRelationshipDocumentUpdate(any(), any());
    EntityReference testCaseReference =
        new EntityReference().withId(UUID.randomUUID()).withType(Entity.TEST_CASE).withName("test");
    TestSuite logicalSuite =
        spy(
            new TestSuite()
                .withId(UUID.randomUUID())
                .withName("logicalSuite")
                .withFullyQualifiedName("logicalSuite")
                .withBasic(false)
                .withVersion(1.0)
                .withTests(List.of(testCaseReference)));
    doReturn(
            new EntityReference()
                .withId(logicalSuite.getId())
                .withType(Entity.TEST_SUITE)
                .withName(logicalSuite.getName()))
        .when(logicalSuite)
        .getEntityReference();
    logicalSuite.setChangeDescription(
        new ChangeDescription()
            .withPreviousVersion(logicalSuite.getVersion())
            .withFieldsUpdated(
                List.of(
                    new FieldChange().withName("tests").withNewValue(logicalSuite.getTests()))));

    SearchRepository.ScriptedPartialUpdate fenced =
        searchRepository.buildBulkScriptedPartialUpdate(logicalSuite, 19L);

    assertNotNull(fenced);
    assertTrue(fenced.script().contains("params.testsRevision >= ctx._source.testsRevision"));
    assertTrue(fenced.script().contains("ctx._source.tests = params.tests"));
    assertEquals(19L, fenced.parameters().get(TestSuiteRepository.TESTS_REVISION_FIELD));

    Map<String, Object> logicalSuiteDocument =
        Map.of(
            "name",
            "logicalSuite",
            "tests",
            List.of(Map.of("id", testCaseReference.getId().toString())),
            TestSuiteRepository.TESTS_REVISION_FIELD,
            19L);
    SearchRepository.ScriptedPartialUpdate preserving =
        searchRepository.buildRelationshipDocumentUpdate(logicalSuite, logicalSuiteDocument);
    assertNotNull(preserving);
    assertTrue(preserving.script().contains("k != 'tests'"));
    assertTrue(preserving.script().contains("k != 'testsRevision'"));

    logicalSuite.setBasic(true);
    assertNull(
        searchRepository.buildRelationshipDocumentUpdate(logicalSuite, logicalSuiteDocument));
    assertNull(searchRepository.buildBulkScriptedPartialUpdate(logicalSuite, 20L));
  }

  /** Mock entity that allows setting a specific entity type for testing */
  static class MockEntityWithType implements EntityInterface<EntityStatus> {
    private final UUID id = UUID.randomUUID();
    private final String entityType;
    private final String name;
    private final String fqn;
    private ChangeDescription changeDescription;
    private List<TestSuite> testSuites;

    MockEntityWithType(String entityType, String name) {
      this.entityType = entityType;
      this.name = name;
      this.fqn = "test." + entityType + "." + name;
    }

    @Override
    public EntityReference getEntityReference() {
      return new EntityReference().withId(id).withType(entityType).withName(name);
    }

    @Override
    public UUID getId() {
      return id;
    }

    @Override
    public String getDescription() {
      return "test description";
    }

    @Override
    public String getDisplayName() {
      return name;
    }

    @Override
    public String getName() {
      return name;
    }

    @Override
    public Double getVersion() {
      return 1.0;
    }

    @Override
    public String getUpdatedBy() {
      return "testUser";
    }

    @Override
    public Long getUpdatedAt() {
      return System.currentTimeMillis();
    }

    @Override
    public URI getHref() {
      return null;
    }

    @Override
    public ChangeDescription getChangeDescription() {
      return changeDescription;
    }

    @Override
    public ChangeDescription getIncrementalChangeDescription() {
      return null;
    }

    @Override
    public String getFullyQualifiedName() {
      return fqn;
    }

    @Override
    public void setId(UUID id) {}

    @Override
    public void setDescription(String description) {}

    @Override
    public void setDisplayName(String displayName) {}

    @Override
    public void setName(String name) {}

    @Override
    public void setVersion(Double newVersion) {}

    @Override
    public void setChangeDescription(ChangeDescription changeDescription) {
      this.changeDescription = changeDescription;
    }

    public List<TestSuite> getTestSuites() {
      return testSuites;
    }

    public void setTestSuites(List<TestSuite> testSuites) {
      this.testSuites = testSuites;
    }

    @Override
    public void setIncrementalChangeDescription(ChangeDescription incrementalChangeDescription) {}

    @Override
    public void setFullyQualifiedName(String fullyQualifiedName) {}

    @Override
    public void setUpdatedBy(String admin) {}

    @Override
    public void setUpdatedAt(Long updatedAt) {}

    @Override
    public void setHref(URI href) {}

    @Override
    @SuppressWarnings("unchecked")
    public <T extends EntityInterface<?>> T withHref(URI href) {
      return (T) this;
    }
  }
}

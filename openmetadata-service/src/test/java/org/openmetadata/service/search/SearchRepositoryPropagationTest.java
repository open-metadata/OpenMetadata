package org.openmetadata.service.search;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.lang.reflect.Field;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.apache.commons.lang3.tuple.Pair;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.service.configuration.elasticsearch.ElasticSearchConfiguration;
import org.openmetadata.schema.type.ChangeDescription;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.FieldChange;
import org.openmetadata.search.IndexMapping;
import org.openmetadata.search.IndexMappingLoader;
import org.openmetadata.service.Entity;
import org.openmetadata.service.events.lifecycle.EntityLifecycleEventDispatcher;
import org.openmetadata.service.jdbi3.EntityTimeSeriesRepository;

class SearchRepositoryPropagationTest {
  private static SearchClient searchClientForConstructor;

  private SearchClient searchClient;
  private SearchRepository repository;

  @BeforeEach
  void setUp() {
    searchClient = mock(SearchClient.class);
    searchClientForConstructor = searchClient;
    IndexMappingLoader mappingLoader = mock(IndexMappingLoader.class);
    when(mappingLoader.getIndexMapping()).thenReturn(Map.<String, IndexMapping>of());
    EntityLifecycleEventDispatcher dispatcher = mock(EntityLifecycleEventDispatcher.class);
    try (var loaderMock = mockStatic(IndexMappingLoader.class);
        var dispatcherMock = mockStatic(EntityLifecycleEventDispatcher.class)) {
      loaderMock.when(IndexMappingLoader::getInstance).thenReturn(mappingLoader);
      dispatcherMock.when(EntityLifecycleEventDispatcher::getInstance).thenReturn(dispatcher);
      repository = new TestSearchRepository();
    }
    registerTimeSeriesRepository(Entity.TEST_CASE_RESOLUTION_STATUS);
    registerTimeSeriesRepository(Entity.TEST_CASE_RESULT);
  }

  @AfterEach
  void tearDown() {
    removeTimeSeriesRepository(Entity.TEST_CASE_RESOLUTION_STATUS);
    removeTimeSeriesRepository(Entity.TEST_CASE_RESULT);
    searchClientForConstructor = null;
  }

  @Test
  void propagateInheritedFieldsToChildrenSkipsAllTimeSeriesChildren() throws Exception {
    IndexMapping mapping =
        IndexMapping.builder()
            .indexName("test_case_search_index")
            .alias(Entity.TEST_CASE)
            .childAliases(List.of(Entity.TEST_CASE_RESOLUTION_STATUS, Entity.TEST_CASE_RESULT))
            .indexMappingFile("/elasticsearch/%s/test_case_index_mapping.json")
            .build();
    EntityInterface testCase = testCase();

    repository.propagateInheritedFieldsToChildren(
        Entity.TEST_CASE, testCase.getId().toString(), displayNameChange(), mapping, testCase);

    verify(searchClient, never()).updateChildren(anyList(), any(Pair.class), any(Pair.class));
  }

  @Test
  void propagateInheritedFieldsToChildrenTargetsOnlyNonTimeSeriesChildren() throws Exception {
    IndexMapping mapping =
        IndexMapping.builder()
            .indexName("test_case_search_index")
            .alias(Entity.TEST_CASE)
            .childAliases(
                List.of(
                    Entity.TEST_CASE_RESOLUTION_STATUS,
                    Entity.TABLE_COLUMN,
                    Entity.TEST_CASE_RESULT))
            .indexMappingFile("/elasticsearch/%s/test_case_index_mapping.json")
            .build();
    EntityInterface testCase = testCase();

    repository.propagateInheritedFieldsToChildren(
        Entity.TEST_CASE, testCase.getId().toString(), displayNameChange(), mapping, testCase);

    @SuppressWarnings("unchecked")
    ArgumentCaptor<List<String>> targetsCaptor = ArgumentCaptor.forClass(List.class);
    verify(searchClient).updateChildren(targetsCaptor.capture(), any(Pair.class), any(Pair.class));

    assertEquals(List.of("cluster_tableColumn"), targetsCaptor.getValue());
  }

  private EntityInterface testCase() {
    UUID id = UUID.randomUUID();
    EntityInterface entity = mock(EntityInterface.class);
    EntityReference reference = new EntityReference().withId(id).withType(Entity.TEST_CASE);
    when(entity.getId()).thenReturn(id);
    when(entity.getEntityReference()).thenReturn(reference);
    return entity;
  }

  private ChangeDescription displayNameChange() {
    return new ChangeDescription()
        .withFieldsAdded(List.of())
        .withFieldsUpdated(
            List.of(
                new FieldChange()
                    .withName(Entity.FIELD_DISPLAY_NAME)
                    .withOldValue("old")
                    .withNewValue("new")))
        .withFieldsDeleted(List.of());
  }

  @SuppressWarnings({"unchecked", "rawtypes"})
  private void registerTimeSeriesRepository(String entityType) {
    timeSeriesRepositoryMap().put(entityType, mock(EntityTimeSeriesRepository.class));
  }

  private void removeTimeSeriesRepository(String entityType) {
    timeSeriesRepositoryMap().remove(entityType);
  }

  @SuppressWarnings("unchecked")
  private Map<String, Object> timeSeriesRepositoryMap() {
    try {
      Field field = Entity.class.getDeclaredField("ENTITY_TS_REPOSITORY_MAP");
      field.setAccessible(true);
      return (Map<String, Object>) field.get(null);
    } catch (ReflectiveOperationException e) {
      throw new IllegalStateException("Unable to access time-series repository map", e);
    }
  }

  private static final class TestSearchRepository extends SearchRepository {
    private TestSearchRepository() {
      super(new ElasticSearchConfiguration().withClusterAlias("cluster"), 1);
    }

    @Override
    public SearchClient buildSearchClient(ElasticSearchConfiguration config) {
      return searchClientForConstructor;
    }
  }
}

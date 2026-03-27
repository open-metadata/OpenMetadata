package org.openmetadata.service.search;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertInstanceOf;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyBoolean;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doNothing;
import static org.mockito.Mockito.doReturn;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockConstruction;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.spy;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import jakarta.ws.rs.core.Response;
import java.io.IOException;
import java.lang.reflect.Field;
import java.lang.reflect.Method;
import java.util.HashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.apache.commons.lang3.tuple.Pair;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.mockito.MockedConstruction;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.EntityTimeSeriesInterface;
import org.openmetadata.schema.api.entityRelationship.SearchEntityRelationshipRequest;
import org.openmetadata.schema.api.entityRelationship.SearchEntityRelationshipResult;
import org.openmetadata.schema.api.lineage.EntityCountLineageRequest;
import org.openmetadata.schema.api.lineage.LineagePaginationInfo;
import org.openmetadata.schema.api.lineage.SearchLineageRequest;
import org.openmetadata.schema.api.lineage.SearchLineageResult;
import org.openmetadata.schema.api.search.SearchSettings;
import org.openmetadata.schema.dataInsight.DataInsightChartResult;
import org.openmetadata.schema.entity.classification.Tag;
import org.openmetadata.schema.entity.data.Pipeline;
import org.openmetadata.schema.entity.data.PipelineStatus;
import org.openmetadata.schema.entity.data.QueryCostSearchResult;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.search.AggregationRequest;
import org.openmetadata.schema.search.SearchRequest;
import org.openmetadata.schema.service.configuration.elasticsearch.ElasticSearchConfiguration;
import org.openmetadata.schema.service.configuration.elasticsearch.NaturalLanguageSearchConfiguration;
import org.openmetadata.schema.settings.SettingsType;
import org.openmetadata.schema.tests.DataQualityReport;
import org.openmetadata.schema.tests.TestSuite;
import org.openmetadata.schema.type.AssetCertification;
import org.openmetadata.schema.type.ChangeDescription;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.FieldChange;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.schema.type.UsageDetails;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.search.IndexMapping;
import org.openmetadata.search.IndexMappingLoader;
import org.openmetadata.service.Entity;
import org.openmetadata.service.apps.bundles.searchIndex.ElasticSearchBulkSink;
import org.openmetadata.service.apps.bundles.searchIndex.OpenSearchBulkSink;
import org.openmetadata.service.events.lifecycle.EntityLifecycleEventDispatcher;
import org.openmetadata.service.resources.settings.SettingsCache;
import org.openmetadata.service.search.nlq.NLQService;
import org.openmetadata.service.search.nlq.NLQServiceFactory;
import org.openmetadata.service.search.opensearch.OpenSearchClient;
import org.openmetadata.service.search.vector.OpenSearchVectorService;
import org.openmetadata.service.search.vector.VectorIndexService;
import org.openmetadata.service.search.vector.client.EmbeddingClient;
import org.openmetadata.service.security.policyevaluator.SubjectContext;

class SearchRepositoryBehaviorTest {

  private static final IndexMapping TABLE_MAPPING =
      IndexMapping.builder()
          .indexName("table_search_index")
          .alias("table")
          .childAliases(List.of("column_search_index"))
          .indexMappingFile("/elasticsearch/%s/table_index_mapping.json")
          .build();

  private static final IndexMapping DOMAIN_MAPPING =
      IndexMapping.builder()
          .indexName("domain_search_index")
          .alias("domain")
          .childAliases(List.of("domain_search_index"))
          .indexMappingFile("/elasticsearch/%s/domain_index_mapping.json")
          .build();

  private static final IndexMapping DATA_PRODUCT_MAPPING =
      IndexMapping.builder()
          .indexName("data_product_search_index")
          .alias("dataProduct")
          .childAliases(List.of("data_product_search_index"))
          .indexMappingFile("/elasticsearch/%s/data_product_index_mapping.json")
          .build();

  private static final IndexMapping DATABASE_SERVICE_MAPPING =
      IndexMapping.builder()
          .indexName("database_service_search_index")
          .alias("databaseService")
          .childAliases(List.of("database_search_index"))
          .indexMappingFile("/elasticsearch/%s/database_service_index_mapping.json")
          .build();

  private static final IndexMapping PAGE_MAPPING =
      IndexMapping.builder()
          .indexName("page_search_index")
          .alias("page")
          .childAliases(List.of("page_search_index"))
          .indexMappingFile("/elasticsearch/%s/page_index_mapping.json")
          .build();

  private static final IndexMapping TEST_SUITE_MAPPING =
      IndexMapping.builder()
          .indexName("test_suite_search_index")
          .alias("testSuite")
          .childAliases(List.of("test_case_search_index"))
          .indexMappingFile("/elasticsearch/%s/test_suite_index_mapping.json")
          .build();

  private SearchClient searchClient;
  private SearchIndexFactory searchIndexFactory;
  private SearchRepository repository;

  @BeforeEach
  void setUp() {
    searchClient = mock(SearchClient.class);
    when(searchClient.isClientAvailable()).thenReturn(true);
    searchIndexFactory = mock(SearchIndexFactory.class);
    repository =
        newRepository(
            Map.ofEntries(
                Map.entry(Entity.TABLE, TABLE_MAPPING),
                Map.entry(Entity.DOMAIN, DOMAIN_MAPPING),
                Map.entry(Entity.DATA_PRODUCT, DATA_PRODUCT_MAPPING),
                Map.entry(Entity.DATABASE_SERVICE, DATABASE_SERVICE_MAPPING),
                Map.entry(Entity.TAG, TABLE_MAPPING),
                Map.entry(Entity.GLOSSARY_TERM, TABLE_MAPPING),
                Map.entry(Entity.GLOSSARY, TABLE_MAPPING),
                Map.entry(Entity.CLASSIFICATION, TABLE_MAPPING),
                Map.entry(Entity.PAGE, PAGE_MAPPING),
                Map.entry(Entity.TEST_SUITE, TEST_SUITE_MAPPING),
                Map.entry(Entity.QUERY, TABLE_MAPPING)),
            "cluster");
    Entity.setSearchRepository(repository);
  }

  @AfterEach
  void tearDown() {
    Entity.setSearchRepository(null);
  }

  @Test
  void indexNameHelpersRespectClusterAlias() {
    assertEquals(
        "cluster_table_search_index,cluster_domain_search_index",
        repository.getIndexOrAliasName("table_search_index, domain_search_index"));
    assertEquals(
        "table_search_index", repository.getIndexNameWithoutAlias("cluster_table_search_index"));
  }

  @Test
  void indexExistsFallsBackToAliasLookup() {
    when(searchClient.indexExists("cluster_table_search_index")).thenReturn(false);
    when(searchClient.getIndicesByAlias("cluster_table_search_index"))
        .thenReturn(Set.of("table_v1"));

    assertTrue(repository.indexExists(TABLE_MAPPING));
  }

  @Test
  void createIndexRemovesLateAppearingAliasTargetsBeforeCreatingIndex() {
    when(searchClient.indexExists("cluster_table_search_index")).thenReturn(false);
    when(searchClient.getIndicesByAlias("cluster_table_search_index"))
        .thenReturn(Set.of(), Set.of("legacy_table_index"));

    repository.createIndex(TABLE_MAPPING);

    verify(searchClient).removeAliases("legacy_table_index", Set.of("cluster_table_search_index"));
    verify(searchClient).deleteIndex("legacy_table_index");
    verify(searchClient).createIndex(eq(TABLE_MAPPING), any(String.class));
    verify(searchClient).createAliases(TABLE_MAPPING);
  }

  @Test
  void createIndexSkipsExistingIndices() {
    when(searchClient.indexExists("cluster_table_search_index")).thenReturn(true);

    repository.createIndex(TABLE_MAPPING);

    verify(searchClient, never()).createIndex(eq(TABLE_MAPPING), any(String.class));
    verify(searchClient, never()).createAliases(TABLE_MAPPING);
  }

  @Test
  void updateIndexCreatesMissingIndexAndAliasesIt() {
    when(searchClient.indexExists("cluster_table_search_index")).thenReturn(false);
    when(searchClient.getIndicesByAlias("cluster_table_search_index")).thenReturn(Set.of());

    repository.updateIndex(TABLE_MAPPING);

    verify(searchClient).createIndex(eq(TABLE_MAPPING), any(String.class));
    verify(searchClient).createAliases(TABLE_MAPPING);
  }

  @Test
  void updateIndexUpdatesExistingIndicesInPlace() {
    when(searchClient.indexExists("cluster_table_search_index")).thenReturn(true);

    repository.updateIndex(TABLE_MAPPING);

    verify(searchClient).updateIndex(eq(TABLE_MAPPING), any(String.class));
    verify(searchClient).createAliases(TABLE_MAPPING);
  }

  @Test
  void deleteIndexRemovesAliasTargetsWhenConcreteIndexIsAbsent() {
    when(searchClient.indexExists("cluster_table_search_index")).thenReturn(false);
    when(searchClient.getIndicesByAlias("cluster_table_search_index"))
        .thenReturn(Set.of("table_v1", "table_v2"));

    repository.deleteIndex(TABLE_MAPPING);

    verify(searchClient).removeAliases("table_v1", Set.of("cluster_table_search_index"));
    verify(searchClient).removeAliases("table_v2", Set.of("cluster_table_search_index"));
    verify(searchClient).deleteIndex("table_v1");
    verify(searchClient).deleteIndex("table_v2");
  }

  @Test
  void deleteIndexDeletesConcreteIndexWhenItExists() {
    when(searchClient.indexExists("cluster_table_search_index")).thenReturn(true);

    repository.deleteIndex(TABLE_MAPPING);

    verify(searchClient).deleteIndex(TABLE_MAPPING);
  }

  @Test
  void createEntityIndexBuildsAndWritesSearchDocument() throws IOException {
    UUID entityId = UUID.randomUUID();
    EntityInterface entity = mockEntity(Entity.TABLE, entityId, "orders");
    when(searchIndexFactory.buildIndex(Entity.TABLE, entity))
        .thenReturn(new MapBackedSearchIndex(entity, Map.of("name", "orders")));

    repository.createEntityIndex(entity);

    ArgumentCaptor<String> docCaptor = ArgumentCaptor.forClass(String.class);
    verify(searchClient)
        .createEntity(
            eq("cluster_table_search_index"), eq(entityId.toString()), docCaptor.capture());
    assertTrue(docCaptor.getValue().contains("\"name\":\"orders\""));
  }

  @Test
  void createEntityIndexSkipsUnsupportedTypes() throws IOException {
    repository.createEntityIndex(mockEntity("unsupported", UUID.randomUUID(), "skip-me"));

    verify(searchClient, never())
        .createEntity(any(String.class), any(String.class), any(String.class));
  }

  @Test
  void createEntitiesIndexBulkWritesDocumentsOfTheSameType() throws IOException {
    EntityInterface first = mockEntity(Entity.TABLE, UUID.randomUUID(), "orders");
    EntityInterface second = mockEntity(Entity.TABLE, UUID.randomUUID(), "customers");
    when(searchIndexFactory.buildIndex(Entity.TABLE, first))
        .thenReturn(new MapBackedSearchIndex(first, Map.of("name", "orders")));
    when(searchIndexFactory.buildIndex(Entity.TABLE, second))
        .thenReturn(new MapBackedSearchIndex(second, Map.of("name", "customers")));

    repository.createEntitiesIndex(List.of(first, second));

    @SuppressWarnings("unchecked")
    ArgumentCaptor<List<Map<String, String>>> docsCaptor = ArgumentCaptor.forClass(List.class);
    verify(searchClient).createEntities(eq("cluster_table_search_index"), docsCaptor.capture());
    assertEquals(2, docsCaptor.getValue().size());
  }

  @Test
  void createEntitiesIndexSkipsFailedDocumentsAndContinuesBulkCreate() throws IOException {
    EntityInterface broken = mockEntity(Entity.TABLE, UUID.randomUUID(), "broken");
    EntityInterface valid = mockEntity(Entity.TABLE, UUID.randomUUID(), "customers");
    when(searchIndexFactory.buildIndex(Entity.TABLE, broken))
        .thenThrow(new IllegalStateException("cannot index broken entity"));
    when(searchIndexFactory.buildIndex(Entity.TABLE, valid))
        .thenReturn(new MapBackedSearchIndex(valid, Map.of("name", "customers")));

    repository.createEntitiesIndex(List.of(broken, valid));

    @SuppressWarnings("unchecked")
    ArgumentCaptor<List<Map<String, String>>> docsCaptor = ArgumentCaptor.forClass(List.class);
    verify(searchClient).createEntities(eq("cluster_table_search_index"), docsCaptor.capture());
    assertEquals(1, docsCaptor.getValue().size());
    assertEquals(
        valid.getId().toString(), docsCaptor.getValue().getFirst().keySet().iterator().next());
  }

  @Test
  void createEntitiesIndexSkipsBulkCreateWhenNoDocumentCanBeBuilt() throws IOException {
    EntityInterface first = mockEntity(Entity.TABLE, UUID.randomUUID(), "broken_1");
    EntityInterface second = mockEntity(Entity.TABLE, UUID.randomUUID(), "broken_2");
    when(searchIndexFactory.buildIndex(Entity.TABLE, first))
        .thenThrow(new IllegalStateException("cannot index first"));
    when(searchIndexFactory.buildIndex(Entity.TABLE, second))
        .thenThrow(new IllegalStateException("cannot index second"));

    repository.createEntitiesIndex(List.of(first, second));

    verify(searchClient, never()).createEntities(any(String.class), any(List.class));
  }

  @Test
  void createEntitiesIndexSkipsEmptyEntityLists() throws IOException {
    repository.createEntitiesIndex(List.of());

    verify(searchClient, never()).createEntities(any(String.class), any(List.class));
  }

  @Test
  void createTimeSeriesEntityWritesGenericTimeSeriesDocuments() throws IOException {
    EntityTimeSeriesInterface entity =
        mockTimeSeriesEntity(Entity.TABLE, UUID.randomUUID(), "orders_ts");
    when(searchIndexFactory.buildIndex(Entity.TABLE, entity))
        .thenReturn(new MapBackedSearchIndex(entity, Map.of("timestamp", 42)));

    repository.createTimeSeriesEntity(entity);

    verify(searchClient)
        .createTimeSeriesEntity(
            "cluster_table_search_index",
            entity.getId().toString(),
            JsonUtils.pojoToJson(Map.of("timestamp", 42)));
  }

  @Test
  void updateTimeSeriesEntityUsesDefaultUpdateScript() {
    EntityTimeSeriesInterface entity =
        mockTimeSeriesEntity(Entity.TABLE, UUID.randomUUID(), "orders_ts");
    when(searchIndexFactory.buildIndex(Entity.TABLE, entity))
        .thenReturn(new MapBackedSearchIndex(entity, Map.of("timestamp", 42)));

    repository.updateTimeSeriesEntity(entity);

    verify(searchClient)
        .updateEntity(
            "cluster_table_search_index",
            entity.getId().toString(),
            Map.of("timestamp", 42),
            SearchClient.DEFAULT_UPDATE_SCRIPT);
  }

  @Test
  void updateEntityIndexPropagatesWhenTagRenameAffectsChildren() throws Exception {
    SearchRepository spyRepository = spy(repository);
    Tag tag = mock(Tag.class);
    EntityReference entityReference =
        new EntityReference().withId(UUID.randomUUID()).withType(Entity.TAG);
    ChangeDescription changeDescription =
        changeDescription(
                List.of(),
                List.of(
                    new FieldChange()
                        .withName(Entity.FIELD_NAME)
                        .withOldValue("oldTag")
                        .withNewValue("newTag")),
                List.of())
            .withPreviousVersion(1.0);
    when(tag.getEntityReference()).thenReturn(entityReference);
    when(tag.getId()).thenReturn(entityReference.getId());
    when(tag.getVersion()).thenReturn(2.0);
    when(tag.getChangeDescription()).thenReturn(changeDescription);
    when(tag.getIncrementalChangeDescription()).thenReturn(null);
    when(tag.getFullyQualifiedName()).thenReturn("Classification.oldTag");
    when(searchIndexFactory.buildIndex(Entity.TAG, tag))
        .thenReturn(new MapBackedSearchIndex(tag, Map.of("name", "newTag")));
    doNothing()
        .when(spyRepository)
        .propagateInheritedFieldsToChildren(any(), any(), any(), any(), any());
    doNothing().when(spyRepository).propagateGlossaryTags(any(), any(), any());
    doNothing().when(spyRepository).propagateCertificationTags(any(), any(), any());
    doNothing().when(spyRepository).propagateToRelatedEntities(any(), any(), any(), any());

    spyRepository.updateEntityIndex(tag);

    verify(searchClient)
        .updateEntity(
            eq("cluster_table_search_index"),
            eq(entityReference.getId().toString()),
            any(Map.class),
            any(String.class));
    verify(spyRepository)
        .propagateInheritedFieldsToChildren(
            eq(Entity.TAG),
            eq(entityReference.getId().toString()),
            eq(changeDescription),
            eq(TABLE_MAPPING),
            eq(tag));
    verify(spyRepository)
        .propagateGlossaryTags(eq(Entity.TAG), eq("Classification.oldTag"), eq(changeDescription));
    verify(spyRepository)
        .propagateCertificationTags(eq(Entity.TAG), eq(tag), eq(changeDescription));
    verify(spyRepository)
        .propagateToRelatedEntities(
            eq(Entity.TAG), eq(changeDescription), eq(TABLE_MAPPING), eq(tag));
  }

  @Test
  void deleteByScriptUsesTheMappedEntityIndex() throws IOException {
    repository.deleteByScript(
        Entity.TABLE, "ctx._source.remove('deleted')", Map.of("field", "deleted"));

    verify(searchClient)
        .deleteByScript(
            "cluster_table_search_index",
            "ctx._source.remove('deleted')",
            Map.of("field", "deleted"));
  }

  @Test
  void propagateInheritedFieldsToChildrenUsesServiceParentFieldForServiceDisplayNameChanges()
      throws IOException {
    EntityInterface serviceEntity = mockEntity(Entity.DATABASE_SERVICE, UUID.randomUUID(), "svc");
    ChangeDescription changeDescription =
        changeDescription(
            List.of(),
            List.of(
                new FieldChange()
                    .withName(Entity.FIELD_DISPLAY_NAME)
                    .withOldValue("Old Service")
                    .withNewValue("New Service")),
            List.of());

    repository.propagateInheritedFieldsToChildren(
        Entity.DATABASE_SERVICE,
        "service-id",
        changeDescription,
        DATABASE_SERVICE_MAPPING,
        serviceEntity);

    @SuppressWarnings("unchecked")
    ArgumentCaptor<Pair<String, String>> fieldCaptor = ArgumentCaptor.forClass(Pair.class);
    @SuppressWarnings("unchecked")
    ArgumentCaptor<Pair<String, Map<String, Object>>> updateCaptor =
        ArgumentCaptor.forClass(Pair.class);
    verify(searchClient)
        .updateChildren(
            eq(List.of("cluster_database_search_index")),
            fieldCaptor.capture(),
            updateCaptor.capture());
    assertEquals("service.id", fieldCaptor.getValue().getLeft());
    assertEquals("service-id", fieldCaptor.getValue().getRight());
    assertEquals("New Service", updateCaptor.getValue().getRight().get(Entity.FIELD_DISPLAY_NAME));
  }

  @Test
  void propagateInheritedFieldsToChildrenUpdatesDomainChildrenAndDataProductsSeparately()
      throws IOException {
    EntityInterface domainEntity = mockEntity(Entity.DOMAIN, UUID.randomUUID(), "finance");
    ChangeDescription changeDescription =
        changeDescription(
            List.of(),
            List.of(
                new FieldChange()
                    .withName(Entity.FIELD_DISPLAY_NAME)
                    .withOldValue("Old Domain")
                    .withNewValue("New Domain")),
            List.of());

    repository.propagateInheritedFieldsToChildren(
        Entity.DOMAIN, "domain-id", changeDescription, DOMAIN_MAPPING, domainEntity);

    verify(searchClient)
        .updateChildren(
            eq(List.of("cluster_domain_search_index")), any(Pair.class), any(Pair.class));
    verify(searchClient)
        .updateChildren(
            eq(List.of("cluster_data_product_search_index")), any(Pair.class), any(Pair.class));
  }

  @Test
  void deleteEntityByFqnPrefixUsesEntityIndex() throws IOException {
    EntityInterface entity = mockEntity(Entity.TABLE, UUID.randomUUID(), "orders");

    repository.deleteEntityByFQNPrefix(entity);

    verify(searchClient)
        .deleteEntityByFQNPrefix("cluster_table_search_index", "svc.db.schema.orders");
  }

  @Test
  void deleteTimeSeriesEntityByIdUsesEntityIndex() throws IOException {
    EntityTimeSeriesInterface entity =
        mockTimeSeriesEntity(Entity.TABLE, UUID.randomUUID(), "orders_ts");

    repository.deleteTimeSeriesEntityById(entity);

    verify(searchClient).deleteEntity("cluster_table_search_index", entity.getId().toString());
  }

  @Test
  void propagateGlossaryTagsMarksPropagatedTagsAsDerived() {
    TagLabel tagLabel =
        new TagLabel()
            .withTagFQN("Glossary.Term")
            .withName("Term")
            .withLabelType(TagLabel.LabelType.MANUAL);
    ChangeDescription changeDescription =
        changeDescription(
            List.of(
                new FieldChange()
                    .withName(Entity.FIELD_TAGS)
                    .withNewValue(JsonUtils.pojoToJson(List.of(tagLabel)))),
            List.of(),
            List.of());

    repository.propagateGlossaryTags(Entity.GLOSSARY_TERM, "Glossary.Term", changeDescription);

    @SuppressWarnings("unchecked")
    ArgumentCaptor<Pair<String, Map<String, Object>>> updateCaptor =
        ArgumentCaptor.forClass(Pair.class);
    verify(searchClient)
        .updateChildren(
            eq(SearchClient.GLOBAL_SEARCH_ALIAS), any(Pair.class), updateCaptor.capture());
    @SuppressWarnings("unchecked")
    List<TagLabel> propagated = (List<TagLabel>) updateCaptor.getValue().getRight().get("tagAdded");
    assertEquals(TagLabel.LabelType.DERIVED, propagated.getFirst().getLabelType());
  }

  @Test
  void propagateGlossaryTagsMarksDeletedTagsAsDerived() {
    TagLabel tagLabel =
        new TagLabel()
            .withTagFQN("Glossary.Term")
            .withName("Term")
            .withLabelType(TagLabel.LabelType.MANUAL);
    ChangeDescription changeDescription =
        changeDescription(
            List.of(),
            List.of(),
            List.of(
                new FieldChange()
                    .withName(Entity.FIELD_TAGS)
                    .withOldValue(JsonUtils.pojoToJson(List.of(tagLabel)))));

    repository.propagateGlossaryTags(Entity.GLOSSARY_TERM, "Glossary.Term", changeDescription);

    @SuppressWarnings("unchecked")
    ArgumentCaptor<Pair<String, Map<String, Object>>> updateCaptor =
        ArgumentCaptor.forClass(Pair.class);
    verify(searchClient)
        .updateChildren(
            eq(SearchClient.GLOBAL_SEARCH_ALIAS), any(Pair.class), updateCaptor.capture());
    @SuppressWarnings("unchecked")
    List<TagLabel> deleted = (List<TagLabel>) updateCaptor.getValue().getRight().get("tagDeleted");
    assertEquals(TagLabel.LabelType.DERIVED, deleted.getFirst().getLabelType());
  }

  @Test
  void propagateCertificationTagsUpdatesDataAssetsForCertificationTags() {
    Tag tag = mock(Tag.class);
    when(tag.getClassification())
        .thenReturn(new EntityReference().withFullyQualifiedName("Certification"));
    when(tag.getName()).thenReturn("Gold");
    when(tag.getDescription()).thenReturn("Certified");
    when(tag.getFullyQualifiedName()).thenReturn("Certification.Gold");
    when(tag.getStyle()).thenReturn(null);

    repository.propagateCertificationTags(
        Entity.TAG, tag, changeDescription(List.of(), List.of(), List.of()));

    verify(searchClient)
        .updateChildren(eq(SearchClient.DATA_ASSET_SEARCH_ALIAS), any(Pair.class), any(Pair.class));
  }

  @Test
  void propagateCertificationTagsUpdatesEntityCertificationDocument() {
    Table table = mock(Table.class);
    UUID entityId = UUID.randomUUID();
    when(table.getId()).thenReturn(entityId);
    when(table.getEntityReference())
        .thenReturn(new EntityReference().withId(entityId).withType(Entity.TABLE));
    when(table.getCertification())
        .thenReturn(
            new AssetCertification()
                .withTagLabel(
                    new TagLabel()
                        .withName("Gold")
                        .withDescription("Certified")
                        .withTagFQN("Certification.Gold")));
    ChangeDescription changeDescription =
        changeDescription(
            List.of(),
            List.of(
                new FieldChange().withName("certification").withOldValue("{}").withNewValue("{}")),
            List.of());

    repository.propagateCertificationTags(Entity.TABLE, table, changeDescription);

    verify(searchClient)
        .updateEntity(
            eq("cluster_table_search_index"),
            eq(entityId.toString()),
            any(Map.class),
            eq(SearchClient.UPDATE_CERTIFICATION_SCRIPT));
  }

  @Test
  void propagateCertificationTagsClearsEntityCertificationDocumentWhenRemoved() {
    Table table = mock(Table.class);
    UUID entityId = UUID.randomUUID();
    when(table.getId()).thenReturn(entityId);
    when(table.getEntityReference())
        .thenReturn(new EntityReference().withId(entityId).withType(Entity.TABLE));
    when(table.getCertification()).thenReturn(null);
    ChangeDescription changeDescription =
        changeDescription(
            List.of(),
            List.of(),
            List.of(new FieldChange().withName("certification").withOldValue("{}")));

    repository.propagateCertificationTags(Entity.TABLE, table, changeDescription);

    @SuppressWarnings("unchecked")
    ArgumentCaptor<Map<String, Object>> paramCaptor = ArgumentCaptor.forClass(Map.class);
    verify(searchClient)
        .updateEntity(
            eq("cluster_table_search_index"),
            eq(entityId.toString()),
            paramCaptor.capture(),
            eq(SearchClient.UPDATE_CERTIFICATION_SCRIPT));
    assertNull(paramCaptor.getValue().get("name"));
    assertNull(paramCaptor.getValue().get("description"));
    assertNull(paramCaptor.getValue().get("tagFQN"));
    assertNull(paramCaptor.getValue().get("style"));
  }

  @Test
  void deleteAndSoftDeleteOperationsSkipUnsupportedTypesButHandleMappedEntities()
      throws IOException {
    EntityInterface entity = mockEntity(Entity.TABLE, UUID.randomUUID(), "orders");
    SearchRepository spyRepository = spy(repository);
    doNothing().when(spyRepository).deleteOrUpdateChildren(any(), any());
    doNothing().when(spyRepository).softDeleteOrRestoredChildren(any(), any(), anyBoolean());

    spyRepository.deleteEntityIndex(entity);
    spyRepository.softDeleteOrRestoreEntityIndex(entity, true);

    verify(searchClient).deleteEntity("cluster_table_search_index", entity.getId().toString());
    verify(searchClient)
        .softDeleteOrRestoreEntity(
            "cluster_table_search_index",
            entity.getId().toString(),
            String.format(SearchClient.SOFT_DELETE_RESTORE_SCRIPT, true));

    EntityInterface unsupported = mockEntity("unsupported", UUID.randomUUID(), "skip-me");
    spyRepository.deleteEntityIndex(unsupported);
    verify(searchClient, never())
        .deleteEntity("cluster_unsupported_search_index", unsupported.getId().toString());
  }

  @Test
  void deleteEntityIndexRemovesTagReferencesFromChildren() {
    EntityInterface tag = mockEntity(Entity.TAG, UUID.randomUUID(), "revenue");
    when(tag.getFullyQualifiedName()).thenReturn("Glossary.Revenue");

    repository.deleteEntityIndex(tag);

    verify(searchClient)
        .updateChildren(
            SearchClient.GLOBAL_SEARCH_ALIAS,
            new org.apache.commons.lang3.tuple.ImmutablePair<>("tags.tagFQN", "Glossary.Revenue"),
            new org.apache.commons.lang3.tuple.ImmutablePair<>(
                SearchClient.REMOVE_TAGS_CHILDREN_SCRIPT, Map.of("fqn", "Glossary.Revenue")));
  }

  @Test
  void deleteEntityIndexDeletesServiceChildrenByServiceId() throws Exception {
    EntityInterface service = mockEntity(Entity.DATABASE_SERVICE, UUID.randomUUID(), "warehouse");

    repository.deleteEntityIndex(service);

    verify(searchClient)
        .deleteEntityByFields(
            List.of("cluster_database_search_index"),
            List.of(
                new org.apache.commons.lang3.tuple.ImmutablePair<>(
                    "service.id", service.getId().toString())));
  }

  @Test
  void deleteEntityIndexDeletesGenericChildrenByEntityTypeId() throws Exception {
    EntityInterface table = mockEntity(Entity.TABLE, UUID.randomUUID(), "orders");

    repository.deleteEntityIndex(table);

    verify(searchClient)
        .deleteEntityByFields(
            List.of("cluster_column_search_index"),
            List.of(
                new org.apache.commons.lang3.tuple.ImmutablePair<>(
                    "table.id", table.getId().toString())));
  }

  @Test
  void inheritedFieldChangesMarkAddedOwnersDomainsFollowersAndNestedDisplayName() throws Exception {
    EntityInterface serviceEntity = mockEntity(Entity.DATABASE_SERVICE, UUID.randomUUID(), "svc");
    when(serviceEntity.getOwners())
        .thenReturn(List.of(new EntityReference().withId(UUID.randomUUID()).withType(Entity.USER)));
    when(serviceEntity.getDomains())
        .thenReturn(
            List.of(new EntityReference().withId(UUID.randomUUID()).withType(Entity.DOMAIN)));
    when(serviceEntity.getFollowers())
        .thenReturn(List.of(new EntityReference().withId(UUID.randomUUID()).withType(Entity.USER)));

    ChangeDescription changeDescription =
        changeDescription(
            List.of(
                new FieldChange().withName(Entity.FIELD_OWNERS).withNewValue("[]"),
                new FieldChange().withName(Entity.FIELD_DOMAINS).withNewValue("[]"),
                new FieldChange().withName(Entity.FIELD_FOLLOWERS).withNewValue("[]"),
                new FieldChange()
                    .withName(Entity.FIELD_DISPLAY_NAME)
                    .withNewValue("Renamed Service"),
                new FieldChange().withName(Entity.FIELD_DISABLED).withNewValue(true)),
            List.of(),
            List.of());

    Pair<String, Map<String, Object>> updates =
        invokeGetInheritedFieldChanges(changeDescription, serviceEntity);

    assertTrue(updates.getLeft().contains("updatedOwners"));
    assertTrue(updates.getLeft().contains("updatedDomains"));
    assertTrue(updates.getLeft().contains("updatedFollowers"));
    assertTrue(updates.getLeft().contains("ctx._source.service.displayName = params.displayName"));
    assertTrue(updates.getLeft().contains("ctx._source.put('disabled', 'true')"));
    assertEquals("Renamed Service", updates.getRight().get(Entity.FIELD_DISPLAY_NAME));
    assertTrue(
        ((List<EntityReference>) updates.getRight().get("updatedOwners"))
            .stream().allMatch(EntityReference::getInherited));
    assertTrue(
        ((List<EntityReference>) updates.getRight().get("updatedDomains"))
            .stream().allMatch(EntityReference::getInherited));
    assertTrue(
        ((List<EntityReference>) updates.getRight().get("updatedFollowers"))
            .stream().allMatch(EntityReference::getInherited));
  }

  @Test
  void inheritedFieldChangesHandleUpdatedTestSuitesAndDeletedInheritedReferences()
      throws Exception {
    EntityInterface tableEntity = mockEntity(Entity.TABLE, UUID.randomUUID(), "orders");
    when(tableEntity.getOwners())
        .thenReturn(List.of(new EntityReference().withId(UUID.randomUUID()).withType(Entity.USER)));
    when(tableEntity.getDomains())
        .thenReturn(
            List.of(new EntityReference().withId(UUID.randomUUID()).withType(Entity.DOMAIN)));
    when(tableEntity.getFollowers())
        .thenReturn(List.of(new EntityReference().withId(UUID.randomUUID()).withType(Entity.USER)));

    ChangeDescription changeDescription =
        changeDescription(
            List.of(),
            List.of(
                new FieldChange()
                    .withName(Entity.FIELD_TEST_SUITES)
                    .withNewValue(List.of("suite1")),
                new FieldChange().withName(Entity.FIELD_DISPLAY_NAME).withNewValue("Orders Table"),
                new FieldChange().withName(Entity.FIELD_DISABLED).withNewValue(false)),
            List.of(
                new FieldChange().withName(Entity.FIELD_OWNERS).withOldValue("[]"),
                new FieldChange().withName(Entity.FIELD_DOMAINS).withOldValue("[]"),
                new FieldChange().withName(Entity.FIELD_FOLLOWERS).withOldValue("[]"),
                new FieldChange().withName(Entity.FIELD_DISABLED).withOldValue(true)));

    Pair<String, Map<String, Object>> updates =
        invokeGetInheritedFieldChanges(changeDescription, tableEntity);

    assertTrue(updates.getLeft().contains("deletedOwners"));
    assertTrue(updates.getLeft().contains("deletedDomains"));
    assertTrue(updates.getLeft().contains("deletedFollowers"));
    assertTrue(updates.getLeft().contains("ctx._source.testSuites = params.testSuites"));
    assertTrue(updates.getLeft().contains("ctx._source.table.displayName = params.displayName"));
    assertTrue(updates.getLeft().contains("ctx._source.remove('disabled')"));
    assertEquals(List.of("suite1"), updates.getRight().get(Entity.FIELD_TEST_SUITES));
    assertEquals("Orders Table", updates.getRight().get(Entity.FIELD_DISPLAY_NAME));
  }

  @Test
  void getScriptWithParamsBuildsFollowerDescriptionAndQueryUsageUpdates() {
    EntityInterface queryEntity = mockEntity(Entity.QUERY, UUID.randomUUID(), "daily_query");
    when(queryEntity.getUpdatedAt()).thenReturn(1234L);
    when(queryEntity.getDescription()).thenReturn("Updated query description");

    Map<String, Object> params = new HashMap<>();
    ChangeDescription changeDescription =
        changeDescription(
            List.of(
                new FieldChange()
                    .withName(Entity.FIELD_FOLLOWERS)
                    .withNewValue(
                        List.of(
                            new EntityReference().withId(UUID.randomUUID()),
                            new EntityReference().withId(UUID.randomUUID()))),
                new FieldChange().withName(Entity.FIELD_DESCRIPTION).withNewValue("ignored")),
            List.of(
                new FieldChange()
                    .withName(Entity.FIELD_USAGE_SUMMARY)
                    .withNewValue(new UsageDetails()),
                new FieldChange()
                    .withName("queryUsedIn")
                    .withNewValue(List.of(Map.of("name", "dashboard")))),
            List.of());

    String script = repository.getScriptWithParams(queryEntity, params, changeDescription);

    assertTrue(script.contains("ctx._source.updatedAt=params.updatedAt;"));
    assertTrue(script.contains("ctx._source.followers.addAll(params.followers);"));
    assertTrue(script.contains("ctx._source.description = params.description;"));
    assertTrue(script.contains("ctx._source.usageSummary = params.usageSummary;"));
    assertTrue(script.contains("ctx._source.queryUsedIn = params.queryUsedIn;"));
    assertEquals(1234L, params.get("updatedAt"));
    assertEquals("Updated query description", params.get(Entity.FIELD_DESCRIPTION));
    assertNotNull(params.get(Entity.FIELD_FOLLOWERS));
    assertNotNull(params.get(Entity.FIELD_USAGE_SUMMARY));
    assertEquals(List.of(Map.of("name", "dashboard")), params.get("queryUsedIn"));
  }

  @Test
  void requiresPropagationRecognizesGlossaryTagCertificationPageAndRelationshipChanges()
      throws Exception {
    EntityInterface glossaryTerm = mockEntity(Entity.GLOSSARY_TERM, UUID.randomUUID(), "Revenue");
    EntityInterface page = mockEntity(Entity.PAGE, UUID.randomUUID(), "docs");
    EntityInterface table = mockEntity(Entity.TABLE, UUID.randomUUID(), "orders");
    Tag certificationTag = mock(Tag.class);
    EntityReference tagReference =
        new EntityReference().withId(UUID.randomUUID()).withType(Entity.TAG).withName("Gold");
    when(certificationTag.getEntityReference()).thenReturn(tagReference);
    when(certificationTag.getId()).thenReturn(tagReference.getId());
    when(certificationTag.getCertification()).thenReturn(new AssetCertification());

    assertTrue(
        invokeRequiresPropagation(
            changeDescription(
                List.of(
                    new FieldChange()
                        .withName(Entity.FIELD_TAGS)
                        .withNewValue(
                            JsonUtils.pojoToJson(
                                List.of(new TagLabel().withTagFQN("Glossary.Revenue"))))),
                List.of(),
                List.of()),
            Entity.GLOSSARY_TERM,
            glossaryTerm));
    assertTrue(
        invokeRequiresPropagation(
            changeDescription(
                List.of(),
                List.of(new FieldChange().withName("parent").withNewValue("{}")),
                List.of()),
            Entity.PAGE,
            page));
    assertTrue(
        invokeRequiresPropagation(
            changeDescription(
                List.of(
                    new FieldChange().withName("upstreamEntityRelationship").withNewValue("{}")),
                List.of(),
                List.of()),
            Entity.TABLE,
            table));
    assertTrue(
        invokeRequiresPropagation(
            changeDescription(
                List.of(),
                List.of(
                    new FieldChange()
                        .withName("certification")
                        .withOldValue("{}")
                        .withNewValue("{}")),
                List.of()),
            Entity.TAG,
            certificationTag));
    assertFalse(invokeRequiresPropagation(null, Entity.TABLE, table));
  }

  @Test
  void propagateToRelatedEntitiesUsesClusteredPageIndexForParentChanges() {
    EntityInterface page = mockEntity(Entity.PAGE, UUID.randomUUID(), "child");
    when(page.getFullyQualifiedName()).thenReturn("docs.parent.child");

    ChangeDescription changeDescription =
        changeDescription(
            List.of(new FieldChange().withName("parent")),
            List.of(
                new FieldChange()
                    .withName("parent")
                    .withOldValue(
                        JsonUtils.pojoToJson(
                            new EntityReference().withFullyQualifiedName("docs.old-parent")))),
            List.of(
                new FieldChange()
                    .withName("parent")
                    .withOldValue(
                        JsonUtils.pojoToJson(
                            new EntityReference().withFullyQualifiedName("docs.removed-parent")))));

    repository.propagateToRelatedEntities(Entity.PAGE, changeDescription, PAGE_MAPPING, page);

    verify(searchClient)
        .updateByFqnPrefix(
            "cluster_page_search_index",
            "child",
            "docs.parent.child",
            Entity.FIELD_FULLY_QUALIFIED_NAME);
    verify(searchClient)
        .updateByFqnPrefix(
            "cluster_page_search_index",
            "docs.old-parent.child",
            "docs.parent.child",
            Entity.FIELD_FULLY_QUALIFIED_NAME);
    verify(searchClient)
        .updateByFqnPrefix(
            "cluster_page_search_index",
            "docs.removed-parent.child",
            "child",
            Entity.FIELD_FULLY_QUALIFIED_NAME);
    verify(searchClient)
        .updateEntity(
            "cluster_page_search_index",
            page.getId().toString(),
            Map.of("field", "parent"),
            "ctx._source.remove(params.field)");
  }

  @Test
  void propagateToRelatedEntitiesUpdatesGlossaryTagFqnsAndDisplayNames() {
    EntityInterface glossaryTerm = mockEntity(Entity.GLOSSARY_TERM, UUID.randomUUID(), "Revenue");
    when(glossaryTerm.getFullyQualifiedName()).thenReturn("BusinessGlossary.Income");

    ChangeDescription changeDescription =
        changeDescription(
            List.of(),
            List.of(
                new FieldChange()
                    .withName(Entity.FIELD_NAME)
                    .withOldValue("Revenue")
                    .withNewValue("Income"),
                new FieldChange()
                    .withName(Entity.FIELD_DISPLAY_NAME)
                    .withOldValue("Revenue Display")
                    .withNewValue("Income Display")),
            List.of());

    repository.propagateToRelatedEntities(
        Entity.GLOSSARY_TERM, changeDescription, TABLE_MAPPING, glossaryTerm);

    verify(searchClient)
        .updateByFqnPrefix(
            SearchClient.GLOBAL_SEARCH_ALIAS,
            "BusinessGlossary.Revenue",
            "BusinessGlossary.Income",
            "tags.tagFQN");
    verify(searchClient)
        .updateChildren(
            eq(SearchClient.GLOBAL_SEARCH_ALIAS),
            eq(
                new org.apache.commons.lang3.tuple.ImmutablePair<>(
                    "tags.tagFQN", "BusinessGlossary.Income")),
            any(Pair.class));
  }

  @Test
  void bulkIndexPipelineExecutionsBuildsExecutionDocuments() throws IOException {
    Pipeline pipeline = mock(Pipeline.class);
    PipelineStatus pipelineStatus = mock(PipelineStatus.class);
    EntityReference service = new EntityReference().withName("airflow");
    when(pipeline.getId()).thenReturn(UUID.randomUUID());
    when(pipeline.getFullyQualifiedName()).thenReturn("service.pipeline");
    when(pipeline.getName()).thenReturn("pipeline");
    when(pipeline.getService()).thenReturn(service);
    when(pipeline.getServiceType())
        .thenReturn(
            org.openmetadata.schema.api.services.CreatePipelineService.PipelineServiceType.Airflow);
    when(pipelineStatus.getExecutionId()).thenReturn("run-1");
    when(pipelineStatus.getTimestamp()).thenReturn(100L);
    when(pipelineStatus.getEndTime()).thenReturn(160L);
    when(pipelineStatus.getVersion()).thenReturn("1.2");
    when(pipelineStatus.getExecutionStatus())
        .thenReturn(org.openmetadata.schema.type.StatusType.Successful);

    repository.bulkIndexPipelineExecutions(pipeline, List.of(pipelineStatus));

    @SuppressWarnings("unchecked")
    ArgumentCaptor<List<Map<String, String>>> docsCaptor = ArgumentCaptor.forClass(List.class);
    verify(searchClient)
        .createEntities(eq("cluster_pipeline_status_search_index"), docsCaptor.capture());
    assertEquals(1, docsCaptor.getValue().size());
    String docId = docsCaptor.getValue().getFirst().keySet().iterator().next();
    assertEquals("service.pipeline_run-1_100", docId);
    assertTrue(
        docsCaptor.getValue().getFirst().values().iterator().next().contains("\"runtime\":60"));
  }

  @Test
  void updateEntityLoadsEntityFromRepositoryAndUpdatesIndex() {
    SearchRepository spyRepository = spy(repository);
    EntityReference entityReference =
        new EntityReference().withId(UUID.randomUUID()).withType(Entity.TABLE);
    @SuppressWarnings("unchecked")
    org.openmetadata.service.jdbi3.EntityRepository<EntityInterface> entityRepository =
        mock(org.openmetadata.service.jdbi3.EntityRepository.class);
    EntityInterface entity = mockEntity(Entity.TABLE, entityReference.getId(), "orders");

    doNothing().when(spyRepository).updateEntityIndex(entity);

    try (var entityMock = mockStatic(Entity.class)) {
      entityMock.when(() -> Entity.getEntityRepository(Entity.TABLE)).thenReturn(entityRepository);
      when(entityRepository.getFields("*")).thenReturn(null);
      when(entityRepository.get(null, entityReference.getId(), null)).thenReturn(entity);

      spyRepository.updateEntity(entityReference);
    }

    verify(spyRepository).updateEntityIndex(entity);
  }

  @Test
  void domainUpdateWrappersDelegateToSearchClient() {
    EntityReference domain =
        new EntityReference().withId(UUID.randomUUID()).withType(Entity.DOMAIN);
    List<String> oldDomains = List.of("old.domain");
    List<EntityReference> newDomains = List.of(domain);
    List<UUID> assetIds = List.of(UUID.randomUUID(), UUID.randomUUID());

    repository.updateAssetDomainsForDataProduct("dataProduct", oldDomains, newDomains);
    repository.updateAssetDomainsByIds(assetIds, oldDomains, newDomains);
    repository.updateDomainFqnByPrefix("old.domain", "new.domain");
    repository.updateAssetDomainFqnByPrefix("old.domain", "new.domain");

    verify(searchClient).updateAssetDomainsForDataProduct("dataProduct", oldDomains, newDomains);
    verify(searchClient).updateAssetDomainsByIds(assetIds, oldDomains, newDomains);
    verify(searchClient).updateDomainFqnByPrefix("old.domain", "new.domain");
    verify(searchClient).updateAssetDomainFqnByPrefix("old.domain", "new.domain");
  }

  @Test
  void createIndexesFinalizesEachRecreatedEntityAndContinuesOnFailure() {
    SearchRepository spyRepository = spy(repository);
    RecreateIndexHandler recreateIndexHandler = mock(RecreateIndexHandler.class);
    ReindexContext context = mock(ReindexContext.class);

    doReturn(recreateIndexHandler).when(spyRepository).createReindexHandler();
    when(recreateIndexHandler.reCreateIndexes(any())).thenReturn(context);
    when(context.getEntities())
        .thenReturn(new LinkedHashSet<>(List.of(Entity.TABLE, Entity.DOMAIN)));
    when(context.getOriginalIndex(any()))
        .thenAnswer(invocation -> java.util.Optional.of("original_" + invocation.getArgument(0)));
    when(context.getCanonicalIndex(any()))
        .thenAnswer(invocation -> java.util.Optional.of("canonical_" + invocation.getArgument(0)));
    when(context.getStagedIndex(any()))
        .thenAnswer(invocation -> java.util.Optional.of("staged_" + invocation.getArgument(0)));
    when(context.getCanonicalAlias(any()))
        .thenAnswer(invocation -> java.util.Optional.of("alias_" + invocation.getArgument(0)));
    when(context.getExistingAliases(any()))
        .thenAnswer(invocation -> Set.of("existing_" + invocation.getArgument(0)));
    when(context.getParentAliases(any()))
        .thenAnswer(invocation -> List.of("parent_" + invocation.getArgument(0)));

    doNothing()
        .doThrow(new RuntimeException("boom"))
        .when(recreateIndexHandler)
        .finalizeReindex(any(EntityReindexContext.class), eq(true));

    spyRepository.createIndexes();

    @SuppressWarnings("unchecked")
    ArgumentCaptor<EntityReindexContext> contextCaptor =
        ArgumentCaptor.forClass(EntityReindexContext.class);
    verify(recreateIndexHandler, org.mockito.Mockito.times(2))
        .finalizeReindex(contextCaptor.capture(), eq(true));
    assertEquals(Entity.TABLE, contextCaptor.getAllValues().get(0).getEntityType());
    assertEquals("canonical_table", contextCaptor.getAllValues().get(0).getCanonicalIndex());
    assertEquals(
        Set.of("existing_table"), contextCaptor.getAllValues().get(0).getExistingAliases());
    assertEquals(Set.of("parent_table"), contextCaptor.getAllValues().get(0).getParentAliases());
    assertEquals(Entity.DOMAIN, contextCaptor.getAllValues().get(1).getEntityType());
  }

  @Test
  void deleteEntityIndexRemovesDomainReferencesAndChildren() throws Exception {
    EntityInterface domain = mockEntity(Entity.DOMAIN, UUID.randomUUID(), "finance");

    repository.deleteEntityIndex(domain);

    verify(searchClient).deleteEntity("cluster_domain_search_index", domain.getId().toString());
    verify(searchClient)
        .updateChildren(
            SearchClient.GLOBAL_SEARCH_ALIAS,
            new org.apache.commons.lang3.tuple.ImmutablePair<>(
                "domain.id", domain.getId().toString()),
            new org.apache.commons.lang3.tuple.ImmutablePair<>(
                SearchClient.REMOVE_DOMAINS_CHILDREN_SCRIPT, null));
    verify(searchClient)
        .deleteEntityByFields(
            List.of("cluster_domain_search_index"),
            List.of(
                new org.apache.commons.lang3.tuple.ImmutablePair<>(
                    "domain.id", domain.getId().toString())));
  }

  @Test
  void deleteEntityIndexRemovesDataProductReferences() throws Exception {
    EntityInterface dataProduct = mockEntity(Entity.DATA_PRODUCT, UUID.randomUUID(), "revenue");

    repository.deleteEntityIndex(dataProduct);

    verify(searchClient)
        .deleteEntity("cluster_data_product_search_index", dataProduct.getId().toString());
    verify(searchClient)
        .updateChildren(
            SearchClient.GLOBAL_SEARCH_ALIAS,
            new org.apache.commons.lang3.tuple.ImmutablePair<>(
                "dataProducts.id", dataProduct.getId().toString()),
            new org.apache.commons.lang3.tuple.ImmutablePair<>(
                SearchClient.REMOVE_DATA_PRODUCTS_CHILDREN_SCRIPT,
                Map.of("fqn", dataProduct.getFullyQualifiedName())));
  }

  @Test
  void deleteEntityIndexHandlesBasicTestSuitesByDeletingChildren() throws Exception {
    TestSuite testSuite = mock(TestSuite.class);
    EntityReference entityReference =
        new EntityReference()
            .withId(UUID.randomUUID())
            .withType(Entity.TEST_SUITE)
            .withName("suite");
    when(testSuite.getEntityReference()).thenReturn(entityReference);
    when(testSuite.getId()).thenReturn(entityReference.getId());
    when(testSuite.getBasic()).thenReturn(true);

    repository.deleteEntityIndex(testSuite);

    verify(searchClient)
        .deleteEntity("cluster_test_suite_search_index", entityReference.getId().toString());
    verify(searchClient)
        .deleteEntityByFields(
            eq(List.of("cluster_test_case_search_index")),
            eq(
                List.of(
                    new org.apache.commons.lang3.tuple.ImmutablePair<>(
                        "testSuite.id", entityReference.getId().toString()))));
  }

  @Test
  void deleteEntityIndexHandlesNonBasicTestSuitesByUpdatingChildren() throws Exception {
    TestSuite testSuite = mock(TestSuite.class);
    EntityReference entityReference =
        new EntityReference()
            .withId(UUID.randomUUID())
            .withType(Entity.TEST_SUITE)
            .withName("suite");
    when(testSuite.getEntityReference()).thenReturn(entityReference);
    when(testSuite.getId()).thenReturn(entityReference.getId());
    when(testSuite.getBasic()).thenReturn(false);

    repository.deleteEntityIndex(testSuite);

    verify(searchClient)
        .updateChildren(
            eq(List.of("cluster_test_case_search_index")),
            eq(
                new org.apache.commons.lang3.tuple.ImmutablePair<>(
                    "testSuites.id", entityReference.getId().toString())),
            eq(
                new org.apache.commons.lang3.tuple.ImmutablePair<>(
                    SearchClient.REMOVE_TEST_SUITE_CHILDREN_SCRIPT,
                    Map.of("suiteId", entityReference.getId().toString()))));
  }

  @Test
  void softDeleteOrRestoreEntityIndexPropagatesServiceDeletionToChildren() throws Exception {
    EntityInterface service = mockEntity(Entity.DATABASE_SERVICE, UUID.randomUUID(), "service");
    String scriptTxt = String.format(SearchClient.SOFT_DELETE_RESTORE_SCRIPT, true);

    repository.softDeleteOrRestoreEntityIndex(service, true);

    verify(searchClient)
        .softDeleteOrRestoreEntity(
            "cluster_database_service_search_index", service.getId().toString(), scriptTxt);
    verify(searchClient)
        .softDeleteOrRestoreChildren(
            List.of("cluster_database_search_index"),
            scriptTxt,
            List.of(
                new org.apache.commons.lang3.tuple.ImmutablePair<>(
                    "service.id", service.getId().toString())));
  }

  @Test
  void softDeleteOrRestoredChildrenUsesEntityTypeFieldForGenericEntities() throws IOException {
    EntityReference table = new EntityReference().withId(UUID.randomUUID()).withType(Entity.TABLE);
    String scriptTxt = String.format(SearchClient.SOFT_DELETE_RESTORE_SCRIPT, false);

    repository.softDeleteOrRestoredChildren(table, TABLE_MAPPING, false);

    verify(searchClient)
        .softDeleteOrRestoreChildren(
            List.of("cluster_column_search_index"),
            scriptTxt,
            List.of(
                new org.apache.commons.lang3.tuple.ImmutablePair<>(
                    "table.id", table.getId().toString())));
  }

  @Test
  void getScriptWithParamsBuildsExtensionAndDescriptionUpdates() {
    EntityInterface entity = mockEntity(Entity.TABLE, UUID.randomUUID(), "orders");
    when(entity.getUpdatedAt()).thenReturn(99L);
    when(entity.getDescription()).thenReturn("new description");
    when(entity.getExtension()).thenReturn(Map.of("reviewer", "alice"));

    Map<String, Object> params = new HashMap<>();
    ChangeDescription changeDescription =
        changeDescription(
            List.of(
                new FieldChange().withName("extension").withNewValue(Map.of("reviewer", "alice"))),
            List.of(new FieldChange().withName(Entity.FIELD_DESCRIPTION).withNewValue("ignored")),
            List.of());

    String script = repository.getScriptWithParams(entity, params, changeDescription);

    assertTrue(script.contains("ctx._source.updatedAt=params.updatedAt;"));
    assertTrue(
        script.contains("ctx._source.customPropertiesTyped = params.customPropertiesTyped;"));
    assertTrue(script.contains("ctx._source.extension = params.extension;"));
    assertTrue(script.contains("ctx._source.description = params.description;"));
    assertEquals(99L, params.get("updatedAt"));
    assertEquals("new description", params.get(Entity.FIELD_DESCRIPTION));
    assertEquals(Map.of("reviewer", "alice"), params.get("extension"));
    assertNotNull(params.get("customPropertiesTyped"));
  }

  @Test
  void getScriptWithParamsRemovesFollowersAndDescriptions() {
    EntityInterface entity = mockEntity(Entity.TABLE, UUID.randomUUID(), "orders");
    EntityReference removedFollower = new EntityReference().withId(UUID.randomUUID());
    Map<String, Object> params = new HashMap<>();
    ChangeDescription changeDescription =
        changeDescription(
            List.of(),
            List.of(),
            List.of(
                new FieldChange()
                    .withName(Entity.FIELD_FOLLOWERS)
                    .withOldValue(List.of(removedFollower)),
                new FieldChange()
                    .withName(Entity.FIELD_DESCRIPTION)
                    .withOldValue("old description")));

    String script = repository.getScriptWithParams(entity, params, changeDescription);

    assertTrue(
        script.contains(
            "ctx._source.followers.removeAll(Collections.singleton(params.followers));"));
    assertTrue(script.contains("ctx._source.description = null;"));
    assertEquals(removedFollower.getId().toString(), params.get(Entity.FIELD_FOLLOWERS));
  }

  @Test
  void getEntitiesContainingFQNFromESBuildsSearchRequestAndParsesResponse() throws Exception {
    UUID firstId = UUID.randomUUID();
    UUID secondId = UUID.randomUUID();
    String payload =
        "{\"hits\":{\"hits\":["
            + "{\"_source\":{\"id\":\""
            + firstId
            + "\",\"fullyQualifiedName\":\"svc.db.schema.orders\",\"entityType\":\"table\"}},"
            + "{\"_source\":{\"id\":\""
            + secondId
            + "\",\"fullyQualifiedName\":\"svc.db.schema.customers\",\"entityType\":\"table\"}},"
            + "{\"_source\":{\"id\":\""
            + firstId
            + "\",\"fullyQualifiedName\":\"svc.db.schema.orders\",\"entityType\":\"table\"}},"
            + "{\"_source\":{\"id\":\""
            + UUID.randomUUID()
            + "\",\"fullyQualifiedName\":\"\",\"entityType\":\"table\"}}]}}";
    when(searchClient.search(any(SearchRequest.class), eq(null)))
        .thenReturn(Response.ok(payload).build());

    List<EntityReference> references =
        repository.getEntitiesContainingFQNFromES("svc.db.schema", 10, "table_search_index");

    ArgumentCaptor<SearchRequest> requestCaptor = ArgumentCaptor.forClass(SearchRequest.class);
    verify(searchClient).search(requestCaptor.capture(), eq(null));
    assertEquals("cluster_table_search_index", requestCaptor.getValue().getIndex());
    assertTrue(requestCaptor.getValue().getQueryFilter().contains("svc.db.schema"));
    assertEquals(2, references.size());
    assertTrue(references.stream().anyMatch(reference -> firstId.equals(reference.getId())));
    assertTrue(references.stream().anyMatch(reference -> secondId.equals(reference.getId())));
  }

  @Test
  void searchLineageForExportBuildsRequestFromParameters() throws IOException {
    SearchLineageResult result = new SearchLineageResult();
    when(searchClient.searchLineage(any(SearchLineageRequest.class))).thenReturn(result);

    SearchLineageResult actual =
        repository.searchLineageForExport(
            "svc.db.schema.orders", 2, 3, "{\"term\":true}", true, Entity.TABLE);

    ArgumentCaptor<SearchLineageRequest> requestCaptor =
        ArgumentCaptor.forClass(SearchLineageRequest.class);
    verify(searchClient).searchLineage(requestCaptor.capture());
    assertEquals(result, actual);
    assertEquals("svc.db.schema.orders", requestCaptor.getValue().getFqn());
    assertEquals(2, requestCaptor.getValue().getUpstreamDepth());
    assertEquals(3, requestCaptor.getValue().getDownstreamDepth());
    assertEquals("{\"term\":true}", requestCaptor.getValue().getQueryFilter());
    assertTrue(requestCaptor.getValue().getIncludeDeleted());
    assertEquals(
        SearchUtils.isConnectedVia(Entity.TABLE), requestCaptor.getValue().getIsConnectedVia());
  }

  @Test
  void initializeNLQServiceSupportsDisabledAndEnabledModes() {
    NaturalLanguageSearchConfiguration disabledConfig =
        new NaturalLanguageSearchConfiguration().withEnabled(false);
    ElasticSearchConfiguration config = new ElasticSearchConfiguration();
    config.setNaturalLanguageSearch(disabledConfig);

    repository.initializeNLQService(config);
    assertNull(repository.nlqService);

    NLQService nlqService = mock(NLQService.class);
    NaturalLanguageSearchConfiguration enabledConfig =
        new NaturalLanguageSearchConfiguration()
            .withEnabled(true)
            .withProviderClass("test.Provider");
    config.setNaturalLanguageSearch(enabledConfig);
    try (var nlqServiceFactoryMock = mockStatic(NLQServiceFactory.class)) {
      nlqServiceFactoryMock
          .when(() -> NLQServiceFactory.createNLQService(config))
          .thenReturn(nlqService);

      repository.initializeNLQService(config);
    }

    assertEquals(nlqService, repository.nlqService);
  }

  @Test
  void initializeLineageComponentsDelegatesWhenSearchClientExists() throws Exception {
    repository.initializeLineageComponents();

    verify(searchClient).initializeLineageBuilders();

    setPrivateField(repository, "searchClient", null);
    repository.initializeLineageComponents();
  }

  @Test
  void reformatVectorIndexWithDimensionAddsMetaAndPreservesInvalidJson() throws Exception {
    EmbeddingClient embeddingClient = mock(EmbeddingClient.class);
    when(embeddingClient.getModelId()).thenReturn("test-model");
    setPrivateField(repository, "embeddingClient", embeddingClient);

    String updated =
        (String)
            invokePrivateMethod(
                repository,
                "reformatVectorIndexWithDimension",
                new Class<?>[] {String.class, int.class},
                "{\"mappings\":{}}",
                768);

    assertTrue(updated.contains("\"embedding_model\":\"test-model\""));
    assertTrue(updated.contains("\"embedding_dimension\":768"));
    assertEquals(
        "not-json",
        invokePrivateMethod(
            repository,
            "reformatVectorIndexWithDimension",
            new Class<?>[] {String.class, int.class},
            "not-json",
            384));
  }

  @Test
  void createEmbeddingClientRejectsUnsupportedOrIncompleteConfigurations() {
    ElasticSearchConfiguration config = new ElasticSearchConfiguration();
    config.setNaturalLanguageSearch(
        new NaturalLanguageSearchConfiguration().withEmbeddingProvider("bedrock"));
    assertThrows(IllegalStateException.class, () -> repository.createEmbeddingClient(config));

    config.setNaturalLanguageSearch(
        new NaturalLanguageSearchConfiguration().withEmbeddingProvider("openai"));
    assertThrows(IllegalStateException.class, () -> repository.createEmbeddingClient(config));

    config.setNaturalLanguageSearch(
        new NaturalLanguageSearchConfiguration().withEmbeddingProvider("djl"));
    assertThrows(IllegalStateException.class, () -> repository.createEmbeddingClient(config));

    config.setNaturalLanguageSearch(
        new NaturalLanguageSearchConfiguration().withEmbeddingProvider("unknown"));
    assertThrows(IllegalArgumentException.class, () -> repository.createEmbeddingClient(config));
  }

  @Test
  void initializeVectorSearchServiceSkipsWhenEmbeddingsAreDisabled() {
    SearchRepository spyRepository = spy(repository);
    doReturn(false).when(spyRepository).isVectorEmbeddingEnabled();

    spyRepository.initializeVectorSearchService();

    assertNull(spyRepository.getEmbeddingClient());
    assertNull(spyRepository.getVectorIndexService());
    assertNull(spyRepository.getVectorEmbeddingHandler());
    verifyNoInteractions(searchClient);
  }

  @Test
  void initializeVectorSearchServiceInitializesOpenSearchVectorSupport() throws Exception {
    NaturalLanguageSearchConfiguration nlConfig =
        new NaturalLanguageSearchConfiguration().withEmbeddingProvider("openai");
    SearchRepository openSearchRepository =
        newRepository(
            Map.of(Entity.TABLE, TABLE_MAPPING),
            "cluster",
            ElasticSearchConfiguration.SearchType.OPENSEARCH,
            nlConfig);
    SearchRepository spyRepository = spy(openSearchRepository);
    OpenSearchClient openSearchClient = mock(OpenSearchClient.class);
    os.org.opensearch.client.opensearch.OpenSearchClient rawClient =
        mock(os.org.opensearch.client.opensearch.OpenSearchClient.class);
    EmbeddingClient embeddingClient = mock(EmbeddingClient.class);
    OpenSearchVectorService vectorService = mock(OpenSearchVectorService.class);

    when(openSearchClient.getNewClient()).thenReturn(rawClient);
    when(embeddingClient.getDimension()).thenReturn(1536);
    doReturn(true).when(spyRepository).isVectorEmbeddingEnabled();
    doReturn(embeddingClient)
        .when(spyRepository)
        .createEmbeddingClient(any(ElasticSearchConfiguration.class));
    setPrivateField(spyRepository, "searchClient", openSearchClient);

    try (var settingsCacheMock = mockStatic(SettingsCache.class);
        var vectorServiceMock = mockStatic(OpenSearchVectorService.class)) {
      settingsCacheMock
          .when(() -> SettingsCache.getSetting(SettingsType.SEARCH_SETTINGS, SearchSettings.class))
          .thenReturn(null);
      vectorServiceMock
          .when(() -> OpenSearchVectorService.init(rawClient, embeddingClient))
          .thenAnswer(invocation -> null);
      vectorServiceMock.when(OpenSearchVectorService::getInstance).thenReturn(vectorService);

      spyRepository.initializeVectorSearchService();
    }

    assertSame(embeddingClient, spyRepository.getEmbeddingClient());
    assertSame(vectorService, spyRepository.getVectorIndexService());
    assertNotNull(spyRepository.getVectorEmbeddingHandler());
    verify(vectorService).ensureHybridSearchPipeline(0.6, 0.4);
  }

  @Test
  void updateHybridSearchPipelineDelegatesOnlyForOpenSearchVectorService() throws Exception {
    OpenSearchVectorService vectorService = mock(OpenSearchVectorService.class);
    setPrivateField(repository, "vectorIndexService", vectorService);

    repository.updateHybridSearchPipeline(0.7, 0.3);

    verify(vectorService).ensureHybridSearchPipeline(0.7, 0.3);

    setPrivateField(repository, "vectorIndexService", mock(VectorIndexService.class));
    repository.updateHybridSearchPipeline(0.8, 0.2);
  }

  @Test
  void requestAndAggregationWrappersDelegateToSearchClient() throws IOException {
    SearchRequest request = new SearchRequest().withQuery("orders");
    SubjectContext subjectContext = mock(SubjectContext.class);
    AggregationRequest aggregationRequest = new AggregationRequest();
    Response response = Response.ok("payload").build();
    QueryCostSearchResult queryCostResult = mock(QueryCostSearchResult.class);

    when(searchClient.previewSearch(request, subjectContext, null)).thenReturn(response);
    when(searchClient.searchWithNLQ(request, subjectContext)).thenReturn(response);
    when(searchClient.searchWithDirectQuery(request, subjectContext)).thenReturn(response);
    when(searchClient.getDocByID("idx", "00000000-0000-0000-0000-000000000123"))
        .thenReturn(response);
    when(searchClient.searchBySourceUrl("https://src")).thenReturn(response);
    when(searchClient.aggregate(aggregationRequest)).thenReturn(response);
    when(searchClient.getEntityTypeCounts(request, "global")).thenReturn(response);
    when(searchClient.getQueryCostRecords("service")).thenReturn(queryCostResult);

    assertSame(response, repository.previewSearch(request, subjectContext, null));
    assertSame(response, repository.searchWithNLQ(request, subjectContext));
    assertSame(response, repository.searchWithDirectQuery(request, subjectContext));
    assertSame(
        response,
        repository.getDocument("idx", UUID.fromString("00000000-0000-0000-0000-000000000123")));
    assertSame(response, repository.searchBySourceUrl("https://src"));
    assertSame(response, repository.aggregate(aggregationRequest));
    assertSame(response, repository.getEntityTypeCounts(request, "global"));
    assertSame(queryCostResult, repository.getQueryCostRecords("service"));
  }

  @Test
  void listAndPaginationWrappersUseMappedIndices() throws IOException {
    SearchListFilter filter = mock(SearchListFilter.class);
    SearchSortFilter sortFilter = mock(SearchSortFilter.class);
    SearchResultListMapper listMapper = mock(SearchResultListMapper.class);
    SubjectContext subjectContext = mock(SubjectContext.class);

    when(filter.getCondition(Entity.TABLE)).thenReturn("status = 'Active'");
    when(searchClient.listWithOffset(
            "status = 'Active'", 25, 10, "cluster_table_search_index", sortFilter, "orders", null))
        .thenReturn(listMapper);
    when(searchClient.listWithOffset(
            "status = 'Active'",
            25,
            10,
            "cluster_table_search_index",
            sortFilter,
            "orders",
            "query",
            subjectContext))
        .thenReturn(listMapper);
    when(searchClient.listWithDeepPagination(
            "cluster_table_search_index",
            "orders",
            "status = 'Active'",
            new String[] {"name"},
            sortFilter,
            15,
            new Object[] {"after"}))
        .thenReturn(listMapper);

    assertSame(
        listMapper, repository.listWithOffset(filter, 25, 10, Entity.TABLE, sortFilter, "orders"));
    assertSame(
        listMapper,
        repository.listWithOffset(
            filter, 25, 10, Entity.TABLE, sortFilter, "orders", "query", subjectContext));
    assertSame(
        listMapper,
        repository.listWithDeepPagination(
            Entity.TABLE,
            "orders",
            "status = 'Active'",
            new String[] {"name"},
            sortFilter,
            15,
            new Object[] {"after"}));
  }

  @Test
  void lineageAndRelationshipWrappersDelegateToSearchClient() throws IOException {
    SearchLineageRequest lineageRequest = new SearchLineageRequest().withFqn("svc.db.orders");
    EntityCountLineageRequest entityCountRequest = new EntityCountLineageRequest();
    SearchEntityRelationshipRequest entityRelationshipRequest =
        new SearchEntityRelationshipRequest();
    SearchLineageResult lineageResult = new SearchLineageResult();
    SearchEntityRelationshipResult entityRelationshipResult = new SearchEntityRelationshipResult();
    LineagePaginationInfo paginationInfo = new LineagePaginationInfo();
    Response response = Response.ok("lineage").build();

    when(searchClient.searchLineage(lineageRequest)).thenReturn(lineageResult);
    when(searchClient.searchPlatformLineage("alias", "{}", false)).thenReturn(lineageResult);
    when(searchClient.searchLineageWithDirection(lineageRequest)).thenReturn(lineageResult);
    when(searchClient.getLineagePaginationInfo("svc.db.orders", 1, 2, "{}", false, Entity.TABLE))
        .thenReturn(paginationInfo);
    when(searchClient.searchLineageByEntityCount(entityCountRequest)).thenReturn(lineageResult);
    when(searchClient.searchEntityRelationship("svc.db.orders", 1, 2, "{}", false))
        .thenReturn(response);
    when(searchClient.searchDataQualityLineage("svc.db.orders", 1, "{}", false))
        .thenReturn(response);
    when(searchClient.searchSchemaEntityRelationship("svc.db.orders", 1, 2, "{}", false))
        .thenReturn(response);
    when(searchClient.searchEntityRelationship(entityRelationshipRequest))
        .thenReturn(entityRelationshipResult);
    when(searchClient.searchEntityRelationshipWithDirection(entityRelationshipRequest))
        .thenReturn(entityRelationshipResult);

    assertSame(lineageResult, repository.searchLineage(lineageRequest));
    assertSame(lineageResult, repository.searchPlatformLineage("alias", "{}", false));
    assertSame(lineageResult, repository.searchLineageWithDirection(lineageRequest));
    assertSame(
        paginationInfo,
        repository.getLineagePaginationInfo("svc.db.orders", 1, 2, "{}", false, Entity.TABLE));
    assertSame(lineageResult, repository.searchLineageByEntityCount(entityCountRequest));
    assertSame(response, repository.searchEntityRelationship("svc.db.orders", 1, 2, "{}", false));
    assertSame(response, repository.searchDataQualityLineage("svc.db.orders", 1, "{}", false));
    assertSame(
        response, repository.searchSchemaEntityRelationship("svc.db.orders", 1, 2, "{}", false));
    assertSame(
        entityRelationshipResult, repository.searchEntityRelationship(entityRelationshipRequest));
    assertSame(
        entityRelationshipResult,
        repository.searchEntityRelationshipWithDirection(entityRelationshipRequest));
  }

  @Test
  void createBulkSinkUsesSearchTypeSpecificImplementation() {
    when(searchClient.getSearchType()).thenReturn(ElasticSearchConfiguration.SearchType.OPENSEARCH);
    try (MockedConstruction<OpenSearchBulkSink> ignored =
        mockConstruction(OpenSearchBulkSink.class)) {
      assertNotNull(repository.createBulkSink(10, 2, 1024L));
    }

    when(searchClient.getSearchType())
        .thenReturn(ElasticSearchConfiguration.SearchType.ELASTICSEARCH);
    try (MockedConstruction<ElasticSearchBulkSink> ignored =
        mockConstruction(ElasticSearchBulkSink.class)) {
      assertNotNull(repository.createBulkSink(10, 2, 1024L));
    }
  }

  @Test
  void createReindexHandlerAndDeleteRelationshipHelpersUseExpectedImplementations() {
    repository.createReindexHandler();

    repository.deleteRelationshipFromSearch(
        UUID.fromString("00000000-0000-0000-0000-000000000001"),
        UUID.fromString("00000000-0000-0000-0000-000000000002"));

    verify(searchClient)
        .updateChildren(
            eq(SearchClient.GLOBAL_SEARCH_ALIAS),
            eq(
                new org.apache.commons.lang3.tuple.ImmutablePair<>(
                    "upstreamEntityRelationship.docId.keyword",
                    "00000000-0000-0000-0000-000000000001-00000000-0000-0000-0000-000000000002")),
            any(org.apache.commons.lang3.tuple.Pair.class));
    assertInstanceOf(RecreateWithEmbeddings.class, repository.createReindexHandler());
  }

  @Test
  void reportingWrappersDelegateToSearchClient() throws IOException {
    SearchAggregation searchAggregation = mock(SearchAggregation.class);
    SearchListFilter filter = mock(SearchListFilter.class);
    SubjectContext subjectContext = mock(SubjectContext.class);
    jakarta.json.JsonObject aggregationResult = mock(jakarta.json.JsonObject.class);
    DataQualityReport report = new DataQualityReport();
    Response response = Response.ok("chart").build();
    org.openmetadata.schema.api.entityRelationship.SearchSchemaEntityRelationshipResult
        schemaResult =
            new org.openmetadata
                .schema
                .api
                .entityRelationship
                .SearchSchemaEntityRelationshipResult();

    when(filter.getCondition(Entity.TABLE)).thenReturn("deleted = false");
    when(searchClient.searchByField("name", "orders", "table", false)).thenReturn(response);
    when(searchClient.aggregate("query", Entity.TABLE, searchAggregation, "deleted = false"))
        .thenReturn(aggregationResult);
    when(searchClient.genericAggregation("query", "table", searchAggregation)).thenReturn(report);
    when(searchClient.genericAggregation("query", "table", searchAggregation, subjectContext))
        .thenReturn(report);
    when(searchClient.listDataInsightChartResult(
            10L,
            20L,
            "tier1",
            "teamA",
            DataInsightChartResult.DataInsightChartType.UNUSED_ASSETS,
            25,
            5,
            "{}",
            "report_index"))
        .thenReturn(response);
    when(searchClient.getSchemaEntityRelationship("svc.db.schema", "{}", "*", 1, 2, 3, 4, false))
        .thenReturn(schemaResult);

    assertSame(response, repository.searchByField("name", "orders", "table", false));
    assertSame(
        aggregationResult, repository.aggregate("query", Entity.TABLE, searchAggregation, filter));
    assertSame(report, repository.genericAggregation("query", "table", searchAggregation));
    assertSame(
        report, repository.genericAggregation("query", "table", searchAggregation, subjectContext));
    assertSame(
        response,
        repository.listDataInsightChartResult(
            10L,
            20L,
            "tier1",
            "teamA",
            DataInsightChartResult.DataInsightChartType.UNUSED_ASSETS,
            25,
            5,
            "{}",
            "report_index"));
    assertSame(
        schemaResult,
        repository.getSchemaEntityRelationship("svc.db.schema", "{}", "*", 1, 2, 3, 4, false));
  }

  @Test
  void repositoryMetadataHelpersExposeUnderlyingState() throws Exception {
    Object highLevelClient = new Object();
    EmbeddingClient embeddingClient = mock(EmbeddingClient.class);

    when(searchClient.getHighLevelClient()).thenReturn(highLevelClient);
    when(embeddingClient.getModelId()).thenReturn("text-embedding-3-large");
    setPrivateField(repository, "embeddingClient", embeddingClient);

    assertEquals(
        Set.of(
            Entity.TABLE,
            Entity.DOMAIN,
            Entity.DATA_PRODUCT,
            Entity.DATABASE_SERVICE,
            Entity.TAG,
            Entity.GLOSSARY_TERM,
            Entity.GLOSSARY,
            Entity.CLASSIFICATION,
            Entity.PAGE,
            Entity.TEST_SUITE,
            Entity.QUERY),
        repository.getSearchEntities());
    assertSame(highLevelClient, repository.getHighLevelClient());
    assertEquals("text-embedding-3-large", repository.getModelIdentifier());
  }

  @Test
  void repositoryLifecycleHelpersDelegateToInternalOperations() {
    SearchRepository spyRepository =
        spy(
            newRepository(
                Map.ofEntries(
                    Map.entry(Entity.TABLE, TABLE_MAPPING),
                    Map.entry(Entity.DOMAIN, DOMAIN_MAPPING),
                    Map.entry(Entity.DATA_PRODUCT, DATA_PRODUCT_MAPPING)),
                "cluster"));

    doNothing().when(spyRepository).updateIndex(any(IndexMapping.class));
    doNothing().when(spyRepository).initializeVectorSearchService();

    spyRepository.updateIndexes();
    spyRepository.prepareForReindex();

    verify(spyRepository).updateIndex(TABLE_MAPPING);
    verify(spyRepository).updateIndex(DOMAIN_MAPPING);
    verify(spyRepository).updateIndex(DATA_PRODUCT_MAPPING);
    verify(spyRepository).initializeVectorSearchService();
  }

  private SearchRepository newRepository(
      Map<String, IndexMapping> entityIndexMap, String clusterAlias) {
    return newRepository(
        entityIndexMap, clusterAlias, ElasticSearchConfiguration.SearchType.ELASTICSEARCH, null);
  }

  private SearchRepository newRepository(
      Map<String, IndexMapping> entityIndexMap,
      String clusterAlias,
      ElasticSearchConfiguration.SearchType searchType,
      NaturalLanguageSearchConfiguration nlConfig) {
    ElasticSearchConfiguration config = new ElasticSearchConfiguration();
    config.setClusterAlias(clusterAlias);
    config.setSearchType(searchType);
    config.setNaturalLanguageSearch(nlConfig);

    IndexMappingLoader mappingLoader = mock(IndexMappingLoader.class);
    when(mappingLoader.getIndexMapping()).thenReturn(entityIndexMap);
    EntityLifecycleEventDispatcher dispatcher = mock(EntityLifecycleEventDispatcher.class);
    TestSearchRepository.overrideSearchClient(searchClient);
    TestSearchRepository.overrideSearchIndexFactory(searchIndexFactory);
    try (var loaderMock = mockStatic(IndexMappingLoader.class);
        var dispatcherMock = mockStatic(EntityLifecycleEventDispatcher.class)) {
      loaderMock.when(IndexMappingLoader::getInstance).thenReturn(mappingLoader);
      dispatcherMock.when(EntityLifecycleEventDispatcher::getInstance).thenReturn(dispatcher);
      return new TestSearchRepository(config, 4);
    } finally {
      TestSearchRepository.clearOverrides();
    }
  }

  private EntityInterface mockEntity(String entityType, UUID id, String name) {
    EntityInterface entity = mock(EntityInterface.class);
    EntityReference entityReference =
        new EntityReference().withId(id).withType(entityType).withName(name);
    when(entity.getEntityReference()).thenReturn(entityReference);
    when(entity.getId()).thenReturn(id);
    when(entity.getName()).thenReturn(name);
    when(entity.getFullyQualifiedName()).thenReturn("svc.db.schema." + name);
    when(entity.getVersion()).thenReturn(1.0);
    return entity;
  }

  private EntityTimeSeriesInterface mockTimeSeriesEntity(String entityType, UUID id, String name) {
    EntityTimeSeriesInterface entity = mock(EntityTimeSeriesInterface.class);
    EntityReference entityReference =
        new EntityReference().withId(id).withType(entityType).withName(name);
    when(entity.getEntityReference()).thenReturn(entityReference);
    when(entity.getId()).thenReturn(id);
    return entity;
  }

  private ChangeDescription changeDescription(
      List<FieldChange> fieldsAdded,
      List<FieldChange> fieldsUpdated,
      List<FieldChange> fieldsDeleted) {
    return new ChangeDescription()
        .withFieldsAdded(fieldsAdded)
        .withFieldsUpdated(fieldsUpdated)
        .withFieldsDeleted(fieldsDeleted);
  }

  @SuppressWarnings("unchecked")
  private Pair<String, Map<String, Object>> invokeGetInheritedFieldChanges(
      ChangeDescription changeDescription, EntityInterface entity) throws Exception {
    Method method =
        SearchRepository.class.getDeclaredMethod(
            "getInheritedFieldChanges", ChangeDescription.class, EntityInterface.class);
    method.setAccessible(true);
    return (Pair<String, Map<String, Object>>) method.invoke(repository, changeDescription, entity);
  }

  private boolean invokeRequiresPropagation(
      ChangeDescription changeDescription, String entityType, EntityInterface entity)
      throws Exception {
    return (Boolean)
        invokePrivateMethod(
            repository,
            "requiresPropagation",
            new Class<?>[] {ChangeDescription.class, String.class, EntityInterface.class},
            changeDescription,
            entityType,
            entity);
  }

  private Object invokePrivateMethod(
      Object target, String methodName, Class<?>[] parameterTypes, Object... args)
      throws Exception {
    Method method = SearchRepository.class.getDeclaredMethod(methodName, parameterTypes);
    method.setAccessible(true);
    return method.invoke(target, args);
  }

  private void setPrivateField(Object target, String fieldName, Object value) throws Exception {
    Field field = SearchRepository.class.getDeclaredField(fieldName);
    field.setAccessible(true);
    field.set(target, value);
  }

  private static final class TestSearchRepository extends SearchRepository {
    private static final ThreadLocal<SearchClient> SEARCH_CLIENT_OVERRIDE = new ThreadLocal<>();
    private static final ThreadLocal<SearchIndexFactory> INDEX_FACTORY_OVERRIDE =
        new ThreadLocal<>();

    private TestSearchRepository(ElasticSearchConfiguration config, int maxDBConnections) {
      super(config, maxDBConnections);
    }

    static void overrideSearchClient(SearchClient searchClient) {
      SEARCH_CLIENT_OVERRIDE.set(searchClient);
    }

    static void overrideSearchIndexFactory(SearchIndexFactory searchIndexFactory) {
      INDEX_FACTORY_OVERRIDE.set(searchIndexFactory);
    }

    static void clearOverrides() {
      SEARCH_CLIENT_OVERRIDE.remove();
      INDEX_FACTORY_OVERRIDE.remove();
    }

    @Override
    public SearchClient buildSearchClient(ElasticSearchConfiguration config) {
      return SEARCH_CLIENT_OVERRIDE.get();
    }

    @Override
    public SearchIndexFactory buildIndexFactory() {
      return INDEX_FACTORY_OVERRIDE.get();
    }
  }

  private static final class MapBackedSearchIndex
      implements org.openmetadata.service.search.indexes.SearchIndex {
    private final Object entity;
    private final Map<String, Object> document;

    private MapBackedSearchIndex(Object entity, Map<String, Object> document) {
      this.entity = entity;
      this.document = document;
    }

    @Override
    public Object getEntity() {
      return entity;
    }

    @Override
    public Map<String, Object> buildSearchIndexDoc() {
      return document;
    }

    @Override
    public Map<String, Object> buildSearchIndexDocInternal(Map<String, Object> esDoc) {
      return document;
    }
  }
}

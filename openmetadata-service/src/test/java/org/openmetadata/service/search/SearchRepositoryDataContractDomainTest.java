package org.openmetadata.service.search;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.doReturn;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.spy;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.lang.reflect.Field;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.function.Consumer;
import org.apache.commons.lang3.tuple.ImmutablePair;
import org.apache.commons.lang3.tuple.Pair;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.entity.data.DataContract;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.domains.Domain;
import org.openmetadata.schema.service.configuration.elasticsearch.ElasticSearchConfiguration;
import org.openmetadata.schema.service.configuration.elasticsearch.NaturalLanguageSearchConfiguration;
import org.openmetadata.schema.type.ChangeDescription;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.FieldChange;
import org.openmetadata.schema.type.Include;
import org.openmetadata.search.IndexMapping;
import org.openmetadata.search.IndexMappingLoader;
import org.openmetadata.service.Entity;
import org.openmetadata.service.events.lifecycle.EntityLifecycleEventDispatcher;
import org.openmetadata.service.jdbi3.DataContractRepository;
import org.openmetadata.service.jdbi3.EntityRepository;
import org.openmetadata.service.jdbi3.QueryRepository;
import org.openmetadata.service.util.EntityUtil;

class SearchRepositoryDataContractDomainTest {

  private static final IndexMapping TABLE_MAPPING =
      IndexMapping.builder()
          .indexName("table_search_index")
          .alias("table")
          .parentAliases(List.of(SearchClient.GLOBAL_SEARCH_ALIAS))
          .childAliases(List.of())
          .indexMappingFile("/elasticsearch/%s/table_index_mapping.json")
          .build();

  private static final IndexMapping TOPIC_MAPPING =
      IndexMapping.builder()
          .indexName("topic_search_index")
          .alias("topic")
          .parentAliases(List.of(SearchClient.GLOBAL_SEARCH_ALIAS))
          .childAliases(List.of())
          .indexMappingFile("/elasticsearch/%s/topic_index_mapping.json")
          .build();

  private static final IndexMapping SCHEMA_MAPPING =
      IndexMapping.builder()
          .indexName("database_schema_search_index")
          .alias("databaseSchema")
          .parentAliases(List.of(SearchClient.GLOBAL_SEARCH_ALIAS))
          .childAliases(List.of(Entity.TABLE))
          .indexMappingFile("/elasticsearch/%s/database_schema_index_mapping.json")
          .build();

  private static final IndexMapping DOMAIN_MAPPING =
      IndexMapping.builder()
          .indexName("domain_search_index")
          .alias("domain")
          .parentAliases(List.of(SearchClient.GLOBAL_SEARCH_ALIAS))
          .childAliases(List.of("data_product_search_index"))
          .indexMappingFile("/elasticsearch/%s/domain_index_mapping.json")
          .build();

  private static final IndexMapping DATA_CONTRACT_MAPPING =
      IndexMapping.builder()
          .indexName("data_contract_search_index")
          .alias("dataContract")
          .parentAliases(List.of())
          .childAliases(List.of())
          .indexMappingFile("/elasticsearch/%s/data_contract_index_mapping.json")
          .build();

  private static final List<String> REGISTERED_TYPES =
      List.of(
          Entity.TABLE,
          Entity.TOPIC,
          Entity.DATABASE_SCHEMA,
          Entity.DOMAIN,
          Entity.QUERY,
          Entity.DATA_CONTRACT);

  private SearchClient searchClient;
  private SearchIndexFactory searchIndexFactory;
  private SearchRepository repository;
  private DataContractRepository dataContractRepository;
  private EntityRepository<Table> tableRepository;

  @BeforeEach
  @SuppressWarnings("unchecked")
  void setUp() {
    searchClient = mock(SearchClient.class);
    when(searchClient.isClientAvailable()).thenReturn(true);
    searchIndexFactory = mock(SearchIndexFactory.class);
    when(searchIndexFactory.getReindexFieldsFor(any())).thenReturn(Set.of("domains"));
    dataContractRepository = mock(DataContractRepository.class);
    tableRepository = mock(EntityRepository.class);
    repository =
        newRepository(
            Map.of(
                Entity.TABLE, TABLE_MAPPING,
                Entity.TOPIC, TOPIC_MAPPING,
                Entity.DATABASE_SCHEMA, SCHEMA_MAPPING,
                Entity.DOMAIN, DOMAIN_MAPPING,
                Entity.DATA_CONTRACT, DATA_CONTRACT_MAPPING));
    Entity.setSearchRepository(repository);
    registerRepositories();
  }

  @AfterEach
  void tearDown() {
    Entity.setSearchRepository(null);
    clearRepositories();
  }

  @Test
  void propagateToRelatedEntities_reindexesDataContractsWithIncludeAllOnDomainChange() {
    SearchRepository spyRepo = spy(repository);
    UUID tableId = UUID.randomUUID();
    UUID contractId = UUID.randomUUID();
    EntityReference contractRef =
        new EntityReference().withId(contractId).withType(Entity.DATA_CONTRACT);
    Table table =
        new Table()
            .withId(tableId)
            .withName("orders")
            .withFullyQualifiedName("svc.db.schema.orders");
    ChangeDescription change =
        new ChangeDescription()
            .withFieldsUpdated(List.of(new FieldChange().withName(Entity.FIELD_DOMAINS)));
    doAnswer(
            invocation -> {
              Consumer<List<EntityReference>> consumer = invocation.getArgument(3);
              consumer.accept(List.of(contractRef));
              return null;
            })
        .when(dataContractRepository)
        .forEachDataContractBatchForDomainSource(
            eq(Entity.TABLE), eq(tableId), eq("svc.db.schema.orders"), any());
    doAnswer(invocation -> null).when(spyRepo).updateEntitiesByReference(anyList(), any());

    spyRepo.propagateToRelatedEntities(Entity.TABLE, change, TABLE_MAPPING, table);

    verify(spyRepo).updateEntitiesByReference(List.of(contractRef), Include.ALL);
  }

  @Test
  void propagateToRelatedEntities_skipsDataContractReindexForNonDomainChanges() {
    Table table =
        new Table()
            .withId(UUID.randomUUID())
            .withName("orders")
            .withFullyQualifiedName("svc.db.schema.orders");
    ChangeDescription change =
        new ChangeDescription()
            .withFieldsUpdated(List.of(new FieldChange().withName(Entity.FIELD_DESCRIPTION)));

    repository.propagateToRelatedEntities(Entity.TABLE, change, TABLE_MAPPING, table);

    verify(dataContractRepository, never())
        .forEachDataContractBatchForDomainSource(any(), any(), any(), any());
  }

  @Test
  void propagateInheritedDomainsToChildren_reindexesDataContractsForUniqueSourcesIncludingLeafs() {
    SearchRepository spyRepo = spy(repository);
    UUID topicId = UUID.randomUUID();
    UUID schemaId = UUID.randomUUID();
    UUID contractId = UUID.randomUUID();
    EntityReference topicRef = new EntityReference().withId(topicId).withType(Entity.TOPIC);
    EntityReference duplicateTopicRef =
        new EntityReference().withId(topicId).withType(Entity.TOPIC);
    EntityReference schemaRef =
        new EntityReference().withId(schemaId).withType(Entity.DATABASE_SCHEMA);
    EntityReference contractRef =
        new EntityReference().withId(contractId).withType(Entity.DATA_CONTRACT);
    doAnswer(
            invocation -> {
              Consumer<List<EntityReference>> consumer = invocation.getArgument(3);
              consumer.accept(List.of(contractRef));
              return null;
            })
        .when(dataContractRepository)
        .forEachDataContractBatchForDomainSource(eq(Entity.TOPIC), eq(topicId), eq(null), any());
    doAnswer(invocation -> null).when(spyRepo).updateEntitiesByReference(anyList(), any());

    spyRepo.propagateInheritedDomainsToChildren(
        List.of(topicRef, duplicateTopicRef, schemaRef), List.of());

    verify(dataContractRepository, times(1))
        .forEachDataContractBatchForDomainSource(eq(Entity.TOPIC), eq(topicId), eq(null), any());
    verify(dataContractRepository, times(1))
        .forEachDataContractBatchForDomainSource(
            eq(Entity.DATABASE_SCHEMA), eq(schemaId), eq(null), any());
    verify(spyRepo).updateEntitiesByReference(List.of(contractRef), Include.ALL);
  }

  @Test
  void updateEntityAndPropagateInheritedDomainsToChildren_reindexesDataContracts() {
    SearchRepository spyRepo = spy(repository);
    UUID tableId = UUID.randomUUID();
    Table table =
        new Table()
            .withId(tableId)
            .withName("orders")
            .withFullyQualifiedName("svc.db.schema.orders");
    EntityReference tableRef =
        new EntityReference()
            .withId(tableId)
            .withType(Entity.TABLE)
            .withFullyQualifiedName("svc.db.schema.orders");
    EntityUtil.Fields fields = new EntityUtil.Fields(Set.of("domains"));
    when(tableRepository.getOnlySupportedFields("domains")).thenReturn(fields);
    when(tableRepository.get(null, tableId, fields)).thenReturn(table);
    doAnswer(invocation -> null).when(spyRepo).updateEntityIndex(any());

    spyRepo.updateEntityAndPropagateInheritedDomainsToChildren(tableRef);

    verify(dataContractRepository)
        .forEachDataContractBatchForDomainSource(
            eq(Entity.TABLE), eq(tableId), eq("svc.db.schema.orders"), any());
  }

  @Test
  void deleteOrUpdateChildren_forDomainRemovesDomainFromDataContractIndexAndStagedIndex()
      throws Exception {
    UUID domainId = UUID.randomUUID();
    EntityInterface<?> domain = mock(EntityInterface.class);
    when(domain.getId()).thenReturn(domainId);
    when(domain.getEntityReference())
        .thenReturn(
            new EntityReference().withId(domainId).withType(Entity.DOMAIN).withName("finance"));
    repository.registerStagedIndex(
        Entity.DATA_CONTRACT, "cluster_data_contract_search_index_staged");

    repository.deleteOrUpdateChildren(domain, DOMAIN_MAPPING);

    verify(searchClient)
        .updateChildren(
            SearchClient.GLOBAL_SEARCH_ALIAS,
            new ImmutablePair<>("domains.id", domainId.toString()),
            new ImmutablePair<>(
                SearchClient.REMOVE_DOMAINS_CHILDREN_SCRIPT, Map.of("id", domainId.toString())));
    verify(searchClient)
        .updateChildren(
            List.of(
                "cluster_data_contract_search_index", "cluster_data_contract_search_index_staged"),
            "domains.id",
            List.of(domainId.toString()),
            new ImmutablePair<>(
                SearchClient.REMOVE_DOMAINS_CHILDREN_SCRIPT, Map.of("id", domainId.toString())));
  }

  @Test
  void deleteOrUpdateChildren_forDomainDeletesChildDataProductsEvenWhenDataContractUpdateFails()
      throws Exception {
    UUID domainId = UUID.randomUUID();
    EntityInterface<?> domain = mock(EntityInterface.class);
    when(domain.getId()).thenReturn(domainId);
    when(domain.getEntityReference())
        .thenReturn(
            new EntityReference().withId(domainId).withType(Entity.DOMAIN).withName("finance"));
    doAnswer(
            invocation -> {
              throw new java.io.IOException("es unavailable");
            })
        .when(searchClient)
        .updateChildren(
            eq(List.of("cluster_data_contract_search_index")),
            eq("domains.id"),
            eq(List.of(domainId.toString())),
            any(Pair.class));

    try (var retryQueueMock = mockStatic(SearchIndexRetryQueue.class)) {
      retryQueueMock
          .when(() -> SearchIndexRetryQueue.failureReason(any(), any()))
          .thenReturn("removeDomainFromDataContractIndex: es unavailable");

      repository.deleteOrUpdateChildren(domain, DOMAIN_MAPPING);

      retryQueueMock.verify(
          () ->
              SearchIndexRetryQueue.enqueue(
                  eq(null),
                  eq(domainId.toString()),
                  eq(Entity.DATA_CONTRACT),
                  eq("removeDomainFromDataContractIndex: es unavailable")));
    }
    verify(searchClient)
        .deleteEntityByFields(
            List.of("cluster_data_product_search_index"),
            List.of(new ImmutablePair<>("domain.id", domainId.toString())));
  }

  @Test
  void deleteOrUpdateChildren_forDomainEnqueuesRetryWhenSearchClientIsUnavailable()
      throws Exception {
    UUID domainId = UUID.randomUUID();
    EntityInterface<?> domain = mock(EntityInterface.class);
    when(domain.getId()).thenReturn(domainId);
    when(domain.getEntityReference())
        .thenReturn(
            new EntityReference().withId(domainId).withType(Entity.DOMAIN).withName("finance"));
    when(searchClient.isClientAvailable()).thenReturn(false);

    try (var retryQueueMock = mockStatic(SearchIndexRetryQueue.class)) {
      retryQueueMock
          .when(() -> SearchIndexRetryQueue.failureReason(any(), any()))
          .thenReturn("removeDomainFromDataContractIndex: Search client unavailable");

      repository.deleteOrUpdateChildren(domain, DOMAIN_MAPPING);

      retryQueueMock.verify(
          () ->
              SearchIndexRetryQueue.enqueue(
                  eq(null),
                  eq(domainId.toString()),
                  eq(Entity.DATA_CONTRACT),
                  eq("removeDomainFromDataContractIndex: Search client unavailable")));
    }
    verify(searchClient, never())
        .updateChildren(
            eq(List.of("cluster_data_contract_search_index")), any(), anyList(), any(Pair.class));
  }

  @Test
  void deleteOrUpdateChildren_forDomainStillStripsDataContractsWhenChildDeleteFails()
      throws Exception {
    UUID domainId = UUID.randomUUID();
    EntityInterface<?> domain = mock(EntityInterface.class);
    when(domain.getId()).thenReturn(domainId);
    when(domain.getEntityReference())
        .thenReturn(
            new EntityReference().withId(domainId).withType(Entity.DOMAIN).withName("finance"));
    doAnswer(
            invocation -> {
              throw new java.io.IOException("data product delete failed");
            })
        .when(searchClient)
        .deleteEntityByFields(
            List.of("cluster_data_product_search_index"),
            List.of(new ImmutablePair<>("domain.id", domainId.toString())));

    assertThrows(
        java.io.IOException.class, () -> repository.deleteOrUpdateChildren(domain, DOMAIN_MAPPING));

    verify(searchClient)
        .updateChildren(
            List.of("cluster_data_contract_search_index"),
            "domains.id",
            List.of(domainId.toString()),
            new ImmutablePair<>(
                SearchClient.REMOVE_DOMAINS_CHILDREN_SCRIPT, Map.of("id", domainId.toString())));
  }

  @Test
  void getDomainAssetWriteFanoutTargets_includesGlobalAliasDataContractIndexAndStagedIndex() {
    repository.registerStagedIndex(
        Entity.DATA_CONTRACT, "cluster_data_contract_search_index_staged");

    List<String> targets = repository.getDomainAssetWriteFanoutTargets();

    assertEquals(3, targets.size());
    assertEquals(
        Set.of(
            "cluster_all",
            "cluster_data_contract_search_index",
            "cluster_data_contract_search_index_staged"),
        Set.copyOf(targets));
  }

  @Test
  @SuppressWarnings("unchecked")
  void propagateToRelatedEntities_relabelDomainTargetsDataContractIndex() throws Exception {
    UUID domainId = UUID.randomUUID();
    Domain domain =
        new Domain()
            .withId(domainId)
            .withName("finance_v2")
            .withDisplayName("Finance v2")
            .withFullyQualifiedName("finance_v2");
    ChangeDescription change =
        new ChangeDescription()
            .withFieldsUpdated(
                List.of(
                    new FieldChange()
                        .withName(Entity.FIELD_DISPLAY_NAME)
                        .withOldValue("Finance")
                        .withNewValue("Finance v2")));

    repository.propagateToRelatedEntities(Entity.DOMAIN, change, DOMAIN_MAPPING, domain);

    ArgumentCaptor<List<String>> targetsCaptor = ArgumentCaptor.forClass(List.class);
    verify(searchClient)
        .updateReferenceCopies(
            targetsCaptor.capture(),
            eq(List.of()),
            eq(List.of(Entity.FIELD_DOMAINS)),
            eq(SearchConstants.ID),
            eq(List.of(domainId.toString())),
            any(Pair.class));
    assertTrue(
        targetsCaptor.getValue().contains("cluster_data_contract_search_index"),
        "Expected data contract index in relabel targets: " + targetsCaptor.getValue());
  }

  @Test
  void updateEntitiesByReference_loadsWithSuppliedIncludeAndDeduplicates() {
    SearchRepository spyRepo = spy(repository);
    UUID contractId = UUID.randomUUID();
    EntityReference ref = new EntityReference().withId(contractId).withType(Entity.DATA_CONTRACT);
    EntityReference duplicate =
        new EntityReference().withId(contractId).withType(Entity.DATA_CONTRACT);
    DataContract softDeletedContract =
        new DataContract().withId(contractId).withName("dc").withDeleted(true);
    EntityUtil.Fields fields = new EntityUtil.Fields(Set.of("domains"));
    when(dataContractRepository.getOnlySupportedFields("domains")).thenReturn(fields);
    doReturn(List.of(softDeletedContract))
        .when(dataContractRepository)
        .get(null, List.of(contractId), fields, Include.ALL);
    doAnswer(invocation -> null).when(spyRepo).updateEntitiesIndex(anyList());

    spyRepo.updateEntitiesByReference(List.of(ref, duplicate), Include.ALL);

    verify(dataContractRepository).get(null, List.of(contractId), fields, Include.ALL);
    verify(spyRepo).updateEntitiesIndex(List.of(softDeletedContract));
  }

  @Test
  void propagateInheritedDomainsToChildren_isolatesPerSourceFailureAndEnqueuesSourceRetry() {
    SearchRepository spyRepo = spy(repository);
    UUID failingTopicId = UUID.randomUUID();
    UUID healthyTableId = UUID.randomUUID();
    UUID contractId = UUID.randomUUID();
    EntityReference failingRef =
        new EntityReference()
            .withId(failingTopicId)
            .withType(Entity.TOPIC)
            .withFullyQualifiedName("kafka.orders");
    EntityReference healthyRef =
        new EntityReference()
            .withId(healthyTableId)
            .withType(Entity.TABLE)
            .withFullyQualifiedName("svc.db.schema.orders");
    EntityReference contractRef =
        new EntityReference().withId(contractId).withType(Entity.DATA_CONTRACT);
    doAnswer(
            invocation -> {
              throw new IllegalStateException("transient db error");
            })
        .when(dataContractRepository)
        .forEachDataContractBatchForDomainSource(
            eq(Entity.TOPIC), eq(failingTopicId), eq("kafka.orders"), any());
    doAnswer(
            invocation -> {
              Consumer<List<EntityReference>> consumer = invocation.getArgument(3);
              consumer.accept(List.of(contractRef));
              return null;
            })
        .when(dataContractRepository)
        .forEachDataContractBatchForDomainSource(
            eq(Entity.TABLE), eq(healthyTableId), eq("svc.db.schema.orders"), any());
    doAnswer(invocation -> null).when(spyRepo).updateEntitiesByReference(anyList(), any());

    try (var retryQueueMock = mockStatic(SearchIndexRetryQueue.class)) {
      retryQueueMock
          .when(() -> SearchIndexRetryQueue.failureReason(any(), any()))
          .thenReturn("reindexDataContractsForDomainChange: transient db error");

      spyRepo.propagateInheritedDomainsToChildren(List.of(failingRef, healthyRef), List.of());

      retryQueueMock.verify(
          () ->
              SearchIndexRetryQueue.enqueue(
                  eq(failingTopicId.toString()),
                  eq("kafka.orders"),
                  eq(Entity.TOPIC),
                  eq("reindexDataContractsForDomainChange: transient db error")));
    }
    verify(spyRepo).updateEntitiesByReference(List.of(contractRef), Include.ALL);
  }

  private SearchRepository newRepository(Map<String, IndexMapping> entityIndexMap) {
    ElasticSearchConfiguration config = new ElasticSearchConfiguration();
    config.setSearchIndexMappingLanguage(org.openmetadata.schema.type.IndexMappingLanguage.EN);
    config.setClusterAlias("cluster");
    config.setSearchType(ElasticSearchConfiguration.SearchType.ELASTICSEARCH);
    NaturalLanguageSearchConfiguration nlConfig = new NaturalLanguageSearchConfiguration();
    nlConfig.setEnabled(false);
    config.setNaturalLanguageSearch(nlConfig);

    IndexMappingLoader mappingLoader = mock(IndexMappingLoader.class);
    when(mappingLoader.getIndexMapping()).thenReturn(entityIndexMap);
    EntityLifecycleEventDispatcher dispatcher = mock(EntityLifecycleEventDispatcher.class);
    TestSearchRepository.override(searchClient, searchIndexFactory);
    try (var loaderMock = mockStatic(IndexMappingLoader.class);
        var dispatcherMock = mockStatic(EntityLifecycleEventDispatcher.class)) {
      loaderMock.when(IndexMappingLoader::getInstance).thenReturn(mappingLoader);
      dispatcherMock.when(EntityLifecycleEventDispatcher::getInstance).thenReturn(dispatcher);
      return new TestSearchRepository(config, 4);
    } finally {
      TestSearchRepository.clear();
    }
  }

  @SuppressWarnings("unchecked")
  private void registerRepositories() {
    try {
      Field repoMapField = Entity.class.getDeclaredField("ENTITY_REPOSITORY_MAP");
      repoMapField.setAccessible(true);
      Map<String, Object> repoMap = (Map<String, Object>) repoMapField.get(null);
      EntityRepository<?> topicRepo = mock(EntityRepository.class);
      EntityRepository<?> schemaRepo = mock(EntityRepository.class);
      EntityRepository<?> domainRepo = mock(EntityRepository.class);
      QueryRepository queryRepo = mock(QueryRepository.class);
      doReturn(Set.of(Entity.FIELD_DOMAINS)).when(tableRepository).getAllowedFields();
      doReturn(Set.of(Entity.FIELD_DOMAINS)).when(topicRepo).getAllowedFields();
      doReturn(Set.of(Entity.FIELD_DOMAINS)).when(schemaRepo).getAllowedFields();
      doReturn(Set.of()).when(domainRepo).getAllowedFields();
      doReturn(Set.of()).when(dataContractRepository).getAllowedFields();
      repoMap.put(Entity.TABLE, tableRepository);
      repoMap.put(Entity.TOPIC, topicRepo);
      repoMap.put(Entity.DATABASE_SCHEMA, schemaRepo);
      repoMap.put(Entity.DOMAIN, domainRepo);
      repoMap.put(Entity.QUERY, queryRepo);
      repoMap.put(Entity.DATA_CONTRACT, dataContractRepository);
    } catch (Exception e) {
      throw new RuntimeException(e);
    }
  }

  @SuppressWarnings("unchecked")
  private void clearRepositories() {
    try {
      Field repoMapField = Entity.class.getDeclaredField("ENTITY_REPOSITORY_MAP");
      repoMapField.setAccessible(true);
      Map<String, Object> repoMap = (Map<String, Object>) repoMapField.get(null);
      REGISTERED_TYPES.forEach(repoMap::remove);
    } catch (Exception e) {
      throw new RuntimeException(e);
    }
  }

  private static final class TestSearchRepository extends SearchRepository {
    private static final ThreadLocal<SearchClient> CLIENT = new ThreadLocal<>();
    private static final ThreadLocal<SearchIndexFactory> FACTORY = new ThreadLocal<>();

    private TestSearchRepository(ElasticSearchConfiguration config, int maxDBConnections) {
      super(config, maxDBConnections);
    }

    static void override(SearchClient client, SearchIndexFactory factory) {
      CLIENT.set(client);
      FACTORY.set(factory);
    }

    static void clear() {
      CLIENT.remove();
      FACTORY.remove();
    }

    @Override
    public SearchClient buildSearchClient(ElasticSearchConfiguration config) {
      return CLIENT.get();
    }

    @Override
    public SearchIndexFactory buildIndexFactory() {
      return FACTORY.get();
    }
  }
}

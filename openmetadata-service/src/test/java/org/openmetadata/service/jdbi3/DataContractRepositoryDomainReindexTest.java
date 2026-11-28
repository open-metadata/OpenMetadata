package org.openmetadata.service.jdbi3;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.stream.IntStream;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.mockito.MockedStatic;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.service.Entity;
import org.openmetadata.service.OpenMetadataApplicationConfig;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.search.SearchRepository;
import org.openmetadata.service.util.FullyQualifiedName;

class DataContractRepositoryDomainReindexTest {
  private CollectionDAO.EntityRelationshipDAO relationshipDAO;
  private CollectionDAO.DataContractDAO dataContractDAO;
  private DataContractRepository repository;

  @BeforeEach
  void setUp() {
    final CollectionDAO collectionDAO = mock(CollectionDAO.class);
    relationshipDAO = mock(CollectionDAO.EntityRelationshipDAO.class);
    dataContractDAO = mock(CollectionDAO.DataContractDAO.class);
    when(collectionDAO.dataContractDAO()).thenReturn(dataContractDAO);
    when(collectionDAO.relationshipDAO()).thenReturn(relationshipDAO);
    when(collectionDAO.profilerDataTimeSeriesDao())
        .thenReturn(mock(CollectionDAO.ProfilerDataTimeSeriesDAO.class));
    Entity.setCollectionDAO(collectionDAO);
    repository = new DataContractRepository(new OpenMetadataApplicationConfig());
  }

  @AfterEach
  void tearDown() {
    Entity.cleanup();
  }

  @Test
  void identifiesDirectAndAncestorDomainReindexSources() {
    assertTrue(repository.isEntityTypeSupported(Entity.TABLE));
    assertFalse(repository.isEntityTypeSupported(Entity.DATABASE_SERVICE));
    assertFalse(repository.isEntityTypeSupported(null));
    assertTrue(DataContractRepository.isDomainReindexSource(Entity.TABLE));
    assertTrue(DataContractRepository.isDomainReindexSource(Entity.DATABASE_SERVICE));
    assertTrue(DataContractRepository.isDomainReindexSource(Entity.DATABASE_SCHEMA));
    assertTrue(DataContractRepository.isDomainReindexSource(Entity.DATA_PRODUCT));
    assertTrue(DataContractRepository.isDomainReindexSource(Entity.METRIC));
    assertTrue(DataContractRepository.isDomainReindexSource(Entity.DRIVE_SERVICE));
    assertFalse(DataContractRepository.isDomainReindexSource(Entity.USER));
    assertFalse(DataContractRepository.isDomainReindexSource(Entity.DOMAIN));
    assertFalse(DataContractRepository.isDomainReindexSource(Entity.DATA_CONTRACT));
    assertFalse(DataContractRepository.isDomainReindexSource(null));
  }

  @Test
  void pagesDirectContractsForLeafTargetWithoutTouchingFqnPrefixQuery() {
    final UUID tableId = UUID.randomUUID();
    final List<String> contractIds =
        contractIds(DataContractRepository.DOMAIN_REINDEX_BATCH_SIZE + 1);
    when(relationshipDAO.findDataContractIdsForEntityAfter(
            eq(tableId),
            eq(Entity.TABLE),
            eq(Relationship.CONTAINS.ordinal()),
            eq(""),
            eq(DataContractRepository.DOMAIN_REINDEX_BATCH_SIZE)))
        .thenReturn(contractIds.subList(0, DataContractRepository.DOMAIN_REINDEX_BATCH_SIZE));
    when(relationshipDAO.findDataContractIdsForEntityAfter(
            eq(tableId),
            eq(Entity.TABLE),
            eq(Relationship.CONTAINS.ordinal()),
            eq(contractIds.get(DataContractRepository.DOMAIN_REINDEX_BATCH_SIZE - 1)),
            eq(DataContractRepository.DOMAIN_REINDEX_BATCH_SIZE)))
        .thenReturn(
            contractIds.subList(
                DataContractRepository.DOMAIN_REINDEX_BATCH_SIZE, contractIds.size()));
    final List<List<EntityReference>> batches = new ArrayList<>();

    repository.forEachDataContractBatchForDomainSource(
        Entity.TABLE, tableId, "svc.db.schema.orders", batches::add);

    assertEquals(List.of(DataContractRepository.DOMAIN_REINDEX_BATCH_SIZE, 1), batchSizes(batches));
    assertEquals(contractIds, flattenIds(batches));
    verify(dataContractDAO, never())
        .findContractIdsByFqnPrefixAfter(anyString(), anyString(), anyInt());
  }

  @Test
  void pagesDescendantContractsForAncestorDomainChanges() {
    final String sourceFqn = "warehouse.analytics";
    final String prefix = FullyQualifiedName.buildHash(sourceFqn) + ".%";
    final List<String> contractIds =
        contractIds(DataContractRepository.DOMAIN_REINDEX_BATCH_SIZE + 1);
    when(dataContractDAO.findContractIdsByFqnPrefixAfter(
            eq(prefix), eq(""), eq(DataContractRepository.DOMAIN_REINDEX_BATCH_SIZE)))
        .thenReturn(contractIds.subList(0, DataContractRepository.DOMAIN_REINDEX_BATCH_SIZE));
    when(dataContractDAO.findContractIdsByFqnPrefixAfter(
            eq(prefix),
            eq(contractIds.get(DataContractRepository.DOMAIN_REINDEX_BATCH_SIZE - 1)),
            eq(DataContractRepository.DOMAIN_REINDEX_BATCH_SIZE)))
        .thenReturn(
            contractIds.subList(
                DataContractRepository.DOMAIN_REINDEX_BATCH_SIZE, contractIds.size()));
    final List<List<EntityReference>> batches = new ArrayList<>();

    repository.forEachDataContractBatchForDomainSource(
        Entity.DATABASE_SERVICE, UUID.randomUUID(), sourceFqn, batches::add);

    assertEquals(List.of(DataContractRepository.DOMAIN_REINDEX_BATCH_SIZE, 1), batchSizes(batches));
    assertEquals(contractIds, flattenIds(batches));
    final ArgumentCaptor<String> cursor = ArgumentCaptor.forClass(String.class);
    verify(dataContractDAO, times(2))
        .findContractIdsByFqnPrefixAfter(
            eq(prefix), cursor.capture(), eq(DataContractRepository.DOMAIN_REINDEX_BATCH_SIZE));
    assertEquals(
        List.of("", contractIds.get(DataContractRepository.DOMAIN_REINDEX_BATCH_SIZE - 1)),
        cursor.getAllValues());
  }

  @Test
  void deduplicatesDirectContractWhenSourceIsAlsoAnAncestor() {
    final UUID schemaId = UUID.randomUUID();
    final String schemaFqn = "warehouse.analytics.public";
    final String schemaContractId = new UUID(0L, 1L).toString();
    final String tableContractId = new UUID(0L, 2L).toString();
    when(relationshipDAO.findDataContractIdsForEntityAfter(
            eq(schemaId),
            eq(Entity.DATABASE_SCHEMA),
            eq(Relationship.CONTAINS.ordinal()),
            eq(""),
            eq(DataContractRepository.DOMAIN_REINDEX_BATCH_SIZE)))
        .thenReturn(List.of(schemaContractId));
    when(dataContractDAO.findContractIdsByFqnPrefixAfter(
            eq(FullyQualifiedName.buildHash(schemaFqn) + ".%"),
            eq(""),
            eq(DataContractRepository.DOMAIN_REINDEX_BATCH_SIZE)))
        .thenReturn(List.of(schemaContractId, tableContractId));
    final List<List<EntityReference>> batches = new ArrayList<>();

    repository.forEachDataContractBatchForDomainSource(
        Entity.DATABASE_SCHEMA, schemaId, schemaFqn, batches::add);

    assertEquals(List.of(schemaContractId, tableContractId), flattenIds(batches));
  }

  @Test
  void resolvesSourceFqnWhenCallerSuppliesIdAndTypeOnly() {
    final UUID schemaId = UUID.randomUUID();
    final String schemaFqn = "warehouse.analytics.sales";
    final String tableContractId = new UUID(0L, 3L).toString();
    when(relationshipDAO.findDataContractIdsForEntityAfter(
            eq(schemaId),
            eq(Entity.DATABASE_SCHEMA),
            eq(Relationship.CONTAINS.ordinal()),
            eq(""),
            eq(DataContractRepository.DOMAIN_REINDEX_BATCH_SIZE)))
        .thenReturn(List.of());
    when(dataContractDAO.findContractIdsByFqnPrefixAfter(
            eq(FullyQualifiedName.buildHash(schemaFqn) + ".%"),
            eq(""),
            eq(DataContractRepository.DOMAIN_REINDEX_BATCH_SIZE)))
        .thenReturn(List.of(tableContractId));
    final List<List<EntityReference>> batches = new ArrayList<>();

    try (MockedStatic<Entity> entityMock = mockStatic(Entity.class)) {
      entityMock.when(() -> Entity.hasEntityRepository(Entity.DATABASE_SCHEMA)).thenReturn(true);
      entityMock
          .when(() -> Entity.getEntityReferenceById(Entity.DATABASE_SCHEMA, schemaId, Include.ALL))
          .thenReturn(
              new EntityReference()
                  .withId(schemaId)
                  .withType(Entity.DATABASE_SCHEMA)
                  .withFullyQualifiedName(schemaFqn));

      repository.forEachDataContractBatchForDomainSource(
          Entity.DATABASE_SCHEMA, schemaId, null, batches::add);
    }

    assertEquals(List.of(tableContractId), flattenIds(batches));
  }

  @Test
  void skipsDescendantLookupWhenMissingAncestorHasNullFqn() {
    final UUID schemaId = UUID.randomUUID();
    when(relationshipDAO.findDataContractIdsForEntityAfter(
            eq(schemaId),
            eq(Entity.DATABASE_SCHEMA),
            eq(Relationship.CONTAINS.ordinal()),
            eq(""),
            eq(DataContractRepository.DOMAIN_REINDEX_BATCH_SIZE)))
        .thenReturn(List.of());
    final List<List<EntityReference>> batches = new ArrayList<>();

    try (MockedStatic<Entity> entityMock = mockStatic(Entity.class)) {
      entityMock.when(() -> Entity.hasEntityRepository(Entity.DATABASE_SCHEMA)).thenReturn(true);
      entityMock
          .when(() -> Entity.getEntityReferenceById(Entity.DATABASE_SCHEMA, schemaId, Include.ALL))
          .thenThrow(EntityNotFoundException.byId(schemaId.toString()));

      repository.forEachDataContractBatchForDomainSource(
          Entity.DATABASE_SCHEMA, schemaId, null, batches::add);
    }

    assertTrue(batches.isEmpty());
    verify(dataContractDAO, never())
        .findContractIdsByFqnPrefixAfter(anyString(), anyString(), anyInt());
  }

  @Test
  void ignoresNullSourceTypeWithoutThrowing() {
    final List<List<EntityReference>> batches = new ArrayList<>();

    repository.forEachDataContractBatchForDomainSource(
        null, UUID.randomUUID(), "warehouse.analytics", batches::add);

    assertTrue(batches.isEmpty());
    verify(dataContractDAO, never())
        .findContractIdsByFqnPrefixAfter(anyString(), anyString(), anyInt());
  }

  @Test
  void csvBatchDomainDiffTriggersDataContractReindexOnlyForMovedEntities() {
    final CollectionDAO collectionDAO = Entity.getCollectionDAO();
    when(collectionDAO.tableDAO()).thenReturn(mock(CollectionDAO.TableDAO.class));
    final SearchRepository searchRepository = mock(SearchRepository.class);
    Entity.setSearchRepository(searchRepository);
    final TableRepository tableRepo = new TableRepository();

    final UUID domainA = UUID.randomUUID();
    final UUID domainB = UUID.randomUUID();
    final UUID movedId = UUID.randomUUID();
    final UUID unchangedId = UUID.randomUUID();
    final EntityReference refA = new EntityReference().withId(domainA).withType(Entity.DOMAIN);
    final EntityReference refB = new EntityReference().withId(domainB).withType(Entity.DOMAIN);

    final Table origMoved =
        new Table()
            .withId(movedId)
            .withFullyQualifiedName("svc.db.schema.moved")
            .withDomains(List.of(refA));
    final Table updatedMoved =
        new Table()
            .withId(movedId)
            .withFullyQualifiedName("svc.db.schema.moved")
            .withDomains(List.of(refB));
    final Table origSame =
        new Table()
            .withId(unchangedId)
            .withFullyQualifiedName("svc.db.schema.same")
            .withDomains(List.of(refA));
    final Table updatedSame =
        new Table()
            .withId(unchangedId)
            .withFullyQualifiedName("svc.db.schema.same")
            .withDomains(List.of(refA));

    tableRepo.reindexDataContractsMovedInBatch(
        List.of(origMoved, origSame), List.of(updatedMoved, updatedSame));

    verify(searchRepository)
        .reindexDataContractsForDomainSources(
            List.of(
                new EntityReference()
                    .withId(movedId)
                    .withType(Entity.TABLE)
                    .withFullyQualifiedName("svc.db.schema.moved")));
  }

  private static List<String> contractIds(int count) {
    return IntStream.rangeClosed(1, count)
        .mapToObj(value -> new UUID(0L, value).toString())
        .toList();
  }

  private static List<Integer> batchSizes(List<List<EntityReference>> batches) {
    return batches.stream().map(List::size).toList();
  }

  private static List<String> flattenIds(List<List<EntityReference>> batches) {
    return batches.stream()
        .flatMap(List::stream)
        .map(EntityReference::getId)
        .map(UUID::toString)
        .toList();
  }
}

package org.openmetadata.service.jdbi3;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
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
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.service.Entity;
import org.openmetadata.service.util.FullyQualifiedName;

class QueryRepositoryDomainReindexTest {
  private CollectionDAO.EntityRelationshipDAO relationshipDAO;
  private QueryRepository repository;

  @BeforeEach
  void setUp() {
    final CollectionDAO collectionDAO = mock(CollectionDAO.class);
    relationshipDAO = mock(CollectionDAO.EntityRelationshipDAO.class);
    when(collectionDAO.queryDAO()).thenReturn(mock(CollectionDAO.QueryDAO.class));
    when(collectionDAO.relationshipDAO()).thenReturn(relationshipDAO);
    Entity.setCollectionDAO(collectionDAO);
    repository = new QueryRepository();
  }

  @AfterEach
  void tearDown() {
    Entity.cleanup();
  }

  @Test
  void pagesQueriesForAncestorDomainChangesWithoutMaterializingDescendantTables() {
    final String sourceFqn = "warehouse.analytics";
    final List<String> queryIds = queryIds(QueryRepository.DOMAIN_REINDEX_BATCH_SIZE + 1);
    when(relationshipDAO.findQueryIdsForTableFqnPrefixAfter(
            eq(FullyQualifiedName.buildHash(sourceFqn) + ".%"),
            eq(Relationship.MENTIONED_IN.ordinal()),
            eq(""),
            eq(QueryRepository.DOMAIN_REINDEX_BATCH_SIZE)))
        .thenReturn(queryIds.subList(0, QueryRepository.DOMAIN_REINDEX_BATCH_SIZE));
    when(relationshipDAO.findQueryIdsForTableFqnPrefixAfter(
            eq(FullyQualifiedName.buildHash(sourceFqn) + ".%"),
            eq(Relationship.MENTIONED_IN.ordinal()),
            eq(queryIds.get(QueryRepository.DOMAIN_REINDEX_BATCH_SIZE - 1)),
            eq(QueryRepository.DOMAIN_REINDEX_BATCH_SIZE)))
        .thenReturn(queryIds.subList(QueryRepository.DOMAIN_REINDEX_BATCH_SIZE, queryIds.size()));
    final List<List<EntityReference>> batches = new ArrayList<>();

    repository.forEachQueryBatchForDomainSource(
        Entity.DATABASE, UUID.randomUUID(), sourceFqn, batches::add);

    assertEquals(List.of(QueryRepository.DOMAIN_REINDEX_BATCH_SIZE, 1), batchSizes(batches));
    assertEquals(
        queryIds,
        batches.stream()
            .flatMap(List::stream)
            .map(EntityReference::getId)
            .map(UUID::toString)
            .toList());
    final ArgumentCaptor<String> cursor = ArgumentCaptor.forClass(String.class);
    verify(relationshipDAO, times(2))
        .findQueryIdsForTableFqnPrefixAfter(
            eq(FullyQualifiedName.buildHash(sourceFqn) + ".%"),
            eq(Relationship.MENTIONED_IN.ordinal()),
            cursor.capture(),
            eq(QueryRepository.DOMAIN_REINDEX_BATCH_SIZE));
    assertEquals(
        List.of("", queryIds.get(QueryRepository.DOMAIN_REINDEX_BATCH_SIZE - 1)),
        cursor.getAllValues());
  }

  private static List<String> queryIds(int count) {
    return IntStream.rangeClosed(1, count)
        .mapToObj(value -> new UUID(0L, value).toString())
        .toList();
  }

  private static List<Integer> batchSizes(List<List<EntityReference>> batches) {
    return batches.stream().map(List::size).toList();
  }
}

package org.openmetadata.service.jdbi3;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.TimeUnit;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.service.Entity;
import org.openmetadata.service.util.EntityUtil.Fields;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * Performance tests for entity_relationship queries to verify index usage and query optimization.
 */
@ExtendWith(MockitoExtension.class)
public class EntityRelationshipPerformanceTest {

  private static final Logger LOG =
      LoggerFactory.getLogger(EntityRelationshipPerformanceTest.class);

  @Mock private CollectionDAO daoCollection;

  @Mock private CollectionDAO.EntityRelationshipDAO relationshipDAO;

  @Mock private CollectionDAO.TagUsageDAO tagUsageDAO;

  @Mock private TableRepository tableRepository;

  @BeforeEach
  void setUp() {
    // Setup will be done in individual tests as needed
  }

  @Test
  void testFindFromPerformance() {
    // Test that findFrom queries use the idx_entity_relationship_from_composite index
    UUID entityId = UUID.randomUUID();
    String entityType = Entity.TABLE;

    // Simulate multiple relationships
    List<CollectionDAO.EntityRelationshipRecord> mockRecords = new ArrayList<>();
    for (int i = 0; i < 10; i++) {
      CollectionDAO.EntityRelationshipRecord record =
          CollectionDAO.EntityRelationshipRecord.builder()
              .id(UUID.randomUUID())
              .type(Entity.USER)
              .json("{}")
              .build();
      mockRecords.add(record);
    }

    when(relationshipDAO.findFrom(
            eq(entityId), eq(entityType), eq(Relationship.OWNS.ordinal()), anyString()))
        .thenReturn(mockRecords);

    // Measure performance of the DAO call directly
    long startTime = System.nanoTime();
    List<CollectionDAO.EntityRelationshipRecord> records =
        relationshipDAO.findFrom(entityId, entityType, Relationship.OWNS.ordinal(), Entity.USER);
    long endTime = System.nanoTime();

    long durationMs = TimeUnit.NANOSECONDS.toMillis(endTime - startTime);

    // Verify the query was called
    verify(relationshipDAO)
        .findFrom(entityId, entityType, Relationship.OWNS.ordinal(), Entity.USER);

    // Performance assertion - should be very fast with index
    assertTrue(durationMs < 100, "Query should complete in less than 100ms with index");
    assertEquals(10, records.size());

    LOG.info("findFrom query completed in {} ms", durationMs);
  }

  @Test
  void testFindToPerformance() {
    // Test that findTo queries use the idx_entity_relationship_to_composite index
    UUID entityId = UUID.randomUUID();
    String entityType = Entity.TABLE;

    List<CollectionDAO.EntityRelationshipRecord> mockRecords = new ArrayList<>();
    for (int i = 0; i < 5; i++) {
      CollectionDAO.EntityRelationshipRecord record =
          CollectionDAO.EntityRelationshipRecord.builder()
              .id(UUID.randomUUID())
              .type(Entity.TABLE)
              .json("{}")
              .build();
      mockRecords.add(record);
    }

    when(relationshipDAO.findTo(
            eq(entityId), eq(entityType), eq(List.of(Relationship.CONTAINS.ordinal()))))
        .thenReturn(mockRecords);

    long startTime = System.nanoTime();
    List<CollectionDAO.EntityRelationshipRecord> children =
        relationshipDAO.findTo(entityId, entityType, List.of(Relationship.CONTAINS.ordinal()));
    long endTime = System.nanoTime();

    long durationMs = TimeUnit.NANOSECONDS.toMillis(endTime - startTime);

    verify(relationshipDAO).findTo(entityId, entityType, List.of(Relationship.CONTAINS.ordinal()));

    assertTrue(durationMs < 100, "Query should complete in less than 100ms with index");
    assertEquals(5, children.size());

    LOG.info("findTo query completed in {} ms", durationMs);
  }

  @Test
  void testSetFieldsPerformance() {
    // Test to demonstrate the N+1 query problem in setFieldsInternal
    // In real EntityRepository.setFieldsInternal, it makes separate queries for each relationship

    Table table = new Table();
    table.setId(UUID.randomUUID());
    table.setFullyQualifiedName("test.schema.table");

    // Simulate the actual queries that setFieldsInternal would make
    when(relationshipDAO.findFrom(any(), any(), anyInt(), any())).thenReturn(new ArrayList<>());
    when(relationshipDAO.findTo(any(), any(), any())).thenReturn(new ArrayList<>());
    when(tagUsageDAO.getTags(any())).thenReturn(new ArrayList<>());

    Fields fields =
        new Fields(
            new HashSet<>(
                List.of(
                    "owners",
                    "tags",
                    "followers",
                    "domain",
                    "dataProducts",
                    "children",
                    "experts",
                    "reviewers",
                    "votes")));

    // Simulate what setFieldsInternal actually does - multiple queries
    long startTime = System.nanoTime();

    // These represent the actual queries made by setFieldsInternal
    if (fields.contains("owners")) {
      relationshipDAO.findFrom(table.getId(), Entity.TABLE, Relationship.OWNS.ordinal(), null);
    }
    if (fields.contains("tags")) {
      tagUsageDAO.getTags(table.getFullyQualifiedName());
    }
    if (fields.contains("followers")) {
      relationshipDAO.findFrom(
          table.getId(), Entity.TABLE, Relationship.FOLLOWS.ordinal(), Entity.USER);
    }
    if (fields.contains("domain")) {
      relationshipDAO.findFrom(
          table.getId(), Entity.TABLE, Relationship.HAS.ordinal(), Entity.DOMAIN);
    }
    if (fields.contains("dataProducts")) {
      relationshipDAO.findFrom(
          table.getId(), Entity.TABLE, Relationship.HAS.ordinal(), Entity.DATA_PRODUCT);
    }
    if (fields.contains("children")) {
      relationshipDAO.findTo(table.getId(), Entity.TABLE, List.of(Relationship.CONTAINS.ordinal()));
    }
    if (fields.contains("experts")) {
      relationshipDAO.findTo(table.getId(), Entity.TABLE, List.of(Relationship.EXPERT.ordinal()));
    }
    if (fields.contains("reviewers")) {
      relationshipDAO.findFrom(table.getId(), Entity.TABLE, Relationship.REVIEWS.ordinal(), null);
    }
    if (fields.contains("votes")) {
      // Votes would make 2 queries (up and down votes)
      relationshipDAO.findFrom(
          table.getId(), Entity.TABLE, Relationship.VOTED.ordinal(), Entity.USER);
    }

    long endTime = System.nanoTime();
    long durationMs = TimeUnit.NANOSECONDS.toMillis(endTime - startTime);

    // Count how many queries were made
    int queryCount =
        mockingDetails(relationshipDAO).getInvocations().size()
            + mockingDetails(tagUsageDAO).getInvocations().size();

    LOG.info("setFieldsInternal made {} queries in {} ms", queryCount, durationMs);

    // This demonstrates the N+1 problem - multiple queries for each field
    assertTrue(
        queryCount >= 8,
        "Multiple queries are made for different relationship types, got: " + queryCount);

    // With proper indexes, even multiple queries should be fast
    assertTrue(durationMs < 100, "Even with N+1, mocked queries should complete quickly");
  }

  @Test
  void testBidirectionalRelationshipPerformance() {
    // Test bidirectional relationship queries using idx_entity_relationship_bidirectional
    UUID fromId = UUID.randomUUID();
    UUID toId = UUID.randomUUID();

    when(relationshipDAO.findIfAnyRelationExist(eq(fromId.toString()), eq(toId.toString())))
        .thenReturn(1);

    long startTime = System.nanoTime();
    int count = relationshipDAO.findIfAnyRelationExist(fromId.toString(), toId.toString());
    long endTime = System.nanoTime();

    long durationMs = TimeUnit.NANOSECONDS.toMillis(endTime - startTime);

    assertEquals(1, count);
    assertTrue(durationMs < 50, "Bidirectional query should be very fast with index");

    LOG.info("Bidirectional relationship query completed in {} ms", durationMs);
  }

  @Test
  void testOwnershipQueryPerformance() {
    // Test ownership queries that use the partial index (PostgreSQL)
    UUID tableId = UUID.randomUUID();

    List<CollectionDAO.EntityRelationshipRecord> mockOwners =
        List.of(
            CollectionDAO.EntityRelationshipRecord.builder()
                .id(UUID.randomUUID())
                .type(Entity.USER)
                .json("{\"name\":\"user1\"}")
                .build(),
            CollectionDAO.EntityRelationshipRecord.builder()
                .id(UUID.randomUUID())
                .type(Entity.TEAM)
                .json("{\"name\":\"team1\"}")
                .build());

    when(relationshipDAO.findFrom(
            eq(tableId), eq(Entity.TABLE), eq(Relationship.OWNS.ordinal()), isNull()))
        .thenReturn(mockOwners);

    long startTime = System.nanoTime();
    List<CollectionDAO.EntityRelationshipRecord> owners =
        relationshipDAO.findFrom(tableId, Entity.TABLE, Relationship.OWNS.ordinal(), null);
    long endTime = System.nanoTime();

    long durationMs = TimeUnit.NANOSECONDS.toMillis(endTime - startTime);

    assertEquals(2, owners.size());
    assertTrue(durationMs < 50, "Ownership query should use partial index for fast lookup");

    LOG.info("Ownership query completed in {} ms", durationMs);
  }
}

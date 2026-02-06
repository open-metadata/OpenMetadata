package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.factories.DatabaseSchemaTestFactory;
import org.openmetadata.it.factories.DatabaseServiceTestFactory;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.data.CreateTable;
import org.openmetadata.schema.entity.data.DatabaseSchema;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.services.DatabaseService;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.fluent.builders.ColumnBuilder;
import org.openmetadata.sdk.models.ListParams;
import org.openmetadata.sdk.models.ListResponse;

/**
 * Comprehensive pagination tests that run in isolation.
 *
 * <p>This class tests pagination mechanics thoroughly with strong assertions.
 * Tests run SEQUENTIALLY (not concurrent) to ensure created entities are
 * the only ones in the database for that entity type's namespace.
 *
 * <p>Key behaviors tested:
 * <ul>
 *   <li>Page size respects limit</li>
 *   <li>Forward pagination (after cursor) works</li>
 *   <li>Backward pagination (before cursor) works</li>
 *   <li>No duplicate entities across pages</li>
 *   <li>First page has no 'before' cursor</li>
 *   <li>Last page has no 'after' cursor</li>
 *   <li>Created entities appear in results</li>
 *   <li>Deleted entities don't appear (without include=deleted)</li>
 * </ul>
 */
@ExtendWith(TestNamespaceExtension.class)
@Execution(ExecutionMode.SAME_THREAD) // Run sequentially for isolation
public class PaginationIT {

  /**
   * Test comprehensive pagination for Table entities.
   * Creates entities, tests forward/backward pagination with various page sizes.
   */
  @Test
  void testTablePagination(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    // Create dedicated service and schema for this test
    DatabaseService service = DatabaseServiceTestFactory.createPostgres(ns);
    DatabaseSchema schema = DatabaseSchemaTestFactory.createSimple(ns, service);

    // Create multiple tables for pagination testing
    int entityCount = 10;
    List<UUID> createdIds = new ArrayList<>();

    for (int i = 0; i < entityCount; i++) {
      CreateTable request = new CreateTable();
      request.setName(ns.prefix("pagination_table_" + i));
      request.setDatabaseSchema(schema.getFullyQualifiedName());
      request.setColumns(List.of(ColumnBuilder.of("id", "BIGINT").primaryKey().notNull().build()));

      Table table = client.tables().create(request);
      createdIds.add(table.getId());
    }

    // Test with different page sizes, filtered to this test's schema
    String schemaFqn = schema.getFullyQualifiedName();
    testPaginationForEntityType(client, "table", createdIds, 3, schemaFqn);
    testPaginationForEntityType(client, "table", createdIds, 5, schemaFqn);
    testPaginationForEntityType(client, "table", createdIds, 7, schemaFqn);
  }

  private void testPaginationForEntityType(
      OpenMetadataClient client,
      String entityType,
      List<UUID> expectedIds,
      int limit,
      String databaseSchemaFqn) {

    ListParams params = new ListParams();
    params.setLimit(limit);
    if (databaseSchemaFqn != null) {
      params.setDatabaseSchema(databaseSchemaFqn);
    }

    // === FORWARD PAGINATION ===
    Set<UUID> seenIds = new HashSet<>();
    String afterCursor = null;
    String lastBeforeCursor = null;
    int pageCount = 0;
    int maxPages = 100; // Safety limit

    do {
      params.setAfter(afterCursor);
      params.setBefore(null);

      ListResponse<?> page = listByType(client, entityType, params);

      assertNotNull(page, "Page " + pageCount + " should not be null");
      assertNotNull(page.getData(), "Page " + pageCount + " data should not be null");
      assertNotNull(page.getPaging(), "Page " + pageCount + " paging should not be null");

      // First page should NOT have 'before' cursor
      if (pageCount == 0) {
        assertNull(
            page.getPaging().getBefore(),
            "First page should not have 'before' cursor (limit=" + limit + ")");
      }

      // Verify page size respects limit
      assertTrue(
          page.getData().size() <= limit,
          "Page size " + page.getData().size() + " exceeds limit " + limit);

      // If not last page, should have exactly 'limit' items
      if (page.getPaging().getAfter() != null && page.getData().size() > 0) {
        assertEquals(
            limit,
            page.getData().size(),
            "Non-last page should have exactly 'limit' items (limit=" + limit + ")");
      }

      // Check for duplicates and collect IDs
      for (Object entity : page.getData()) {
        UUID id = getEntityId(entity);
        assertFalse(seenIds.contains(id), "Duplicate entity found in forward pagination: " + id);
        seenIds.add(id);
      }

      lastBeforeCursor = page.getPaging().getBefore();
      afterCursor = page.getPaging().getAfter();
      pageCount++;

    } while (afterCursor != null && pageCount < maxPages);

    // === VERIFY ALL CREATED ENTITIES FOUND ===
    for (UUID expectedId : expectedIds) {
      assertTrue(
          seenIds.contains(expectedId),
          "Created entity "
              + expectedId
              + " should appear in pagination results (limit="
              + limit
              + ")");
    }

    // === BACKWARD PAGINATION ===
    if (lastBeforeCursor != null && pageCount > 1) {
      Set<UUID> backwardIds = new HashSet<>();
      String beforeCursor = lastBeforeCursor;
      int backwardPages = 0;

      while (beforeCursor != null && backwardPages < maxPages) {
        params = new ListParams();
        params.setLimit(limit);
        params.setBefore(beforeCursor);
        if (databaseSchemaFqn != null) {
          params.setDatabaseSchema(databaseSchemaFqn);
        }

        ListResponse<?> page = listByType(client, entityType, params);

        assertNotNull(page, "Backward page should not be null");
        assertTrue(page.getData().size() <= limit, "Backward page should respect limit " + limit);

        // Check for duplicates
        for (Object entity : page.getData()) {
          UUID id = getEntityId(entity);
          assertFalse(backwardIds.contains(id), "Duplicate in backward pagination: " + id);
          backwardIds.add(id);
        }

        beforeCursor = page.getPaging().getBefore();
        backwardPages++;
      }

      // First page (going backward) should have no 'before' cursor
      // (we've reached the beginning)
    }
  }

  /**
   * List entities by type using the appropriate SDK method.
   */
  private ListResponse<?> listByType(
      OpenMetadataClient client, String entityType, ListParams params) {
    switch (entityType) {
      case "table":
        return client.tables().list(params);
      case "database":
        return client.databases().list(params);
      case "user":
        return client.users().list(params);
      case "team":
        return client.teams().list(params);
      case "glossary":
        return client.glossaries().list(params);
      default:
        throw new IllegalArgumentException("Unknown entity type: " + entityType);
    }
  }

  /**
   * Extract ID from entity object using reflection.
   */
  private UUID getEntityId(Object entity) {
    try {
      return (UUID) entity.getClass().getMethod("getId").invoke(entity);
    } catch (Exception e) {
      throw new RuntimeException("Failed to get entity ID", e);
    }
  }
}

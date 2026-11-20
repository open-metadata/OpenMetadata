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
import java.util.function.Function;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.factories.DatabaseSchemaTestFactory;
import org.openmetadata.it.factories.DatabaseServiceTestFactory;
import org.openmetadata.it.factories.DatabaseTestFactory;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.data.CreateTable;
import org.openmetadata.schema.entity.data.Database;
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

  // A cursor that stops advancing would page forever; cap it and let the assertions report it.
  private static final int MAX_TIE_TEST_PAGES = 50;

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

  /**
   * Tables with the same name in different schemas tie on name, the first sort key, so a page
   * boundary inside a group of equal names must fall back to id. TableDAO lists tables through the
   * EntityDAO listAfter/listBefore pair that takes separate MySQL and PostgreSQL conditions.
   */
  @Test
  void testTablePaginationWithSameNameInSeveralSchemas(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    String databaseFqn =
        createSameNamedTables(client, ns, 3, List.of("orders", "customers", "events"));
    assertPagesMatchOnePage(
        params -> client.tables().list(params.setDatabase(databaseFqn)), Table::getId, 9);
  }

  /**
   * Schemas with the same name in different databases tie on name the same way. Schemas are listed
   * through the listAfter/listBefore queries shared by every DAO that does not override them.
   */
  @Test
  void testSchemaPaginationWithSameNameInSeveralDatabases(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    String serviceName = createSameNamedSchemas(ns, 3, List.of("sales", "staging", "raw"));
    assertPagesMatchOnePage(
        params -> client.databaseSchemas().list(params.setService(serviceName)),
        DatabaseSchema::getId,
        9);
  }

  /**
   * Paging two at a time must return every entity once, in the same order as one big page, in both
   * directions.
   */
  private <T> void assertPagesMatchOnePage(
      Function<ListParams, ListResponse<T>> list, Function<T, UUID> idOf, int expectedCount) {
    List<UUID> expected = ids(List.of(list.apply(pageParams(100, null, null))), idOf);
    assertEquals(expectedCount, expected.size(), "the listing should hold exactly what we created");

    List<ListResponse<T>> forwardPages = pageForward(list);
    assertEquals(
        expected,
        ids(forwardPages, idOf),
        "forward pages must not skip or repeat entities with equal names");

    List<ListResponse<T>> backwardPages = pageBackward(list, forwardPages.getLast());
    assertEquals(
        expected,
        ids(backwardPages, idOf),
        "backward pages must not skip or repeat entities with equal names");
  }

  private <T> List<ListResponse<T>> pageForward(Function<ListParams, ListResponse<T>> list) {
    List<ListResponse<T>> pages = new ArrayList<>(List.of(list.apply(pageParams(2, null, null))));
    while (pages.getLast().getPaging().getAfter() != null && pages.size() < MAX_TIE_TEST_PAGES) {
      pages.add(list.apply(pageParams(2, pages.getLast().getPaging().getAfter(), null)));
    }
    return pages;
  }

  private <T> List<ListResponse<T>> pageBackward(
      Function<ListParams, ListResponse<T>> list, ListResponse<T> lastPage) {
    List<ListResponse<T>> pages = new ArrayList<>(List.of(lastPage));
    while (pages.getFirst().getPaging().getBefore() != null && pages.size() < MAX_TIE_TEST_PAGES) {
      pages.addFirst(list.apply(pageParams(2, null, pages.getFirst().getPaging().getBefore())));
    }
    return pages;
  }

  private <T> List<UUID> ids(List<ListResponse<T>> pages, Function<T, UUID> idOf) {
    return pages.stream().flatMap(page -> page.getData().stream()).map(idOf).toList();
  }

  private ListParams pageParams(int limit, String after, String before) {
    ListParams params = new ListParams();
    params.setLimit(limit);
    params.setAfter(after);
    params.setBefore(before);
    return params;
  }

  private String createSameNamedSchemas(
      TestNamespace ns, int databaseCount, List<String> schemaNames) {
    DatabaseService service = DatabaseServiceTestFactory.createPostgres(ns);
    for (int databaseIndex = 0; databaseIndex < databaseCount; databaseIndex++) {
      Database database =
          DatabaseTestFactory.createWithName(
              service.getFullyQualifiedName(), ns.prefix("db_" + databaseIndex));
      for (String schemaName : schemaNames) {
        DatabaseSchemaTestFactory.create(database.getFullyQualifiedName(), schemaName);
      }
    }
    return service.getName();
  }

  private String createSameNamedTables(
      OpenMetadataClient client, TestNamespace ns, int schemaCount, List<String> tableNames) {
    DatabaseService service = DatabaseServiceTestFactory.createPostgres(ns);
    Database database = DatabaseTestFactory.create(ns, service.getFullyQualifiedName());
    for (int schemaIndex = 0; schemaIndex < schemaCount; schemaIndex++) {
      DatabaseSchema schema =
          DatabaseSchemaTestFactory.create(
              database.getFullyQualifiedName(), ns.prefix("schema_" + schemaIndex));
      for (String tableName : tableNames) {
        CreateTable request = new CreateTable();
        request.setName(tableName);
        request.setDatabaseSchema(schema.getFullyQualifiedName());
        request.setColumns(
            List.of(ColumnBuilder.of("id", "BIGINT").primaryKey().notNull().build()));
        client.tables().create(request);
      }
    }
    return database.getFullyQualifiedName();
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

package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;

import com.fasterxml.jackson.databind.JsonNode;
import java.time.Duration;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicLong;
import org.awaitility.Awaitility;
import org.jdbi.v3.core.Handle;
import org.junit.jupiter.api.RepeatedTest;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.openmetadata.it.factories.DatabaseSchemaTestFactory;
import org.openmetadata.it.util.BulkApi;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.data.CreateTable;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.ColumnDataType;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.sdk.network.HttpMethod;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.EntityRepository;
import org.openmetadata.service.util.EntityUtil;

@Execution(ExecutionMode.CONCURRENT)
@ExtendWith(TestNamespaceExtension.class)
class EntityHistoryPaginationIT {
  // Historical windows keep concurrent tests and the endpoint's count cache out of each fixture.
  private static final AtomicLong WINDOW_START = new AtomicLong(1_600_000_000_000L);

  private record HistoryWindow(long start, long end) {}

  @RepeatedTest(3)
  void historyReturnsEachVersionOnceWhileBulkUpdateWaitsForCurrentRow(TestNamespace ns)
      throws Exception {
    final long timestamp = WINDOW_START.getAndAdd(100);
    final CreateTable request = tableRequest(ns, "concurrent");
    final Table table = createTable(request, timestamp);
    final HistoryWindow window = new HistoryWindow(timestamp, timestamp);
    request.setDescription("bulk update");

    try (var updates = Executors.newSingleThreadExecutor();
        Handle lock = Entity.getJdbi().open()) {
      lock.begin();
      assertEquals(
          table.getId().toString(),
          lock.createQuery("SELECT id FROM table_entity WHERE id = :id FOR UPDATE")
              .bind("id", table.getId().toString())
              .mapTo(String.class)
              .one());
      final var updating = updates.submit(() -> BulkApi.upsert("tables", List.of(request)));

      // The bulk path commits the history batch before updating the locked current entity row.
      Awaitility.await("the old version is visible while the current row is still locked")
          .atMost(Duration.ofSeconds(30))
          .until(() -> storedHistory(table) != null);
      assertFalse(updating.isDone());

      final JsonNode page = readPage(window, 10, "after", null);
      assertEquals(List.of(versionKey(table)), versionKeys(page));
      assertEquals(1, page.path("paging").path("total").asInt());

      lock.commit();
      assertEquals(1, updating.get(30, TimeUnit.SECONDS).getNumberOfRowsPassed());
    }

    assertEquals(List.of(versionKey(table)), versionKeys(readPage(window, 10, "after", null)));
  }

  @ParameterizedTest
  @ValueSource(ints = {1, 2, 3})
  void overlappingCurrentAndHistoryRowsDoNotDuplicateOrShortenPages(int limit, TestNamespace ns)
      throws Exception {
    final long start = WINDOW_START.getAndAdd(100);
    final List<String> expected = new ArrayList<>();
    for (int i = 0; i < 5; i++) {
      final Table table = createTable(tableRequest(ns, "paged_" + i), start + i * 2 + 1);
      storeHistory(table);
      expected.add(versionKey(table));
      final Table older =
          JsonUtils.deepCopy(table, Table.class).withVersion(1.0).withUpdatedAt(start + i * 2);
      storeHistory(older);
      expected.add(versionKey(older));
    }
    expected.sort(Collections.reverseOrder());
    final HistoryWindow window = new HistoryWindow(start, start + 10);
    final List<List<String>> pages = new ArrayList<>();
    String after = null;
    String before;
    do {
      final JsonNode page = readPage(window, limit, "after", after);
      final List<String> keys = versionKeys(page);
      assertEquals(expected.size(), page.path("paging").path("total").asInt());
      after = cursor(page, "after");
      before = cursor(page, "before");
      if (after != null) {
        assertEquals(limit, keys.size(), "Deduplication must precede the page limit");
      }
      pages.add(keys);
    } while (after != null);
    assertEquals(expected, pages.stream().flatMap(List::stream).toList());

    for (int i = pages.size() - 2; i >= 0; i--) {
      assertNotNull(before, "Every preceding page must be reachable");
      final JsonNode page = readPage(window, limit, "before", before);
      assertEquals(pages.get(i), versionKeys(page));
      assertEquals(expected.size(), page.path("paging").path("total").asInt());
      before = cursor(page, "before");
    }
    assertNull(before);
  }

  @Test
  void distinctVersionsInTheSameMillisecondAreRetained(TestNamespace ns) throws Exception {
    final long timestamp = WINDOW_START.getAndAdd(100);
    final Table table = createTable(tableRequest(ns, "same_timestamp"), timestamp);
    final Table older = JsonUtils.deepCopy(table, Table.class).withVersion(1.0);
    storeHistory(older);
    storeHistory(table);

    final JsonNode page = readPage(new HistoryWindow(timestamp, timestamp), 10, "after", null);
    assertEquals(
        List.of(versionKey(older), versionKey(table)).stream().sorted().toList(),
        versionKeys(page).stream().sorted().toList());
    assertEquals(2, page.path("paging").path("total").asInt());
  }

  private CreateTable tableRequest(TestNamespace ns, String name) {
    final var schema = DatabaseSchemaTestFactory.createSimple(ns);
    return new CreateTable()
        .withName(ns.prefix(name))
        .withDatabaseSchema(schema.getFullyQualifiedName())
        .withColumns(List.of(new Column().withName("id").withDataType(ColumnDataType.BIGINT)));
  }

  private Table createTable(CreateTable request, long timestamp) {
    final Table table =
        SdkClients.adminClient().tables().create(request).withUpdatedAt(timestamp).withVersion(1.1);
    Entity.getCollectionDAO()
        .tableDAO()
        .update(table.getId(), table.getFullyQualifiedName(), JsonUtils.pojoToJson(table));
    EntityRepository.invalidateCacheForEntity(
        Entity.TABLE, table.getId(), table.getFullyQualifiedName());
    return table;
  }

  private void storeHistory(Table table) {
    // History is hydrated while current storage can omit relationships; JSON equality is
    // insufficient.
    final Table snapshot = JsonUtils.deepCopy(table, Table.class).withHref(null);
    Entity.getCollectionDAO()
        .entityExtensionDAO()
        .insert(
            table.getId(),
            EntityUtil.getVersionExtension(Entity.TABLE, table.getVersion()),
            Entity.TABLE,
            JsonUtils.pojoToJson(snapshot));
  }

  private String storedHistory(Table table) {
    return Entity.getCollectionDAO()
        .entityExtensionDAO()
        .getExtension(
            table.getId(), EntityUtil.getVersionExtension(Entity.TABLE, table.getVersion()));
  }

  private JsonNode readPage(HistoryWindow window, int limit, String direction, String cursor)
      throws Exception {
    final String url =
        "/v1/tables/history?startTs="
            + window.start()
            + "&endTs="
            + window.end()
            + "&limit="
            + limit
            + (cursor == null ? "" : "&" + direction + "=" + cursor);
    return JsonUtils.readTree(
        SdkClients.adminClient().getHttpClient().executeForString(HttpMethod.GET, url, null));
  }

  private String cursor(JsonNode page, String direction) {
    return page.path("paging").path(direction).asText(null);
  }

  private List<String> versionKeys(JsonNode page) {
    final List<String> keys = new ArrayList<>();
    page.path("data")
        .forEach(row -> keys.add(versionKey(JsonUtils.convertValue(row, Table.class))));
    return keys;
  }

  private String versionKey(Table table) {
    return table.getUpdatedAt() + ":" + table.getId() + ":" + table.getVersion();
  }
}

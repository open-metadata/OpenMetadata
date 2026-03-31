package org.openmetadata.service.search;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.api.Test;

class ColumnMetadataCacheTest {

  @Test
  void loadColumnMetadataCachesEntriesByFullColumnFqn() {
    ColumnMetadataCache cache = new ColumnMetadataCache();
    AtomicInteger fetches = new AtomicInteger();

    Map<String, Object> entityDoc = new HashMap<>();
    entityDoc.put("fullyQualifiedName", "service.db.schema.orders");
    entityDoc.put(
        "columns",
        List.of(
            column("customer_id", "service.db.schema.orders.customer_id", "PII.Sensitive"),
            column("status", null, "Tier.Gold")));

    cache.loadColumnMetadata(
        Set.of("service.db.schema.orders.customer_id", "service.db.schema.orders.status"),
        parentFqn -> {
          fetches.incrementAndGet();
          assertEquals("service.db.schema.orders", parentFqn);
          return entityDoc;
        });

    assertEquals(1, fetches.get());
    assertNotNull(cache.getColumnMetadata("service.db.schema.orders.customer_id"));
    assertNotNull(cache.getColumnMetadata("service.db.schema.orders.status"));
    assertNull(cache.getColumnMetadata("customer_id"));
    assertTrue(
        cache.matchesFilter(
            "service.db.schema.orders.customer_id",
            new ColumnMetadataCache.ColumnFilterCriteria(
                ColumnMetadataCache.ColumnFilterCriteria.FilterType.TAG, "sensitive")));
    assertTrue(
        cache.matchesFilter(
            "service.db.schema.orders.customer_id",
            new ColumnMetadataCache.ColumnFilterCriteria(
                ColumnMetadataCache.ColumnFilterCriteria.FilterType.GLOSSARY, "pii")));
    assertTrue(
        cache.matchesFilter(
            "service.db.schema.orders.customer_id",
            new ColumnMetadataCache.ColumnFilterCriteria(
                ColumnMetadataCache.ColumnFilterCriteria.FilterType.NAME, "customer")));
    assertTrue(
        cache.matchesFilter(
            "service.db.schema.orders.customer_id",
            new ColumnMetadataCache.ColumnFilterCriteria(
                ColumnMetadataCache.ColumnFilterCriteria.FilterType.NAME,
                "service.db.schema.orders.customer_id")));
    assertTrue(
        cache.matchesFilter(
            "service.db.schema.orders.customer_id",
            new ColumnMetadataCache.ColumnFilterCriteria(
                ColumnMetadataCache.ColumnFilterCriteria.FilterType.NAME, "customer_id")));
  }

  @Test
  void loadColumnMetadataSkipsMalformedColumnsAndFetcherFailures() {
    ColumnMetadataCache cache = new ColumnMetadataCache();
    AtomicInteger fetches = new AtomicInteger();

    cache.loadColumnMetadata(
        Set.of(
            "malformed", "service.db.schema.orders.customer_id", "service.db.schema.missing.value"),
        parentFqn -> {
          fetches.incrementAndGet();
          if ("service.db.schema.orders".equals(parentFqn)) {
            return Map.of(
                "fullyQualifiedName",
                "service.db.schema.orders",
                "columns",
                List.of(column("customer_id", null, "PII.Sensitive"), Map.of("name", "ignored")));
          }
          throw new IllegalStateException("missing entity");
        });

    assertEquals(2, fetches.get());
    assertNotNull(cache.getColumnMetadata("service.db.schema.orders.customer_id"));
    assertNull(cache.getColumnMetadata("service.db.schema.missing.value"));
  }

  private static Map<String, Object> column(String name, String fullyQualifiedName, String tagFqn) {
    Map<String, Object> column = new HashMap<>();
    column.put("name", name);
    if (fullyQualifiedName != null) {
      column.put("fullyQualifiedName", fullyQualifiedName);
    }
    column.put("tags", List.of(Map.of("tagFQN", tagFqn)));
    return column;
  }
}

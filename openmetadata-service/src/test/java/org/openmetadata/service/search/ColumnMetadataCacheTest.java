package org.openmetadata.service.search;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.io.IOException;
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
            column(
                "customer_id",
                "service.db.schema.orders.customer_id",
                tag("PII.Sensitive", "Classification"),
                tag("Glossary.Customer", "Glossary")),
            column("status", null, tag("Tier.Gold", "Classification"))));

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
                ColumnMetadataCache.ColumnFilterCriteria.FilterType.GLOSSARY, "customer")));
    assertFalse(
        cache.matchesFilter(
            "service.db.schema.orders.customer_id",
            new ColumnMetadataCache.ColumnFilterCriteria(
                ColumnMetadataCache.ColumnFilterCriteria.FilterType.GLOSSARY, "sensitive")));
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
                List.of(
                    column("customer_id", null, tag("PII.Sensitive", "Classification")),
                    Map.of("name", "ignored")));
          }
          throw new IllegalStateException("missing entity");
        });

    assertEquals(2, fetches.get());
    assertNotNull(cache.getColumnMetadata("service.db.schema.orders.customer_id"));
    assertNull(cache.getColumnMetadata("service.db.schema.missing.value"));
  }

  @Test
  void loadColumnMetadataUsesBatchFetcherAndCachesParents() {
    ColumnMetadataCache cache = new ColumnMetadataCache();
    AtomicInteger batchFetches = new AtomicInteger();
    AtomicInteger fallbackFetches = new AtomicInteger();

    cache.loadColumnMetadata(
        Set.of(
            "service.db.schema.orders.customer_id",
            "service.db.schema.orders.status",
            "service.db.schema.payments.amount"),
        parentFqns -> {
          batchFetches.incrementAndGet();
          assertEquals(
              Set.of("service.db.schema.orders", "service.db.schema.payments"), parentFqns);

          Map<String, Map<String, Object>> docs = new HashMap<>();
          docs.put(
              "service.db.schema.orders",
              Map.of(
                  "fullyQualifiedName",
                  "service.db.schema.orders",
                  "columns",
                  List.of(
                      column(
                          "customer_id",
                          "service.db.schema.orders.customer_id",
                          tag("PII.Sensitive", "Classification")),
                      column(
                          "status",
                          "service.db.schema.orders.status",
                          tag("Tier.Gold", "Classification")))));
          docs.put(
              "service.db.schema.payments",
              Map.of(
                  "fullyQualifiedName",
                  "service.db.schema.payments",
                  "columns",
                  List.of(
                      column(
                          "amount",
                          "service.db.schema.payments.amount",
                          tag("Finance", "Classification")))));

          return docs;
        },
        parentFqn -> {
          fallbackFetches.incrementAndGet();
          return Map.of();
        });

    cache.loadColumnMetadata(
        Set.of("service.db.schema.orders.customer_id"),
        parentFqns -> {
          batchFetches.incrementAndGet();
          return Map.of();
        },
        parentFqn -> {
          fallbackFetches.incrementAndGet();
          return Map.of();
        });

    assertEquals(1, batchFetches.get());
    assertEquals(0, fallbackFetches.get());
    assertNotNull(cache.getColumnMetadata("service.db.schema.orders.customer_id"));
    assertNotNull(cache.getColumnMetadata("service.db.schema.orders.status"));
    assertNotNull(cache.getColumnMetadata("service.db.schema.payments.amount"));
  }

  @Test
  void loadColumnMetadataFallsBackToSingleFetchWhenBatchFails() {
    ColumnMetadataCache cache = new ColumnMetadataCache();
    AtomicInteger fallbackFetches = new AtomicInteger();

    cache.loadColumnMetadata(
        Set.of("service.db.schema.orders.customer_id"),
        parentFqns -> {
          throw new IOException("batch failed");
        },
        parentFqn -> {
          fallbackFetches.incrementAndGet();
          return Map.of(
              "fullyQualifiedName",
              parentFqn,
              "columns",
              List.of(column("customer_id", null, tag("PII.Sensitive", "Classification"))));
        });

    assertEquals(1, fallbackFetches.get());
    assertNotNull(cache.getColumnMetadata("service.db.schema.orders.customer_id"));
  }

  private static Map<String, Object> column(
      String name, String fullyQualifiedName, Map<String, Object>... tags) {
    Map<String, Object> column = new HashMap<>();
    column.put("name", name);
    if (fullyQualifiedName != null) {
      column.put("fullyQualifiedName", fullyQualifiedName);
    }
    column.put("tags", List.of(tags));
    return column;
  }

  private static Map<String, Object> tag(String tagFqn, String source) {
    return Map.of("tagFQN", tagFqn, "source", source);
  }
}

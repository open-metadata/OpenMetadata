package org.openmetadata.service.search;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;
import java.util.Set;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.api.lineage.EsLineageData;
import org.openmetadata.schema.type.ColumnLineage;
import org.openmetadata.service.search.ColumnMetadataCache.ColumnFilterCriteria;
import org.openmetadata.service.search.ColumnMetadataCache.ColumnFilterCriteria.FilterType;

class ColumnFilterMatcherTest {

  @Test
  void matchesColumnFilterSupportsNameBasedCriteria() {
    EsLineageData edge =
        new EsLineageData()
            .withColumns(
                List.of(
                    new ColumnLineage()
                        .withFromColumns(List.of("service.db.schema.customers.customer_id"))
                        .withToColumn("service.db.schema.orders.customer_id")));

    assertTrue(ColumnFilterMatcher.matchesColumnFilter(edge, "columnName:customer_id"));
    assertTrue(
        ColumnFilterMatcher.matchesColumnFilter(
            edge, "column:service.db.schema.orders.customer_id"));
    assertTrue(ColumnFilterMatcher.matchesColumnFilter(edge, "fromColumn:customers"));
    assertTrue(ColumnFilterMatcher.matchesColumnFilter(edge, "toColumn:orders.customer_id"));
    assertTrue(ColumnFilterMatcher.matchesColumnFilter(edge, "customer"));
    assertFalse(ColumnFilterMatcher.matchesColumnFilter(edge, "toColumn:missing"));
  }

  @Test
  void matchesColumnFilterUsesMetadataCacheForTagAndGlossaryFilters() {
    EsLineageData edge =
        new EsLineageData()
            .withColumns(
                List.of(
                    new ColumnLineage()
                        .withFromColumns(List.of("service.db.schema.customers.customer_id"))
                        .withToColumn("service.db.schema.orders.customer_id")));
    ColumnMetadataCache cache = new ColumnMetadataCache();

    assertFalse(
        cache.matchesFilter(
            "service.db.schema.customers.customer_id",
            new ColumnFilterCriteria(FilterType.TAG, "Sensitive")));

    cache.loadColumnMetadata(
        Set.of("service.db.schema.customers.customer_id", "service.db.schema.orders.customer_id"),
        parentFqn ->
            switch (parentFqn) {
              case "service.db.schema.customers" -> doc(
                  "service.db.schema.customers", column("customer_id", "PII.Sensitive"));
              case "service.db.schema.orders" -> doc(
                  "service.db.schema.orders", column("customer_id", "Glossary.Location"));
              default -> throw new IllegalArgumentException(parentFqn);
            });

    assertTrue(ColumnFilterMatcher.matchesColumnFilter(edge, "tag:sensitive", cache));
    assertTrue(ColumnFilterMatcher.matchesColumnFilter(edge, "tags:sensitive", cache));
    assertTrue(ColumnFilterMatcher.matchesColumnFilter(edge, "glossary:location", cache));
    assertTrue(ColumnFilterMatcher.matchesColumnFilter(edge, "column:customer_id", cache));
    assertFalse(ColumnFilterMatcher.matchesColumnFilter(edge, "tag:missing", cache));
  }

  @Test
  void matchesColumnFilterRejectsMalformedTypedFiltersAndExtractsFqns() {
    EsLineageData edge =
        new EsLineageData()
            .withColumns(
                List.of(
                    new ColumnLineage()
                        .withFromColumns(List.of("service.db.schema.customers.customer_id"))
                        .withToColumn("service.db.schema.orders.customer_id")));
    EsLineageData edgeWithoutColumns = new EsLineageData();

    assertFalse(ColumnFilterMatcher.matchesColumnFilter(edge, "tag:"));
    assertFalse(ColumnFilterMatcher.matchesColumnFilter(edge, "tag:", new ColumnMetadataCache()));
    assertFalse(ColumnFilterMatcher.matchesColumnFilter(edge, ":customer_id"));
    assertFalse(ColumnFilterMatcher.matchesColumnFilter(edgeWithoutColumns, "customer_id"));
    assertTrue(ColumnFilterMatcher.matchesColumnFilter(null, "tag:"));
    assertTrue(
        ColumnFilterMatcher.matchesColumnFilter(null, "customer_id", new ColumnMetadataCache()));
    assertTrue(ColumnFilterMatcher.extractColumnFqns(null).isEmpty());
    assertEquals(
        Set.of("service.db.schema.customers.customer_id", "service.db.schema.orders.customer_id"),
        ColumnFilterMatcher.extractColumnFqns(edge));
  }

  private static java.util.Map<String, Object> doc(
      String fullyQualifiedName, java.util.Map<String, Object> column) {
    return java.util.Map.of("fullyQualifiedName", fullyQualifiedName, "columns", List.of(column));
  }

  private static java.util.Map<String, Object> column(String name, String tagFqn) {
    return java.util.Map.of("name", name, "tags", List.of(java.util.Map.of("tagFQN", tagFqn)));
  }
}

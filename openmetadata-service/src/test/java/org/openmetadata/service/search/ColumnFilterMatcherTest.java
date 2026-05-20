package org.openmetadata.service.search;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
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

  // --- normalizeFilterType tests ---

  @Test
  void requiresMetadataForFilterDetectsTagAndGlossaryFilters() {
    assertTrue(ColumnFilterMatcher.requiresMetadataForFilter("tag:PII.Sensitive"));
    assertTrue(ColumnFilterMatcher.requiresMetadataForFilter("glossary:BusinessTerm"));
    assertFalse(ColumnFilterMatcher.requiresMetadataForFilter("columnName:customer_id"));
    assertFalse(ColumnFilterMatcher.requiresMetadataForFilter("customer_id"));
    assertFalse(ColumnFilterMatcher.requiresMetadataForFilter(null));
    assertFalse(ColumnFilterMatcher.requiresMetadataForFilter(""));
  }

  @Test
  void requiresMetadataForFilterDetectsTagInCommaFilters() {
    assertTrue(ColumnFilterMatcher.requiresMetadataForFilter("columnName:id,tag:PII"));
    assertTrue(ColumnFilterMatcher.requiresMetadataForFilter("glossary:Term,columnName:id"));
    assertFalse(ColumnFilterMatcher.requiresMetadataForFilter("columnName:id,fromColumn:email"));
  }

  // --- filterMatchingColumns tests ---

  @Test
  void filterMatchingColumnsReturnsSingleMatch() {
    ColumnLineage matchCol =
        new ColumnLineage()
            .withFromColumns(List.of("svc.db.schema.tbl.email"))
            .withToColumn("svc.db.schema.tbl2.email");
    ColumnLineage noMatchCol =
        new ColumnLineage()
            .withFromColumns(List.of("svc.db.schema.tbl.age"))
            .withToColumn("svc.db.schema.tbl2.age");
    EsLineageData edge = new EsLineageData().withColumns(List.of(matchCol, noMatchCol));

    List<ColumnLineage> result =
        ColumnFilterMatcher.filterMatchingColumns(edge, "columnName:email");

    assertEquals(1, result.size());
    assertEquals("svc.db.schema.tbl2.email", result.get(0).getToColumn());
  }

  @Test
  void filterMatchingColumnsReturnsAllColumnsWhenFilterIsNull() {
    ColumnLineage col =
        new ColumnLineage()
            .withFromColumns(List.of("svc.db.tbl.id"))
            .withToColumn("svc.db.tbl2.id");
    EsLineageData edge = new EsLineageData().withColumns(List.of(col));

    List<ColumnLineage> result = ColumnFilterMatcher.filterMatchingColumns(edge, null);

    assertEquals(1, result.size());
  }

  @Test
  void filterMatchingColumnsReturnsEmptyListForNullEdge() {
    List<ColumnLineage> result = ColumnFilterMatcher.filterMatchingColumns(null, "columnName:id");

    assertTrue(result.isEmpty());
  }

  @Test
  void filterMatchingColumnsReturnsEmptyForNoColumns() {
    EsLineageData edge = new EsLineageData();

    List<ColumnLineage> result = ColumnFilterMatcher.filterMatchingColumns(edge, "columnName:id");

    assertTrue(result.isEmpty());
  }

  @Test
  void filterMatchingColumnsReturnsEmptyForMalformedFilter() {
    ColumnLineage col =
        new ColumnLineage()
            .withFromColumns(List.of("svc.db.tbl.id"))
            .withToColumn("svc.db.tbl2.id");
    EsLineageData edge = new EsLineageData().withColumns(List.of(col));

    List<ColumnLineage> result = ColumnFilterMatcher.filterMatchingColumns(edge, "tag:");

    assertTrue(result.isEmpty());
  }

  // --- filterMatchingColumnsWithMetadata tests ---

  @Test
  void filterMatchingColumnsWithMetadataReturnsMatchingByTag() throws Exception {
    ColumnLineage col =
        new ColumnLineage()
            .withFromColumns(List.of("svc.db.schema.tbl.email"))
            .withToColumn("svc.db.schema.tbl2.email");
    ColumnLineage noMatchCol =
        new ColumnLineage()
            .withFromColumns(List.of("svc.db.schema.tbl.age"))
            .withToColumn("svc.db.schema.tbl2.age");
    EsLineageData edge = new EsLineageData().withColumns(List.of(col, noMatchCol));

    ColumnMetadataCache cache = new ColumnMetadataCache();
    cache.loadColumnMetadata(
        Set.of("svc.db.schema.tbl.email", "svc.db.schema.tbl2.email"),
        parentFqn -> doc(parentFqn, column("email", "PII.Email")));

    List<ColumnLineage> result =
        ColumnFilterMatcher.filterMatchingColumnsWithMetadata(edge, "tag:PII", cache);

    assertEquals(1, result.size());
    assertEquals("svc.db.schema.tbl2.email", result.get(0).getToColumn());
  }

  @Test
  void filterMatchingColumnsWithMetadataReturnsAllWhenFilterIsNull() {
    ColumnLineage col =
        new ColumnLineage()
            .withFromColumns(List.of("svc.db.tbl.id"))
            .withToColumn("svc.db.tbl2.id");
    EsLineageData edge = new EsLineageData().withColumns(List.of(col));

    List<ColumnLineage> result =
        ColumnFilterMatcher.filterMatchingColumnsWithMetadata(
            edge, null, new ColumnMetadataCache());

    assertEquals(1, result.size());
  }

  @Test
  void filterMatchingColumnsWithMetadataReturnsEmptyForNullEdge() {
    List<ColumnLineage> result =
        ColumnFilterMatcher.filterMatchingColumnsWithMetadata(
            null, "tag:PII", new ColumnMetadataCache());

    assertTrue(result.isEmpty());
  }

  @Test
  void filterMatchingColumnsWithMetadataReturnsEmptyForNoColumns() {
    EsLineageData edge = new EsLineageData();

    List<ColumnLineage> result =
        ColumnFilterMatcher.filterMatchingColumnsWithMetadata(
            edge, "tag:PII", new ColumnMetadataCache());

    assertTrue(result.isEmpty());
  }

  // --- Comma-separated multi-filter tests ---

  @Test
  void matchesColumnFilterWithCommaFiltersAppliesAndAcrossTypes() {
    ColumnLineage col =
        new ColumnLineage()
            .withFromColumns(List.of("svc.db.schema.tbl.customer_id"))
            .withToColumn("svc.db.schema.tbl2.customer_id");
    EsLineageData edge = new EsLineageData().withColumns(List.of(col));

    assertTrue(
        ColumnFilterMatcher.matchesColumnFilter(
            edge, "columnName:customer_id,fromColumn:customer_id"));

    assertFalse(
        ColumnFilterMatcher.matchesColumnFilter(
            edge, "columnName:customer_id,toColumn:missing_col"));
  }

  @Test
  void matchesColumnFilterWithCommaFiltersOrWithinSameType() {
    ColumnLineage col =
        new ColumnLineage()
            .withFromColumns(List.of("svc.db.schema.tbl.email"))
            .withToColumn("svc.db.schema.tbl2.email");
    EsLineageData edge = new EsLineageData().withColumns(List.of(col));

    assertTrue(ColumnFilterMatcher.matchesColumnFilter(edge, "columnName:email,columnName:phone"));
  }

  @Test
  void matchesColumnFilterWithCommaFiltersAndMetadataCache() throws Exception {
    ColumnLineage col =
        new ColumnLineage()
            .withFromColumns(List.of("svc.db.schema.tbl.email"))
            .withToColumn("svc.db.schema.tbl2.email");
    EsLineageData edge = new EsLineageData().withColumns(List.of(col));

    ColumnMetadataCache cache = new ColumnMetadataCache();
    cache.loadColumnMetadata(
        Set.of("svc.db.schema.tbl.email", "svc.db.schema.tbl2.email"),
        parentFqn -> doc(parentFqn, column("email", "PII.Email")));

    assertTrue(ColumnFilterMatcher.matchesColumnFilter(edge, "columnName:email,tag:PII", cache));

    assertFalse(
        ColumnFilterMatcher.matchesColumnFilter(edge, "columnName:email,tag:MissingTag", cache));
  }

  @Test
  void matchesColumnFilterWithEmptyColumnsReturnsFalseForCommaFilter() {
    EsLineageData edge = new EsLineageData();

    assertFalse(ColumnFilterMatcher.matchesColumnFilter(edge, "columnName:id,tag:PII"));
  }

  @Test
  void matchesColumnFilterWithNullEdgeReturnsTrueForCommaFilter() {
    assertTrue(ColumnFilterMatcher.matchesColumnFilter(null, "columnName:id,tag:PII"));
  }

  // --- fromColumn / toColumn filter direction tests ---

  @Test
  void matchesColumnFilterDistinguishesFromAndToColumn() {
    ColumnLineage col =
        new ColumnLineage()
            .withFromColumns(List.of("svc.db.schema.source.sender"))
            .withToColumn("svc.db.schema.target.receiver");
    EsLineageData edge = new EsLineageData().withColumns(List.of(col));

    assertTrue(ColumnFilterMatcher.matchesColumnFilter(edge, "fromColumn:sender"));
    assertFalse(ColumnFilterMatcher.matchesColumnFilter(edge, "fromColumn:receiver"));
    assertTrue(ColumnFilterMatcher.matchesColumnFilter(edge, "toColumn:receiver"));
    assertFalse(ColumnFilterMatcher.matchesColumnFilter(edge, "toColumn:sender"));
    assertTrue(ColumnFilterMatcher.matchesColumnFilter(edge, "from:sender"));
    assertTrue(ColumnFilterMatcher.matchesColumnFilter(edge, "to:receiver"));
  }

  // --- extractColumnFqns tests ---

  @Test
  void extractColumnFqnsCollectsAllFromAndToColumns() {
    ColumnLineage col1 =
        new ColumnLineage().withFromColumns(List.of("a.b.c.d", "e.f.g.h")).withToColumn("i.j.k.l");
    ColumnLineage col2 =
        new ColumnLineage().withFromColumns(List.of("m.n.o.p")).withToColumn("q.r.s.t");
    EsLineageData edge = new EsLineageData().withColumns(List.of(col1, col2));

    Set<String> fqns = ColumnFilterMatcher.extractColumnFqns(edge);

    assertEquals(Set.of("a.b.c.d", "e.f.g.h", "i.j.k.l", "m.n.o.p", "q.r.s.t"), fqns);
  }

  @Test
  void extractColumnFqnsHandlesNullFromAndToColumns() {
    ColumnLineage col = new ColumnLineage();
    EsLineageData edge = new EsLineageData().withColumns(List.of(col));

    Set<String> fqns = ColumnFilterMatcher.extractColumnFqns(edge);

    assertTrue(fqns.isEmpty());
  }

  // --- parseColumnFilter edge cases (tested indirectly via matchesColumnFilter) ---

  @Test
  void matchesColumnFilterDefaultsToAnyMatchForPlainValue() {
    ColumnLineage col =
        new ColumnLineage()
            .withFromColumns(List.of("svc.db.schema.tbl.customer_id"))
            .withToColumn("svc.db.schema.tbl2.order_id");
    EsLineageData edge = new EsLineageData().withColumns(List.of(col));

    assertTrue(ColumnFilterMatcher.matchesColumnFilter(edge, "customer"));
    assertTrue(ColumnFilterMatcher.matchesColumnFilter(edge, "order_id"));
    assertFalse(ColumnFilterMatcher.matchesColumnFilter(edge, "missing_col"));
  }

  @Test
  void matchesColumnFilterWithNullFromColumns() {
    ColumnLineage col = new ColumnLineage().withToColumn("svc.db.schema.tbl.id");
    EsLineageData edge = new EsLineageData().withColumns(List.of(col));

    assertTrue(ColumnFilterMatcher.matchesColumnFilter(edge, "toColumn:id"));
    assertFalse(ColumnFilterMatcher.matchesColumnFilter(edge, "fromColumn:id"));
  }

  @Test
  void matchesColumnFilterWithEmptyFromColumns() {
    ColumnLineage col =
        new ColumnLineage().withFromColumns(new ArrayList<>()).withToColumn("svc.db.schema.tbl.id");
    EsLineageData edge = new EsLineageData().withColumns(List.of(col));

    assertFalse(ColumnFilterMatcher.matchesColumnFilter(edge, "fromColumn:id"));
  }

  // --- Grouped filter with metadata (matchesGroupedCriteriaWithMetadata) ---

  @Test
  void filterMatchingColumnsWithMetadataComboColumnAndTag() throws Exception {
    ColumnLineage emailCol =
        new ColumnLineage()
            .withFromColumns(List.of("svc.db.s.t1.email"))
            .withToColumn("svc.db.s.t2.email");
    ColumnLineage ageCol =
        new ColumnLineage()
            .withFromColumns(List.of("svc.db.s.t1.age"))
            .withToColumn("svc.db.s.t2.age");
    EsLineageData edge = new EsLineageData().withColumns(List.of(emailCol, ageCol));

    ColumnMetadataCache cache = new ColumnMetadataCache();
    cache.loadColumnMetadata(
        Set.of("svc.db.s.t1.email", "svc.db.s.t2.email", "svc.db.s.t1.age", "svc.db.s.t2.age"),
        parentFqn -> {
          if (parentFqn.equals("svc.db.s.t1")) {
            return Map.of(
                "fullyQualifiedName",
                parentFqn,
                "columns",
                List.of(column("email", "PII.Email"), column("age", "Internal")));
          }
          return Map.of(
              "fullyQualifiedName",
              parentFqn,
              "columns",
              List.of(column("email", "PII.Email"), column("age", "Internal")));
        });

    List<ColumnLineage> result =
        ColumnFilterMatcher.filterMatchingColumnsWithMetadata(
            edge, "columnName:email,tag:PII", cache);

    assertEquals(1, result.size());
    assertEquals("svc.db.s.t2.email", result.get(0).getToColumn());
  }

  @Test
  void matchesMultipleFiltersWithMetadataReturnsFalseForEmptyGroupedFilters() throws Exception {
    ColumnLineage col =
        new ColumnLineage()
            .withFromColumns(List.of("svc.db.schema.tbl.id"))
            .withToColumn("svc.db.schema.tbl2.id");
    EsLineageData edge = new EsLineageData().withColumns(List.of(col));

    // A filter that parses to empty grouped filters (malformed ":" produces null criteria)
    assertFalse(ColumnFilterMatcher.matchesColumnFilter(edge, ":,:"));
    assertFalse(ColumnFilterMatcher.matchesColumnFilter(edge, ":,:", new ColumnMetadataCache()));
  }

  @Test
  void matchesGroupedCriteriaWithMetadataTagMatching() throws Exception {
    ColumnLineage col =
        new ColumnLineage()
            .withFromColumns(List.of("svc.db.s.t1.email"))
            .withToColumn("svc.db.s.t2.email");
    EsLineageData edge = new EsLineageData().withColumns(List.of(col));

    ColumnMetadataCache cache = new ColumnMetadataCache();
    cache.loadColumnMetadata(
        Set.of("svc.db.s.t1.email", "svc.db.s.t2.email"),
        parentFqn -> doc(parentFqn, column("email", "PII.Email")));

    // tag filter with metadata cache - should match via grouped criteria with metadata
    List<ColumnLineage> result =
        ColumnFilterMatcher.filterMatchingColumnsWithMetadata(edge, "tag:PII", cache);
    assertEquals(1, result.size());
    assertEquals("svc.db.s.t2.email", result.get(0).getToColumn());
  }

  @Test
  void matchesGroupedCriteriaWithMetadataGlossaryMatching() throws Exception {
    ColumnLineage col =
        new ColumnLineage()
            .withFromColumns(List.of("svc.db.s.t1.name"))
            .withToColumn("svc.db.s.t2.name");
    EsLineageData edge = new EsLineageData().withColumns(List.of(col));

    ColumnMetadataCache cache = new ColumnMetadataCache();
    cache.loadColumnMetadata(
        Set.of("svc.db.s.t1.name", "svc.db.s.t2.name"),
        parentFqn ->
            Map.of(
                "fullyQualifiedName",
                parentFqn,
                "columns",
                List.of(
                    Map.of(
                        "name",
                        "name",
                        "tags",
                        List.of(
                            Map.of("tagFQN", "Glossary.CustomerName", "source", "Glossary"))))));

    List<ColumnLineage> result =
        ColumnFilterMatcher.filterMatchingColumnsWithMetadata(edge, "glossary:CustomerName", cache);
    assertEquals(1, result.size());
  }

  @Test
  void filterMatchingColumnsWithMetadataReturnsEmptyForMalformedFilter() {
    ColumnLineage col =
        new ColumnLineage()
            .withFromColumns(List.of("svc.db.tbl.id"))
            .withToColumn("svc.db.tbl2.id");
    EsLineageData edge = new EsLineageData().withColumns(List.of(col));

    List<ColumnLineage> result =
        ColumnFilterMatcher.filterMatchingColumnsWithMetadata(
            edge, "tag:", new ColumnMetadataCache());
    assertTrue(result.isEmpty());
  }

  @Test
  void normalizeFilterTypeHandlesUnknownTypesAsColumn() {
    ColumnLineage col =
        new ColumnLineage()
            .withFromColumns(List.of("svc.db.schema.tbl.customer_id"))
            .withToColumn("svc.db.schema.tbl2.customer_id");
    EsLineageData edge = new EsLineageData().withColumns(List.of(col));

    // "unknowntype" should normalize to "column" and match via column name matching
    assertTrue(ColumnFilterMatcher.matchesColumnFilter(edge, "unknowntype:customer_id"));
  }

  @Test
  void matchesMultipleFiltersWithMetadataTagAndColumnCombination() throws Exception {
    ColumnLineage emailCol =
        new ColumnLineage()
            .withFromColumns(List.of("svc.db.s.t1.email"))
            .withToColumn("svc.db.s.t2.email");
    ColumnLineage ageCol =
        new ColumnLineage()
            .withFromColumns(List.of("svc.db.s.t1.age"))
            .withToColumn("svc.db.s.t2.age");
    EsLineageData edge = new EsLineageData().withColumns(List.of(emailCol, ageCol));

    ColumnMetadataCache cache = new ColumnMetadataCache();
    cache.loadColumnMetadata(
        Set.of("svc.db.s.t1.email", "svc.db.s.t2.email", "svc.db.s.t1.age", "svc.db.s.t2.age"),
        parentFqn ->
            Map.of(
                "fullyQualifiedName",
                parentFqn,
                "columns",
                List.of(column("email", "PII.Email"), column("age", "Internal"))));

    // AND across types: column=email AND tag=PII → true
    assertTrue(ColumnFilterMatcher.matchesColumnFilter(edge, "columnName:email,tag:PII", cache));
    // AND across types: column=email AND tag=MissingTag → false
    assertFalse(
        ColumnFilterMatcher.matchesColumnFilter(edge, "columnName:email,tag:MissingTag", cache));
    // AND across types: column=age AND tag=PII - true because age matches column filter
    // and email matches PII tag filter; AND is satisfied across all columns in the edge
    assertTrue(ColumnFilterMatcher.matchesColumnFilter(edge, "columnName:age,tag:PII", cache));
  }

  @Test
  void matchesColumnFilterFromColumnsMatchWithMetadata() throws Exception {
    ColumnLineage col =
        new ColumnLineage()
            .withFromColumns(List.of("svc.db.s.t1.email"))
            .withToColumn("svc.db.s.t2.id");
    EsLineageData edge = new EsLineageData().withColumns(List.of(col));

    ColumnMetadataCache cache = new ColumnMetadataCache();
    cache.loadColumnMetadata(
        Set.of("svc.db.s.t1.email", "svc.db.s.t2.id"),
        parentFqn -> {
          if (parentFqn.equals("svc.db.s.t1")) {
            return doc(parentFqn, column("email", "PII.Email"));
          }
          return Map.of("fullyQualifiedName", parentFqn, "columns", List.of(Map.of("name", "id")));
        });

    // fromColumn has PII tag → match
    assertTrue(ColumnFilterMatcher.matchesColumnFilter(edge, "tag:PII", cache));
  }

  // --- matchesColumnName case insensitive matching ---

  @Test
  void matchesColumnFilterIsCaseInsensitive() {
    EsLineageData edge = new EsLineageData();
    edge.setColumns(
        List.of(
            new ColumnLineage()
                .withFromColumns(List.of("svc.db.schema.t1.CUSTOMER_ID"))
                .withToColumn("svc.db.schema.t2.customer_id")));

    assertTrue(ColumnFilterMatcher.matchesColumnFilter(edge, "columnName:customer_id"));
    assertTrue(ColumnFilterMatcher.matchesColumnFilter(edge, "columnName:CUSTOMER_ID"));
  }

  // --- matchesColumnName with single-part FQN (no dots) ---

  @Test
  void matchesColumnFilterWithSinglePartColumnName() {
    EsLineageData edge = new EsLineageData();
    edge.setColumns(
        List.of(new ColumnLineage().withFromColumns(List.of("email")).withToColumn("email_dest")));

    assertTrue(ColumnFilterMatcher.matchesColumnFilter(edge, "columnName:email"));
  }

  // --- normalizeFilterType(null) ---

  @Test
  void matchesColumnFilterWithNullTypeDefaultsToAny() {
    // When filter has no colon, parseColumnFilter returns FilterCriteria("any", value)
    // "any" normalizes to "column"
    EsLineageData edge = new EsLineageData();
    edge.setColumns(
        List.of(
            new ColumnLineage()
                .withFromColumns(List.of("svc.db.schema.t1.name"))
                .withToColumn("svc.db.schema.t2.name")));

    assertTrue(ColumnFilterMatcher.matchesColumnFilter(edge, "name"));
  }

  private static Map<String, Object> doc(String fullyQualifiedName, Map<String, Object> column) {
    return Map.of("fullyQualifiedName", fullyQualifiedName, "columns", List.of(column));
  }

  private static Map<String, Object> column(String name, String tagFqn) {
    String source = tagFqn.startsWith("Glossary.") ? "Glossary" : "Classification";
    return Map.of("name", name, "tags", List.of(Map.of("tagFQN", tagFqn, "source", source)));
  }
}

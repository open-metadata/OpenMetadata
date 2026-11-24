package org.openmetadata.service.search.opensearch;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;
import org.junit.jupiter.api.Test;
import os.org.opensearch.client.opensearch._types.mapping.Property;

class OpenSearchDataInsightAggregatorManagerTest {

  private static final String ENTITY_TYPE = "table";

  @Test
  void nestedSubtreeIsNotAdvertisedAsChartField() {
    List<String> names = catalogFieldNames();

    assertTrue(
        names.stream().noneMatch(name -> name.startsWith("owners")),
        "owners is nested: its children can be neither grouped on nor filtered -> " + names);
  }

  @Test
  void flatTwinAndObjectChildrenStayInTheCatalog() {
    List<String> names = catalogFieldNames();

    assertTrue(names.contains("ownerName"), "Flat ownerName twin must survive: " + names);
    assertTrue(names.contains("service.name.keyword"), "object children must survive: " + names);
    assertEquals(2, names.size(), names.toString());
  }

  @Test
  void aSharedFieldNameIsReportedForEveryTypeThatHasIt() {
    List<Map<String, String>> fields = new ArrayList<>();
    OpenSearchDataInsightAggregatorManager.getFieldNames(dataAssetMapping(), "", fields, "table");
    OpenSearchDataInsightAggregatorManager.getFieldNames(dataAssetMapping(), "", fields, "topic");

    // Deduplicating on the field name alone let the first type claim every shared name, so a type
    // whose fields were all already claimed advertised nothing at all.
    assertEquals(
        Set.of("table", "topic"),
        fields.stream().map(field -> field.get("entityType")).collect(Collectors.toSet()));
    assertEquals(
        2,
        fields.stream().filter(field -> "ownerName".equals(field.get("name"))).count(),
        "a name shared by two types must be reported once for each of them");
  }

  @Test
  void aFieldIsStillReportedOnlyOncePerType() {
    List<Map<String, String>> fields = new ArrayList<>();
    OpenSearchDataInsightAggregatorManager.getFieldNames(dataAssetMapping(), "", fields, "table");
    OpenSearchDataInsightAggregatorManager.getFieldNames(dataAssetMapping(), "", fields, "table");

    assertEquals(2, fields.size(), "dedup within a single type must still hold: " + fields);
  }

  @Test
  void theCatalogDoesNotDependOnTheOrderTypesAreVisited() {
    // The production loop iterates a Set.of, whose order is salted per JVM start, so an
    // order-sensitive catalog reports a different set of entity types on every restart.
    assertEquals(catalogKeys(List.of("table", "topic")), catalogKeys(List.of("topic", "table")));
  }

  private static Set<String> catalogKeys(List<String> entityTypes) {
    List<Map<String, String>> fields = new ArrayList<>();
    entityTypes.forEach(
        entityType ->
            OpenSearchDataInsightAggregatorManager.getFieldNames(
                dataAssetMapping(), "", fields, entityType));
    return fields.stream()
        .map(field -> field.get("entityType") + ":" + field.get("name"))
        .collect(Collectors.toSet());
  }

  private static List<String> catalogFieldNames() {
    List<Map<String, String>> fields = new ArrayList<>();
    OpenSearchDataInsightAggregatorManager.getFieldNames(
        dataAssetMapping(), "", fields, ENTITY_TYPE);
    return fields.stream().map(field -> field.get("name")).toList();
  }

  /** Mirrors the DI data-asset mapping: nested `owners`, flat `ownerName`, object `service`. */
  private static Map<String, Property> dataAssetMapping() {
    Property keyword = Property.of(property -> property.keyword(builder -> builder));
    Property owners =
        Property.of(
            property ->
                property.nested(
                    nested ->
                        nested
                            .properties("id", keyword)
                            .properties("name", keyword)
                            .properties("displayName", keyword)));
    Property service =
        Property.of(
            property ->
                property.object(
                    object ->
                        object.properties(
                            "name",
                            Property.of(
                                inner -> inner.text(text -> text.fields("keyword", keyword))))));
    return Map.of("owners", owners, "ownerName", keyword, "service", service);
  }
}

package org.openmetadata.service.search.opensearch;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
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

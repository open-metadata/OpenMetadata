package org.openmetadata.service.search;

import static org.junit.jupiter.api.Assertions.*;

import jakarta.json.Json;
import jakarta.json.JsonObject;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.mockito.MockedStatic;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.data.Topic;
import org.openmetadata.schema.tests.DataQualityReport;
import org.openmetadata.schema.tests.Datum;
import org.openmetadata.schema.tests.type.DataQualityReportMetadata;
import org.openmetadata.schema.type.ChangeDescription;
import org.openmetadata.schema.type.ChangeSummaryMap;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.schema.type.change.ChangeSource;
import org.openmetadata.schema.type.change.ChangeSummary;
import org.openmetadata.service.TypeRegistry;

class SearchIndexUtilsTest {

  @Test
  void testParseHelpersAndRemoveFieldByPathSupportsNestedLists() {
    UUID followerId = UUID.randomUUID();
    UUID ownerId = UUID.randomUUID();
    List<EntityReference> refs =
        List.of(new EntityReference().withId(followerId), new EntityReference().withId(ownerId));
    List<TagLabel> tags = List.of(new TagLabel().withTagFQN("PII.Sensitive"));
    Map<String, Object> owner =
        new HashMap<>(Map.of("name", "alice", "email", "alice@example.com"));
    Map<String, Object> column1 = new HashMap<>(Map.of("name", "id", "description", "identifier"));
    Map<String, Object> column2 = new HashMap<>(Map.of("name", "amount", "description", "metric"));
    Map<String, Object> doc = new HashMap<>();
    doc.put("owner", owner);
    doc.put("columns", new ArrayList<>(List.of(column1, column2)));
    doc.put("simple", "value");

    assertEquals(
        List.of(followerId.toString(), ownerId.toString()), SearchIndexUtils.parseFollowers(refs));
    assertEquals(
        List.of(followerId.toString(), ownerId.toString()), SearchIndexUtils.parseOwners(refs));
    assertEquals(List.of(), SearchIndexUtils.parseFollowers(null));
    assertEquals(List.of(), SearchIndexUtils.parseOwners(null));
    assertSame(tags, SearchIndexUtils.parseTags(tags));
    assertEquals(List.of(), SearchIndexUtils.parseTags(null));

    SearchIndexUtils.removeNonIndexableFields(
        doc, Set.of("owner.email", "columns.description", "simple"));

    assertFalse(owner.containsKey("email"));
    assertFalse(column1.containsKey("description"));
    assertFalse(column2.containsKey("description"));
    assertFalse(doc.containsKey("simple"));
  }

  @Test
  void testBuildAggregationTreeAndParseMetricAggregationReport() {
    SearchAggregation aggregation =
        SearchIndexUtils.buildAggregationTree(
            "bucketName=team:aggType=terms:field=owner.name,"
                + "bucketName=max_ts:aggType=max:field=timestamp");
    DataQualityReportMetadata metadata = aggregation.getAggregationMetadata();
    JsonObject aggregationResults =
        Json.createObjectBuilder()
            .add(
                "sterms#team",
                Json.createObjectBuilder()
                    .add(
                        "buckets",
                        Json.createArrayBuilder()
                            .add(
                                Json.createObjectBuilder()
                                    .add("key", "analytics")
                                    .add(
                                        "max#max_ts",
                                        Json.createObjectBuilder().add("value", 42)))))
            .build();

    assertEquals(List.of("sterms#team", "max#max_ts"), metadata.getKeys());
    assertEquals(List.of("owner.name"), metadata.getDimensions());
    assertEquals(List.of("timestamp"), metadata.getMetrics());
    assertEquals("team", aggregation.getAggregationTree().getChildren().get(0).getName());
    assertEquals(
        "max_ts",
        aggregation.getAggregationTree().getChildren().get(0).getChildren().get(0).getName());

    DataQualityReport report =
        SearchIndexUtils.parseAggregationResults(Optional.of(aggregationResults), metadata);
    Datum datum = report.getData().get(0);
    assertEquals("analytics", datum.getAdditionalProperties().get("owner.name"));
    assertEquals("42", datum.getAdditionalProperties().get("timestamp"));
  }

  @Test
  void testParseAggregationResultsForLeafTermsAggregation() {
    SearchAggregation aggregation =
        SearchIndexUtils.buildAggregationTree(
            "bucketName=status_counts:aggType=terms:field=testCaseResult.testCaseStatus");
    DataQualityReportMetadata metadata = aggregation.getAggregationMetadata();
    JsonObject aggregationResults =
        Json.createObjectBuilder()
            .add(
                "sterms#status_counts",
                Json.createObjectBuilder()
                    .add(
                        "buckets",
                        Json.createArrayBuilder()
                            .add(
                                Json.createObjectBuilder()
                                    .add("key", "Success")
                                    .add("doc_count", 3))))
            .build();

    DataQualityReport report =
        SearchIndexUtils.parseAggregationResults(Optional.of(aggregationResults), metadata);
    Datum datum = report.getData().get(0);
    assertEquals("Success", datum.getAdditionalProperties().get("testCaseResult.testCaseStatus"));
    assertEquals("3", datum.getAdditionalProperties().get("document_count"));
  }

  @Test
  void testDescriptionAndTagSourceProcessing() {
    TagLabel manualTag =
        new TagLabel().withTagFQN("PII.Sensitive").withLabelType(TagLabel.LabelType.MANUAL);
    TagLabel manualTier =
        new TagLabel().withTagFQN("Tier.Tier1").withLabelType(TagLabel.LabelType.MANUAL);
    Column column =
        new Column()
            .withName("amount")
            .withDescription("column description")
            .withTags(List.of(manualTier));
    ChangeSummaryMap changeSummaryMap =
        new ChangeSummaryMap()
            .withAdditionalProperty(
                "description",
                new ChangeSummary()
                    .withChangedBy("collateaiapplicationbot")
                    .withChangeSource(ChangeSource.MANUAL))
            .withAdditionalProperty(
                "columns.amount.description",
                new ChangeSummary()
                    .withChangedBy("analyst")
                    .withChangeSource(ChangeSource.SUGGESTED));
    Table table =
        new Table()
            .withDescription("table description")
            .withTags(List.of(manualTag))
            .withColumns(List.of(column))
            .withChangeDescription(new ChangeDescription().withChangeSummary(changeSummaryMap));

    SearchIndexUtils.TagAndTierSources tagAndTierSources =
        SearchIndexUtils.processTagAndTierSources(table);
    Map<String, Integer> descriptionSources =
        SearchIndexUtils.processDescriptionSources(
            table, changeSummaryMap.getAdditionalProperties());

    assertTrue(SearchIndexUtils.hasColumns(table));
    assertFalse(SearchIndexUtils.hasColumns(new Topic()));
    assertEquals(
        ChangeSource.SUGGESTED.value(),
        SearchIndexUtils.getDescriptionSource(
            "table description", changeSummaryMap.getAdditionalProperties(), "description"));
    assertNull(
        SearchIndexUtils.getDescriptionSource(
            null, changeSummaryMap.getAdditionalProperties(), "description"));
    assertEquals(
        changeSummaryMap.getAdditionalProperties(), SearchIndexUtils.getChangeSummaryMap(table));
    assertEquals(1, tagAndTierSources.getTagSources().get(TagLabel.LabelType.MANUAL.value()));
    assertEquals(1, tagAndTierSources.getTierSources().get(TagLabel.LabelType.MANUAL.value()));
    assertEquals(2, descriptionSources.get(ChangeSource.SUGGESTED.value()));
  }

  @Test
  void testSearchAggregationBuilderHelpers() {
    SearchAggregationNode termNode = SearchAggregation.terms("team", "owner.name", 25);
    SearchAggregationNode topHitsNode = SearchAggregation.topHits("latest", 1, "timestamp", "desc");
    SearchAggregationNode filterNode =
        SearchAggregation.filter("only_failed", "{\"term\":{\"status\":\"Failed\"}}");
    SearchAggregationNode maxNode = SearchAggregation.max("max_ts", "timestamp");
    SearchAggregationNode countNode = SearchAggregation.valueCount("count", "id");
    SearchAggregationNode selectorNode =
        SearchAggregation.bucketSelector("threshold", "params.count > 1", "count", "value");
    SearchAggregationNode sortNode =
        SearchAggregation.bucketSort("sort", 10, 5, "timestamp", "desc");
    SearchAggregationNode statsNode = SearchAggregation.statsBucket("stats", "team>count");
    SearchAggregationNode root = new SearchAggregationNode("root", "root", null);
    SearchAggregationNode emptyNode = new SearchAggregationNode();
    SearchAggregation parsedWithSiblings =
        SearchIndexUtils.buildAggregationTree(
            "bucketName=team:aggType=terms:field=owner.name::"
                + "bucketName=latest:aggType=top_hits:size=1&sort_field=timestamp&sort_order=desc");

    root.addChild(termNode);
    termNode.addChild(maxNode);
    emptyNode.addChild(filterNode);
    SearchAggregation aggregation = SearchAggregation.fromTree(root);

    assertEquals("terms", termNode.getType());
    assertEquals("25", termNode.getValue().get("size"));
    assertEquals("desc", topHitsNode.getValue().get("sort_order"));
    assertEquals("{\"term\":{\"status\":\"Failed\"}}", filterNode.getValue().get("query"));
    assertEquals("timestamp", maxNode.getValue().get("field"));
    assertEquals("id", countNode.getValue().get("field"));
    assertEquals("params.count > 1", selectorNode.getValue().get("script"));
    assertEquals("10", sortNode.getValue().get("size"));
    assertEquals("team>count", statsNode.getValue().get("buckets_path"));
    assertEquals(1, emptyNode.getChildren().size());
    assertEquals(
        List.of("sterms#team", "max#max_ts"), aggregation.getAggregationMetadata().getKeys());
    assertEquals(2, parsedWithSiblings.getAggregationTree().getChildren().size());
    assertEquals(
        "top_hits", parsedWithSiblings.getAggregationTree().getChildren().get(1).getType());
    assertEquals(
        "timestamp",
        parsedWithSiblings.getAggregationTree().getChildren().get(1).getValue().get("sort_field"));
  }

  @Test
  void testBuildTypedCustomPropertiesSupportsDifferentPropertyTypes() {
    UUID ownerId = UUID.randomUUID();
    Map<String, Object> ownerRef =
        new HashMap<>(
            Map.of(
                "id", ownerId.toString(),
                "type", "user",
                "name", "alice",
                "fullyQualifiedName", "user.alice",
                "displayName", "Alice"));
    Map<String, Object> extension = new HashMap<>();
    extension.put("age", 7);
    extension.put("score", "7.5");
    extension.put("observedAt", "1700000000000");
    extension.put("interval", new HashMap<>(Map.of("start", 1L, "end", 2L)));
    extension.put("releaseDate", "2026-03-09");
    extension.put("owner", ownerRef);
    extension.put("reviewers", List.of(ownerRef));
    extension.put("status", List.of("READY", "FAILED"));
    extension.put("markdownBody", "hello");
    extension.put(
        "tableData", new HashMap<>(Map.of("rows", List.of(Map.of("c1", "foo", "c2", 2)))));
    extension.put(
        "link", new HashMap<>(Map.of("url", "https://example.com", "displayText", "Docs")));
    extension.put("genericList", List.of("alpha", 2, true));
    extension.put(
        "genericEntityMap",
        new HashMap<>(
            Map.of(
                "id", ownerId.toString(),
                "type", "user",
                "name", "alice",
                "fullyQualifiedName", "user.alice",
                "displayName", "Alice")));
    extension.put("genericIntervalMap", new HashMap<>(Map.of("start", "2024", "end", "2025")));
    extension.put(
        "genericLinkMap",
        new HashMap<>(Map.of("url", "https://docs.example.com", "displayText", "Reference")));
    extension.put(
        "genericRowsMap",
        new HashMap<>(Map.of("rows", List.of(Map.of("first", "alpha", "second", "beta")))));
    extension.put("genericFallbackMap", new HashMap<>(Map.of("code", "A1", "score", 99)));
    extension.put("badNumber", "not-a-number");
    extension.put("badTimestamp", "not-a-long");

    try (MockedStatic<TypeRegistry> typeRegistry =
        org.mockito.Mockito.mockStatic(TypeRegistry.class)) {
      typeRegistry
          .when(() -> TypeRegistry.getCustomPropertyType("table", "age"))
          .thenReturn("integer");
      typeRegistry
          .when(() -> TypeRegistry.getCustomPropertyType("table", "score"))
          .thenReturn("number");
      typeRegistry
          .when(() -> TypeRegistry.getCustomPropertyType("table", "observedAt"))
          .thenReturn("timestamp");
      typeRegistry
          .when(() -> TypeRegistry.getCustomPropertyType("table", "interval"))
          .thenReturn("timeInterval");
      typeRegistry
          .when(() -> TypeRegistry.getCustomPropertyType("table", "releaseDate"))
          .thenReturn("date-cp");
      typeRegistry
          .when(() -> TypeRegistry.getCustomPropertyType("table", "owner"))
          .thenReturn("entityReference");
      typeRegistry
          .when(() -> TypeRegistry.getCustomPropertyType("table", "reviewers"))
          .thenReturn("entityReferenceList");
      typeRegistry
          .when(() -> TypeRegistry.getCustomPropertyType("table", "status"))
          .thenReturn("enum");
      typeRegistry
          .when(() -> TypeRegistry.getCustomPropertyType("table", "markdownBody"))
          .thenReturn("markdown");
      typeRegistry
          .when(() -> TypeRegistry.getCustomPropertyType("table", "tableData"))
          .thenReturn("table-cp");
      typeRegistry
          .when(() -> TypeRegistry.getCustomPropertyType("table", "link"))
          .thenReturn("hyperlink-cp");
      typeRegistry
          .when(() -> TypeRegistry.getCustomPropertyType("table", "genericList"))
          .thenThrow(new IllegalStateException("missing"));
      typeRegistry
          .when(() -> TypeRegistry.getCustomPropertyType("table", "genericEntityMap"))
          .thenThrow(new IllegalStateException("missing"));
      typeRegistry
          .when(() -> TypeRegistry.getCustomPropertyType("table", "genericIntervalMap"))
          .thenThrow(new IllegalStateException("missing"));
      typeRegistry
          .when(() -> TypeRegistry.getCustomPropertyType("table", "genericLinkMap"))
          .thenThrow(new IllegalStateException("missing"));
      typeRegistry
          .when(() -> TypeRegistry.getCustomPropertyType("table", "genericRowsMap"))
          .thenThrow(new IllegalStateException("missing"));
      typeRegistry
          .when(() -> TypeRegistry.getCustomPropertyType("table", "genericFallbackMap"))
          .thenThrow(new IllegalStateException("missing"));
      typeRegistry
          .when(() -> TypeRegistry.getCustomPropertyType("table", "badNumber"))
          .thenReturn("integer");
      typeRegistry
          .when(() -> TypeRegistry.getCustomPropertyType("table", "badTimestamp"))
          .thenReturn("timestamp");

      List<Map<String, Object>> typedProperties =
          SearchIndexUtils.buildTypedCustomProperties(extension, "table");

      assertEquals(List.of(), SearchIndexUtils.buildTypedCustomProperties(null, "table"));
      assertEquals(7L, entryByName(typedProperties, "age").get("longValue"));
      assertEquals(7.5, entryByName(typedProperties, "score").get("doubleValue"));
      assertEquals(1700000000000L, entryByName(typedProperties, "observedAt").get("longValue"));
      assertEquals(1L, entryByName(typedProperties, "interval").get("start"));
      assertEquals("2026-03-09", entryByName(typedProperties, "releaseDate").get("stringValue"));
      assertEquals(ownerId.toString(), entryByName(typedProperties, "owner").get("refId"));
      assertEquals("Alice", entryByName(typedProperties, "owner").get("stringValue"));
      assertEquals(ownerId.toString(), entryByName(typedProperties, "reviewers").get("refId"));
      assertEquals(2, entriesByName(typedProperties, "status").size());
      assertEquals("hello", entryByName(typedProperties, "markdownBody").get("textValue"));
      assertEquals("foo", entryByName(typedProperties, "tableData.rows.c1").get("stringValue"));
      assertEquals("2", entryByName(typedProperties, "tableData.rows.c2").get("textValue"));
      assertEquals("Docs", entryByName(typedProperties, "link.displayText").get("stringValue"));
      assertEquals(
          "https://example.com", entryByName(typedProperties, "link.url").get("textValue"));
      assertEquals("unknown", entryByName(typedProperties, "genericList").get("propertyType"));
      assertEquals("alpha 2 true", entryByName(typedProperties, "genericList").get("stringValue"));
      assertEquals(
          "Alice alice user.alice",
          entryByName(typedProperties, "genericEntityMap").get("stringValue"));
      assertEquals(
          "2024 2025", entryByName(typedProperties, "genericIntervalMap").get("stringValue"));
      assertEquals(
          "Reference https://docs.example.com",
          entryByName(typedProperties, "genericLinkMap").get("stringValue"));
      assertContainsWords(
          entryByName(typedProperties, "genericRowsMap").get("stringValue").toString(),
          "alpha",
          "beta");
      assertContainsWords(
          entryByName(typedProperties, "genericFallbackMap").get("stringValue").toString(),
          "A1",
          "99");
      assertEquals("not-a-number", entryByName(typedProperties, "badNumber").get("stringValue"));
      assertEquals("not-a-long", entryByName(typedProperties, "badTimestamp").get("stringValue"));
    }
  }

  @Test
  void testTransformColumnExtensionsAtPathRecursesIntoChildren() {
    Map<String, Object> childColumn = new HashMap<>();
    childColumn.put("name", "child");
    childColumn.put("extension", new HashMap<>(Map.of("status", "READY")));

    Map<String, Object> topLevelColumn = new HashMap<>();
    topLevelColumn.put("name", "amount");
    topLevelColumn.put("extension", new HashMap<>(Map.of("age", 5)));
    topLevelColumn.put("children", new ArrayList<>(List.of(childColumn)));

    Map<String, Object> nestedColumn = new HashMap<>();
    nestedColumn.put(
        "extension",
        new HashMap<>(Map.of("link", new HashMap<>(Map.of("url", "https://example.com")))));

    Map<String, Object> nestedDataModel = new HashMap<>();
    nestedDataModel.put("columns", new ArrayList<>(List.of(nestedColumn)));

    Map<String, Object> doc = new HashMap<>();
    doc.put("columns", new ArrayList<>(List.of(topLevelColumn)));
    doc.put("dataModel", nestedDataModel);

    try (MockedStatic<TypeRegistry> typeRegistry =
        org.mockito.Mockito.mockStatic(TypeRegistry.class)) {
      typeRegistry
          .when(() -> TypeRegistry.getCustomPropertyType("tableColumn", "age"))
          .thenReturn("integer");
      typeRegistry
          .when(() -> TypeRegistry.getCustomPropertyType("tableColumn", "status"))
          .thenReturn("enum");
      typeRegistry
          .when(() -> TypeRegistry.getCustomPropertyType("nestedColumn", "link"))
          .thenReturn("hyperlink-cp");

      SearchIndexUtils.transformColumnExtensions(doc, "tableColumn");
      SearchIndexUtils.transformColumnExtensionsAtPath(doc, "dataModel.columns", "nestedColumn");
      SearchIndexUtils.transformColumnExtensionsAtPath(
          new HashMap<>(), "missing.columns", "tableColumn");

      assertTrue(topLevelColumn.containsKey("customPropertiesTyped"));
      assertTrue(childColumn.containsKey("customPropertiesTyped"));
      assertTrue(nestedColumn.containsKey("customPropertiesTyped"));
      assertEquals(1, ((List<?>) topLevelColumn.get("customPropertiesTyped")).size());
      assertEquals(
          "READY",
          entryByName(castEntries(childColumn.get("customPropertiesTyped")), "status")
              .get("stringValue"));
      assertEquals(
          "https://example.com",
          entryByName(castEntries(nestedColumn.get("customPropertiesTyped")), "link.url")
              .get("textValue"));
    }
  }

  @SuppressWarnings("unchecked")
  private static List<Map<String, Object>> castEntries(Object entries) {
    return (List<Map<String, Object>>) entries;
  }

  private static Map<String, Object> entryByName(List<Map<String, Object>> entries, String name) {
    return entries.stream()
        .filter(entry -> name.equals(entry.get("name")))
        .findFirst()
        .orElseThrow();
  }

  private static List<Map<String, Object>> entriesByName(
      List<Map<String, Object>> entries, String name) {
    return entries.stream().filter(entry -> name.equals(entry.get("name"))).toList();
  }

  private static void assertContainsWords(String value, String... expectedWords) {
    Set<String> actualWords = Set.of(value.split(" "));
    assertEquals(Set.of(expectedWords), actualWords);
  }
}

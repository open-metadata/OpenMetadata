package org.openmetadata.service.search;

import static org.openmetadata.service.search.SearchUtils.getAggregationBuckets;
import static org.openmetadata.service.search.SearchUtils.getAggregationObject;

import jakarta.json.JsonArray;
import jakarta.json.JsonNumber;
import jakarta.json.JsonObject;
import jakarta.json.JsonString;
import jakarta.json.JsonValue;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;
import lombok.Getter;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.ColumnsEntityInterface;
import org.openmetadata.schema.EntityInterface;
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
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.TypeRegistry;
import org.openmetadata.service.util.Utilities;

@Slf4j
public final class SearchIndexUtils {

  // Keeping the bots list static so we can call this from anywhere in the codebase
  public static final List<String> AI_BOTS =
      List.of("collateaiapplicationbot", "collateaiqualityagentapplicationbot");

  private SearchIndexUtils() {}

  public static List<String> parseFollowers(List<EntityReference> followersRef) {
    if (followersRef == null) {
      return Collections.emptyList();
    }
    return followersRef.stream().map(item -> item.getId().toString()).toList();
  }

  public static List<String> parseOwners(List<EntityReference> ownersRef) {
    if (ownersRef == null) {
      return Collections.emptyList();
    }
    return ownersRef.stream().map(item -> item.getId().toString()).toList();
  }

  public static void removeNonIndexableFields(Map<String, Object> doc, Set<String> fields) {
    for (String key : fields) {
      if (key.contains(".")) {
        removeFieldByPath(doc, key);
      } else {
        doc.remove(key);
      }
    }
  }

  public static void removeFieldByPath(Map<String, Object> jsonMap, String path) {
    String[] pathElements = path.split("\\.");
    Map<String, Object> currentMap = jsonMap;

    String key = pathElements[0];
    Object value = currentMap.get(key);
    if (value instanceof Map) {
      currentMap = (Map<String, Object>) value;
    } else if (value instanceof List) {
      List<?> list = (List<Map<String, Object>>) value;
      for (Object obj : list) {
        Map<String, Object> item = JsonUtils.getMap(obj);
        removeFieldByPath(
            item,
            Arrays.stream(pathElements, 1, pathElements.length).collect(Collectors.joining(".")));
      }
      return;
    } else {
      return;
    }

    // Remove the field at the last path element
    String lastKey = pathElements[pathElements.length - 1];
    currentMap.remove(lastKey);
  }

  private static void handleLeafTermsAggregation(
      JsonObject aggregationResults, List<Datum> reportData, Map<String, String> nodeData) {
    Optional<String> docCount = Optional.ofNullable(aggregationResults.get("doc_count").toString());
    docCount.ifPresentOrElse(
        s -> nodeData.put("document_count", s), () -> nodeData.put("document_count", null));

    Datum datum = new Datum();
    for (Map.Entry<String, String> entry : nodeData.entrySet()) {
      datum.withAdditionalProperty(entry.getKey(), entry.getValue());
    }

    reportData.add(datum);
  }

  private static void handleLeafMetricsAggregation(
      JsonObject aggregationResults,
      List<Datum> reportData,
      Map<String, String> nodeData,
      String metric) {
    String valueStr = null;
    if (aggregationResults.containsKey("value")) {
      JsonNumber value = aggregationResults.getJsonNumber("value");
      if (value != null) valueStr = value.toString();
    } else {
      valueStr = aggregationResults.getString("value_as_string", null);
    }

    nodeData.put(metric, valueStr);
    Datum datum = new Datum();
    for (Map.Entry<String, String> entry : nodeData.entrySet()) {
      datum.withAdditionalProperty(entry.getKey(), entry.getValue());
    }

    reportData.add(datum);
  }

  /*
   * Traverse the aggregation results and build the report data. Note that the method supports
   * n levels of nested aggregations, but does not support sibling aggregations.
   *
   * @Param aggregationResults the aggregation results
   * @Param reportData the report data
   * @Param nodeData the node data
   * @Param keys the keys to traverse the aggregation tree
   * @Param metric the metric to add to the report data
   * @Param dimensions the dimensions to add to the report data
   * @return the report data
   */
  private static void traverseAggregationResults(
      JsonObject aggregationResults,
      List<Datum> reportData,
      Map<String, String> nodeData,
      List<String> keys,
      String metric,
      List<String> dimensions) {

    if (keys.isEmpty()) {
      // We are in the leaf of the term aggregation. We'll add the count of documents as the metric
      handleLeafTermsAggregation(aggregationResults, reportData, nodeData);
      return;
    }

    // The current key represent the node in the aggregation tree (i.e. the current bucket)
    String currentKey = keys.get(0);
    Optional<JsonObject> aggregation =
        Optional.ofNullable(getAggregationObject(aggregationResults, currentKey));

    aggregation.ifPresent(
        agg -> {
          Optional<JsonArray> buckets = Optional.ofNullable(getAggregationBuckets(agg));
          if (buckets.isEmpty()) {
            if ((keys.size() > 1) && (agg.containsKey(keys.get(1)))) {
              // If the current node in the aggregation tree does not have further buckets
              // but contains the next level of aggregation, it means we are in the nested
              // aggregation. Nested aggregations are structural and don't produce bucket
              // keys, so we pass dimensions through unchanged.
              traverseAggregationResults(
                  agg, reportData, nodeData, keys.subList(1, keys.size()), metric, dimensions);
            } else {
              // If the current node in the aggregation tree does not have further bucket
              // it means we are in the leaf of the metric aggregation. We'll add the metric
              handleLeafMetricsAggregation(agg, reportData, nodeData, metric);
            }
          } else {
            buckets
                .get()
                .forEach(
                    bucket -> {
                      JsonObject bucketObject = (JsonObject) bucket;
                      Optional<JsonValue> val = Optional.of(bucketObject.get("key"));

                      val.ifPresentOrElse(
                          s -> {
                            switch (s.getValueType()) {
                              case NUMBER -> nodeData.put(
                                  dimensions.get(0), String.valueOf((JsonNumber) s));
                              default -> nodeData.put(
                                  dimensions.get(0), ((JsonString) s).getString());
                            }
                          },
                          () -> nodeData.put(dimensions.get(0), null));

                      // Traverse the next level of the aggregation tree.
                      // Dimensions and keys represent the same level in the tree.
                      // They are used for different purpose (i.e. dimensions are used to
                      // generate the report while the keys are used to traverse the aggregation
                      // tree)
                      traverseAggregationResults(
                          bucketObject,
                          reportData,
                          nodeData,
                          keys.subList(1, keys.size()),
                          metric,
                          dimensions.subList(1, dimensions.size()));
                    });
          }
        });
  }

  public static DataQualityReport parseAggregationResults(
      Optional<JsonObject> aggregationResults, DataQualityReportMetadata metadata) {
    List<Datum> reportData = new ArrayList<>();

    aggregationResults.ifPresent(
        jsonObject ->
            traverseAggregationResults(
                jsonObject,
                reportData,
                new HashMap<>(),
                metadata.getKeys(),
                metadata.getMetrics().get(0),
                metadata.getDimensions()));

    DataQualityReport report = new DataQualityReport();
    return report.withMetadata(metadata).withData(reportData);
  }

  public static List<TagLabel> parseTags(List<TagLabel> tags) {
    if (tags == null) {
      return Collections.emptyList();
    }
    return tags;
  }

  public static SearchAggregation buildAggregationTree(String aggregationString) {
    List<List<Map<String, String>>> aggregationsMetadata = new ArrayList<>();
    SearchAggregationNode root = new SearchAggregationNode("root", "root", null);
    String[] siblings = aggregationString.split(";");
    for (String sibling : siblings) {
      List<Map<String, String>> siblingAggregationsMetadata = new ArrayList<>();
      SearchAggregationNode currentNode = root;
      String[] nestedAggregations = sibling.split(Utilities.doubleQuoteRegexEscape(","), -1);
      for (String aggregation : nestedAggregations) {
        SearchAggregationNode bucketNode = new SearchAggregationNode();
        String[] nestedAggregationSiblings = aggregation.split("::");
        for (int j = 0; j < nestedAggregationSiblings.length; j++) {
          Map<String, String> nestedAggregationMetadata = new HashMap<>();

          String nestedAggregationSibling = nestedAggregationSiblings[j];
          String[] parts =
              nestedAggregationSibling.split(Utilities.doubleQuoteRegexEscape(":(?!:)"));
          for (String part : parts) {
            if (part.contains("&")) {
              String[] subParts = part.split("&");
              Map<String, String> params = new HashMap<>();
              for (String subPart : subParts) {
                String[] kvPairs = subPart.split(Utilities.doubleQuoteRegexEscape("="), -1);
                params.put(kvPairs[0], Utilities.cleanUpDoubleQuotes(kvPairs[1]));
                nestedAggregationMetadata.put(
                    kvPairs[0], Utilities.cleanUpDoubleQuotes(kvPairs[1]));
              }
              bucketNode.setValue(params);
            } else {
              String[] kvPairs = part.split(Utilities.doubleQuoteRegexEscape("="), -1);
              switch (kvPairs[0]) {
                case "aggType":
                  bucketNode.setType(Utilities.cleanUpDoubleQuotes(kvPairs[1]));
                  nestedAggregationMetadata.put(
                      kvPairs[0], Utilities.cleanUpDoubleQuotes(kvPairs[1]));
                  break;
                case "bucketName":
                  bucketNode.setName(Utilities.cleanUpDoubleQuotes(kvPairs[1]));
                  nestedAggregationMetadata.put(
                      kvPairs[0], Utilities.cleanUpDoubleQuotes(kvPairs[1]));
                  break;
                default:
                  nestedAggregationMetadata.put(
                      kvPairs[0], Utilities.cleanUpDoubleQuotes(kvPairs[1]));
                  bucketNode.setValue(
                      Map.of(kvPairs[0], Utilities.cleanUpDoubleQuotes(kvPairs[1])));
              }
            }
          }
          currentNode.addChild(bucketNode);
          if (j < nestedAggregationSiblings.length - 1) {
            bucketNode = new SearchAggregationNode();
          }
          siblingAggregationsMetadata.add(nestedAggregationMetadata);
        }
        currentNode = bucketNode;
      }
      aggregationsMetadata.add(siblingAggregationsMetadata);
    }
    return new SearchAggregation(root, aggregationsMetadata);
  }

  public static String getDescriptionSource(
      String description, Map<String, ChangeSummary> changeSummaryMap, String changeSummaryKey) {
    if (description == null) {
      return null;
    }

    String descriptionSource = ChangeSource.INGESTED.value();

    if (changeSummaryMap != null) {
      if (changeSummaryMap.containsKey(changeSummaryKey)
          && changeSummaryMap.get(changeSummaryKey).getChangeSource() != null) {
        if (AI_BOTS.contains(changeSummaryMap.get(changeSummaryKey).getChangedBy())) {
          // If bot is directly PATCHing and not suggesting, we need to still consider it's a
          // suggested change
          descriptionSource = ChangeSource.SUGGESTED.value();
        } else {
          // Otherwise, use the change summary source
          descriptionSource = changeSummaryMap.get(changeSummaryKey).getChangeSource().value();
        }
      }
    }
    return descriptionSource;
  }

  private static void processTagAndTierSources(
      List<TagLabel> tagList, TagAndTierSources tagAndTierSources) {
    Optional.ofNullable(tagList)
        .ifPresent(
            tags ->
                tags.forEach(
                    tag -> {
                      String tagSource = tag.getLabelType().value();
                      if (tag.getTagFQN().startsWith("Tier.")) {
                        tagAndTierSources
                            .getTierSources()
                            .put(
                                tagSource,
                                tagAndTierSources.getTierSources().getOrDefault(tagSource, 0) + 1);
                      } else {
                        tagAndTierSources
                            .getTagSources()
                            .put(
                                tagSource,
                                tagAndTierSources.getTagSources().getOrDefault(tagSource, 0) + 1);
                      }
                    }));
  }

  private static void processEntityTagSources(
      EntityInterface entity, TagAndTierSources tagAndTierSources) {
    processTagAndTierSources(entity.getTags(), tagAndTierSources);
  }

  private static void processColumnTagSources(
      ColumnsEntityInterface entity, TagAndTierSources tagAndTierSources) {
    for (Column column : entity.getColumns()) {
      processTagAndTierSources(column.getTags(), tagAndTierSources);
    }
  }

  public static TagAndTierSources processTagAndTierSources(EntityInterface entity) {
    TagAndTierSources tagAndTierSources = new TagAndTierSources();
    processEntityTagSources(entity, tagAndTierSources);
    if (SearchIndexUtils.hasColumns(entity)) {
      processColumnTagSources((ColumnsEntityInterface) entity, tagAndTierSources);
    }
    return tagAndTierSources;
  }

  public static void processDescriptionSource(
      EntityInterface entity,
      Map<String, ChangeSummary> changeSummaryMap,
      Map<String, Integer> descriptionSources) {
    Optional.ofNullable(
            getDescriptionSource(entity.getDescription(), changeSummaryMap, "description"))
        .ifPresent(
            source ->
                descriptionSources.put(source, descriptionSources.getOrDefault(source, 0) + 1));
  }

  public static void processColumnDescriptionSources(
      ColumnsEntityInterface entity,
      Map<String, ChangeSummary> changeSummaryMap,
      Map<String, Integer> descriptionSources) {
    for (Column column : entity.getColumns()) {
      Optional.ofNullable(
              getDescriptionSource(
                  column.getDescription(),
                  changeSummaryMap,
                  String.format("columns.%s.description", column.getName())))
          .ifPresent(
              source ->
                  descriptionSources.put(source, descriptionSources.getOrDefault(source, 0) + 1));
    }
  }

  public static boolean hasColumns(EntityInterface entity) {
    return List.of(entity.getClass().getInterfaces()).contains(ColumnsEntityInterface.class);
  }

  public static Map<String, Integer> processDescriptionSources(
      EntityInterface entity, Map<String, ChangeSummary> changeSummaryMap) {
    Map<String, Integer> descriptionSources = new HashMap<>();
    processDescriptionSource(entity, changeSummaryMap, descriptionSources);
    if (hasColumns(entity)) {
      processColumnDescriptionSources(
          (ColumnsEntityInterface) entity, changeSummaryMap, descriptionSources);
    }
    return descriptionSources;
  }

  public static Map<String, ChangeSummary> getChangeSummaryMap(EntityInterface entity) {
    return Optional.ofNullable(entity.getChangeDescription())
        .map(ChangeDescription::getChangeSummary)
        .map(ChangeSummaryMap::getAdditionalProperties)
        .orElse(null);
  }

  @Getter
  public static class TagAndTierSources {
    private final Map<String, Integer> tagSources;
    private final Map<String, Integer> tierSources;

    public TagAndTierSources() {
      this.tagSources = new HashMap<>();
      this.tierSources = new HashMap<>();
    }
  }

  /**
   * Flattens a custom property value into a searchable string.
   * Handles various types: String, Number, Boolean, List, Map (entityReference, timeInterval, etc.)
   */
  private static String flattenValue(Object value) {
    if (value == null) {
      return "";
    }
    if (value instanceof String) {
      return (String) value;
    }
    if (value instanceof Number || value instanceof Boolean) {
      return value.toString();
    }
    if (value instanceof List) {
      List<?> list = (List<?>) value;
      return list.stream().map(SearchIndexUtils::flattenValue).collect(Collectors.joining(" "));
    }
    if (value instanceof Map) {
      Map<?, ?> map = (Map<?, ?>) value;
      return flattenMapValue(map);
    }
    return value.toString();
  }

  /**
   * Extracts searchable text from Map-based custom property values.
   * Handles entityReference, timeInterval, hyperlink, table-cp, and other complex types.
   */
  private static String flattenMapValue(Map<?, ?> map) {
    List<String> parts = new ArrayList<>();

    // EntityReference: extract displayName, name, or fullyQualifiedName
    if (map.containsKey("type") && map.containsKey("id")) {
      // This looks like an entityReference
      extractIfPresent(map, "displayName", parts);
      extractIfPresent(map, "name", parts);
      extractIfPresent(map, "fullyQualifiedName", parts);
      if (!parts.isEmpty()) {
        return String.join(" ", parts);
      }
    }

    // TimeInterval: extract start and end
    if (map.containsKey("start") || map.containsKey("end")) {
      extractIfPresent(map, "start", parts);
      extractIfPresent(map, "end", parts);
      if (!parts.isEmpty()) {
        return String.join(" ", parts);
      }
    }

    // Hyperlink: extract url and displayText
    if (map.containsKey("url")) {
      extractIfPresent(map, "displayText", parts);
      extractIfPresent(map, "url", parts);
      if (!parts.isEmpty()) {
        return String.join(" ", parts);
      }
    }

    // Table-cp (rows): flatten nested row data
    if (map.containsKey("rows")) {
      Object rows = map.get("rows");
      if (rows instanceof List) {
        return flattenValue(rows);
      }
    }

    // Generic fallback: extract all string/number values from the map
    for (Map.Entry<?, ?> entry : map.entrySet()) {
      Object v = entry.getValue();
      if (v instanceof String || v instanceof Number) {
        parts.add(v.toString());
      }
    }

    if (!parts.isEmpty()) {
      return String.join(" ", parts);
    }

    // Last resort: JSON representation
    return JsonUtils.pojoToJson(map);
  }

  private static void extractIfPresent(Map<?, ?> map, String key, List<String> parts) {
    Object value = map.get(key);
    if (value != null) {
      String str = value.toString();
      if (!str.isEmpty()) {
        parts.add(str);
      }
    }
  }

  /**
   * Builds typed custom properties for ES nested array indexing.
   * This enables range queries, exact matches, and structured queries on custom properties
   * while keeping the field count bounded.
   *
   * @param extension The extension object containing custom properties
   * @param entityType The entity type (e.g., "table", "dashboard") to look up property types
   * @return List of typed custom property maps for ES nested indexing
   */
  public static List<Map<String, Object>> buildTypedCustomProperties(
      Object extension, String entityType) {
    if (extension == null) {
      return Collections.emptyList();
    }

    List<Map<String, Object>> typedProperties = new ArrayList<>();

    try {
      Map<String, Object> extensionMap = JsonUtils.getMap(extension);
      if (extensionMap == null || extensionMap.isEmpty()) {
        return Collections.emptyList();
      }

      for (Map.Entry<String, Object> entry : extensionMap.entrySet()) {
        String propertyName = entry.getKey();
        Object value = entry.getValue();

        if (value == null) {
          continue;
        }

        String propertyType = getPropertyTypeSafe(entityType, propertyName);
        List<Map<String, Object>> propertyEntries =
            buildTypedPropertyEntries(propertyName, propertyType, value);
        typedProperties.addAll(propertyEntries);
      }
    } catch (Exception e) {
      LOG.warn("Failed to build typed custom properties for entity type {}", entityType, e);
      return Collections.emptyList();
    }

    return typedProperties;
  }

  private static String getPropertyTypeSafe(String entityType, String propertyName) {
    try {
      return TypeRegistry.getCustomPropertyType(entityType, propertyName);
    } catch (Exception e) {
      LOG.debug(
          "Could not find property type for {}.{}, using 'unknown'", entityType, propertyName);
      return "unknown";
    }
  }

  private static List<Map<String, Object>> buildTypedPropertyEntries(
      String propertyName, String propertyType, Object value) {
    List<Map<String, Object>> entries = new ArrayList<>();

    switch (propertyType) {
      case "integer", "number" -> entries.add(buildNumericEntry(propertyName, propertyType, value));
      case "timestamp" -> entries.add(buildTimestampEntry(propertyName, propertyType, value));
      case "timeInterval" -> entries.add(buildTimeIntervalEntry(propertyName, propertyType, value));
      case "date-cp", "dateTime-cp", "time-cp" -> entries.add(
          buildDateStringEntry(propertyName, propertyType, value));
      case "entityReference" -> entries.add(
          buildEntityReferenceEntry(propertyName, propertyType, value));
      case "entityReferenceList" -> entries.addAll(
          buildEntityReferenceListEntries(propertyName, propertyType, value));
      case "enum" -> entries.addAll(buildEnumEntries(propertyName, propertyType, value));
      case "markdown", "sqlQuery" -> entries.add(buildTextEntry(propertyName, propertyType, value));
      case "table-cp" -> entries.addAll(buildTableEntries(propertyName, propertyType, value));
      case "hyperlink-cp" -> entries.addAll(
          buildHyperlinkEntries(propertyName, propertyType, value));
      default -> entries.add(buildStringEntry(propertyName, propertyType, value));
    }

    return entries;
  }

  private static Map<String, Object> buildNumericEntry(
      String name, String propertyType, Object value) {
    Map<String, Object> entry = createBaseEntry(name, propertyType);
    if (value instanceof Number num) {
      if (value instanceof Double || value instanceof Float) {
        entry.put("doubleValue", num.doubleValue());
      } else {
        entry.put("longValue", num.longValue());
      }
    } else if (value instanceof String str) {
      try {
        if (str.contains(".")) {
          entry.put("doubleValue", Double.parseDouble(str));
        } else {
          entry.put("longValue", Long.parseLong(str));
        }
      } catch (NumberFormatException e) {
        entry.put("stringValue", str);
      }
    }
    return entry;
  }

  private static Map<String, Object> buildTimestampEntry(
      String name, String propertyType, Object value) {
    Map<String, Object> entry = createBaseEntry(name, propertyType);
    if (value instanceof Number num) {
      entry.put("longValue", num.longValue());
    } else if (value instanceof String str) {
      try {
        entry.put("longValue", Long.parseLong(str));
      } catch (NumberFormatException e) {
        entry.put("stringValue", str);
      }
    }
    return entry;
  }

  private static Map<String, Object> buildTimeIntervalEntry(
      String name, String propertyType, Object value) {
    Map<String, Object> entry = createBaseEntry(name, propertyType);
    if (value instanceof Map<?, ?> map) {
      Object start = map.get("start");
      Object end = map.get("end");
      if (start instanceof Number num) {
        entry.put("start", num.longValue());
      }
      if (end instanceof Number num) {
        entry.put("end", num.longValue());
      }
    }
    return entry;
  }

  private static Map<String, Object> buildDateStringEntry(
      String name, String propertyType, Object value) {
    Map<String, Object> entry = createBaseEntry(name, propertyType);
    entry.put("stringValue", value.toString());
    return entry;
  }

  private static Map<String, Object> buildEntityReferenceEntry(
      String name, String propertyType, Object value) {
    Map<String, Object> entry = createBaseEntry(name, propertyType);
    if (value instanceof Map<?, ?> map) {
      populateEntityRefFields(entry, map);
    }
    return entry;
  }

  private static List<Map<String, Object>> buildEntityReferenceListEntries(
      String name, String propertyType, Object value) {
    List<Map<String, Object>> entries = new ArrayList<>();
    if (value instanceof List<?> list) {
      for (Object item : list) {
        if (item instanceof Map<?, ?> map) {
          Map<String, Object> entry = createBaseEntry(name, propertyType);
          populateEntityRefFields(entry, map);
          entries.add(entry);
        }
      }
    }
    if (entries.isEmpty()) {
      entries.add(createBaseEntry(name, propertyType));
    }
    return entries;
  }

  private static void populateEntityRefFields(Map<String, Object> entry, Map<?, ?> map) {
    if (map.get("id") != null) {
      entry.put("refId", map.get("id").toString());
    }
    if (map.get("type") != null) {
      entry.put("refType", map.get("type").toString());
    }
    if (map.get("name") != null) {
      entry.put("refName", map.get("name").toString());
    }
    if (map.get("fullyQualifiedName") != null) {
      entry.put("refFqn", map.get("fullyQualifiedName").toString());
    }
    if (map.get("displayName") != null) {
      entry.put("stringValue", map.get("displayName").toString());
    }
  }

  private static List<Map<String, Object>> buildEnumEntries(
      String name, String propertyType, Object value) {
    List<Map<String, Object>> entries = new ArrayList<>();
    if (value instanceof List<?> list) {
      for (Object item : list) {
        Map<String, Object> entry = createBaseEntry(name, propertyType);
        entry.put("stringValue", item.toString());
        entries.add(entry);
      }
    } else if (value instanceof String str) {
      Map<String, Object> entry = createBaseEntry(name, propertyType);
      entry.put("stringValue", str);
      entries.add(entry);
    }
    if (entries.isEmpty()) {
      entries.add(createBaseEntry(name, propertyType));
    }
    return entries;
  }

  private static Map<String, Object> buildTextEntry(
      String name, String propertyType, Object value) {
    Map<String, Object> entry = createBaseEntry(name, propertyType);
    entry.put("textValue", value.toString());
    entry.put("stringValue", value.toString());
    return entry;
  }

  private static List<Map<String, Object>> buildTableEntries(
      String name, String propertyType, Object value) {
    List<Map<String, Object>> entries = new ArrayList<>();
    if (value instanceof Map<?, ?> map && map.containsKey("rows")) {
      Object rowsObj = map.get("rows");
      if (rowsObj instanceof List<?> rows) {
        for (Object rowObj : rows) {
          if (rowObj instanceof Map<?, ?> row) {
            for (Map.Entry<?, ?> cell : row.entrySet()) {
              String columnName = cell.getKey().toString();
              String cellValue = cell.getValue() != null ? cell.getValue().toString() : "";
              Map<String, Object> entry =
                  createBaseEntry(name + ".rows." + columnName, propertyType);
              entry.put("stringValue", cellValue);
              entry.put("textValue", cellValue);
              entries.add(entry);
            }
          }
        }
      }
    }
    return entries;
  }

  private static List<Map<String, Object>> buildHyperlinkEntries(
      String name, String propertyType, Object value) {
    List<Map<String, Object>> entries = new ArrayList<>();
    if (value instanceof Map<?, ?> map) {
      // Create separate entries for URL and displayText with distinct names
      // This allows wildcard search on each field independently
      if (map.get("url") != null) {
        Map<String, Object> urlEntry = createBaseEntry(name + ".url", propertyType);
        String urlValue = map.get("url").toString();
        urlEntry.put("stringValue", urlValue);
        urlEntry.put("textValue", urlValue);
        entries.add(urlEntry);
      }
      if (map.get("displayText") != null) {
        Map<String, Object> displayTextEntry = createBaseEntry(name + ".displayText", propertyType);
        String displayTextValue = map.get("displayText").toString();
        displayTextEntry.put("stringValue", displayTextValue);
        displayTextEntry.put("textValue", displayTextValue);
        entries.add(displayTextEntry);
      }
    }
    return entries;
  }

  private static Map<String, Object> buildStringEntry(
      String name, String propertyType, Object value) {
    Map<String, Object> entry = createBaseEntry(name, propertyType);
    String strValue = flattenValue(value);
    entry.put("stringValue", strValue);
    entry.put("textValue", strValue);
    return entry;
  }

  private static Map<String, Object> createBaseEntry(String name, String propertyType) {
    Map<String, Object> entry = new HashMap<>();
    entry.put("name", name);
    entry.put("propertyType", propertyType);
    return entry;
  }

  /**
   * Transforms column extensions to typed custom properties within the search document.
   * This modifies the columns in-place to add customPropertiesTyped for each column
   * that has an extension, keeping the field count bounded.
   *
   * @param doc The search document containing columns
   * @param columnEntityType The entity type for column custom properties (e.g., "tableColumn")
   */
  @SuppressWarnings("unchecked")
  public static void transformColumnExtensions(Map<String, Object> doc, String columnEntityType) {
    transformColumnExtensionsAtPath(doc, "columns", columnEntityType);
  }

  /**
   * Transforms column extensions to typed custom properties at a nested path.
   * This is useful for entities like Container where columns are at "dataModel.columns".
   *
   * @param doc The search document
   * @param path The path to the columns (e.g., "columns" or "dataModel.columns")
   * @param columnEntityType The entity type for column custom properties
   */
  @SuppressWarnings("unchecked")
  public static void transformColumnExtensionsAtPath(
      Map<String, Object> doc, String path, String columnEntityType) {
    String[] pathParts = path.split("\\.");
    Object current = doc;

    // Navigate to the parent of the columns
    for (int i = 0; i < pathParts.length - 1; i++) {
      if (current instanceof Map) {
        current = ((Map<String, Object>) current).get(pathParts[i]);
      } else {
        return;
      }
    }

    if (current instanceof Map) {
      Object columnsObj = ((Map<String, Object>) current).get(pathParts[pathParts.length - 1]);
      if (columnsObj instanceof List) {
        List<Map<String, Object>> columns = (List<Map<String, Object>>) columnsObj;
        transformColumnExtensionsRecursive(columns, columnEntityType);
      }
    }
  }

  @SuppressWarnings("unchecked")
  private static void transformColumnExtensionsRecursive(
      List<Map<String, Object>> columns, String columnEntityType) {
    if (columns == null || columns.isEmpty()) {
      return;
    }

    for (Map<String, Object> column : columns) {
      // Transform extension to customPropertiesTyped
      Object extensionObj = column.get("extension");
      if (extensionObj != null) {
        List<Map<String, Object>> typedProps =
            buildTypedCustomProperties(extensionObj, columnEntityType);
        if (!typedProps.isEmpty()) {
          column.put("customPropertiesTyped", typedProps);
        }
      }

      // Process nested children recursively
      Object childrenObj = column.get("children");
      if (childrenObj instanceof List) {
        List<Map<String, Object>> children = (List<Map<String, Object>>) childrenObj;
        transformColumnExtensionsRecursive(children, columnEntityType);
      }
    }
  }
}

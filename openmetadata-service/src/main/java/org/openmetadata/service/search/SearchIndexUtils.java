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
import org.openmetadata.service.util.Utilities;

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
              // aggregation
              traverseAggregationResults(
                  agg,
                  reportData,
                  nodeData,
                  keys.subList(1, keys.size()),
                  metric,
                  dimensions.subList(1, dimensions.size()));
            }
            // If the current node in the aggregation tree does not have further bucket
            // it means we are in the leaf of the metric aggregation. We'll add the metric
            handleLeafMetricsAggregation(agg, reportData, nodeData, metric);
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
   * Flattens custom properties (extension field) into searchable formats.
   * Creates name:value pairs for exact matching and concatenated text for fuzzy search.
   *
   * @param extension The extension object containing custom properties
   * @return FlattenedCustomProperties containing keyword pairs and fuzzy text
   */
  public static FlattenedCustomProperties flattenCustomProperties(Object extension) {
    List<String> keyValuePairs = new ArrayList<>();
    StringBuilder fuzzyText = new StringBuilder();

    if (extension != null) {
      Map<String, Object> extensionMap = JsonUtils.getMap(extension);
      for (Map.Entry<String, Object> entry : extensionMap.entrySet()) {
        String key = entry.getKey();
        Object value = entry.getValue();
        String valueStr = value != null ? flattenValue(value) : "";

        String pair = key + ":" + valueStr;
        keyValuePairs.add(pair);

        if (fuzzyText.length() > 0) {
          fuzzyText.append(" ");
        }
        fuzzyText.append(key).append(" ").append(valueStr);
      }
    }

    return new FlattenedCustomProperties(keyValuePairs, fuzzyText.toString().trim());
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

  @Getter
  public static class FlattenedCustomProperties {
    private final List<String> keyValuePairs;
    private final String fuzzyText;

    public FlattenedCustomProperties(List<String> keyValuePairs, String fuzzyText) {
      this.keyValuePairs = keyValuePairs;
      this.fuzzyText = fuzzyText;
    }
  }
}

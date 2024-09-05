package org.openmetadata.service.search;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.HashMap;
import java.util.Iterator;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;
import javax.json.JsonArray;
import javax.json.JsonNumber;
import javax.json.JsonObject;
import javax.json.JsonString;
import javax.json.JsonValue;
import org.openmetadata.schema.tests.DataQualityReport;
import org.openmetadata.schema.tests.Datum;
import org.openmetadata.schema.tests.type.DataQualityReportMetadata;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.TagLabel;

public final class SearchIndexUtils {

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
      List<Map<String, Object>> list = (List<Map<String, Object>>) value;
      for (Map<String, Object> item : list) {
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
    Optional<String> val = Optional.ofNullable(aggregationResults.getString("value_as_string"));
    val.ifPresentOrElse(s -> nodeData.put(metric, s), () -> nodeData.put(metric, null));

    Datum datum = new Datum();
    for (Map.Entry<String, String> entry : nodeData.entrySet()) {
      datum.withAdditionalProperty(entry.getKey(), entry.getValue());
    }

    reportData.add(datum);
  }

  /*
   * Get the metadata for the aggregation results. We'll use the metadata to build the report and
   * to traverse the aggregation tree. 3 types of metadata are returned:
   *   1. dimensions: the list of dimensions
   *   2. metrics: the list of metrics
   *   3. keys: the list of keys to traverse the aggregation tree
   *
   * @param aggregationMapList the list of aggregations
   * @return the metadata
   */
  private static DataQualityReportMetadata getAggregationMetadata(
      List<List<Map<String, String>>> aggregationMapList) {
    DataQualityReportMetadata metadata = new DataQualityReportMetadata();
    List<String> dimensions = new ArrayList<>();
    List<String> metrics = new ArrayList<>();
    List<String> keys = new ArrayList<>();

    for (List<Map<String, String>> aggregationsMap : aggregationMapList) {
      for (int j = 0; j < aggregationsMap.size(); j++) {
        Map<String, String> aggregationMap = aggregationsMap.get(j);
        String aggType = aggregationMap.get("aggType");
        String field = aggregationMap.get("field");

        boolean isLeaf = j == aggregationsMap.size() - 1;
        if (isLeaf) {
          // leaf aggregation
          if (!aggType.contains("term")) {
            metrics.add(field);
          } else {
            dimensions.add(field);
            metrics.add("document_count");
          }
        } else {
          dimensions.add(field);
        }
        String formattedAggType = aggType.contains("term") ? "s%s".formatted(aggType) : aggType;
        keys.add("%s#%s".formatted(formattedAggType, aggregationMap.get("bucketName")));
      }
    }

    metadata.withKeys(keys).withDimensions(dimensions).withMetrics(metrics);

    return metadata;
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

    String currentKey =
        keys.get(0); // The current key represent the node in the aggregation tree (i.e. the current
    // bucket)
    Optional<JsonObject> aggregation =
        Optional.ofNullable(SearchClient.getAggregationObject(aggregationResults, currentKey));

    aggregation.ifPresent(
        agg -> {
          Optional<JsonArray> buckets =
              Optional.ofNullable(SearchClient.getAggregationBuckets(agg));
          if (buckets.isEmpty()) {
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
      Optional<JsonObject> aggregationResults, List<List<Map<String, String>>> aggregationMapList) {
    DataQualityReportMetadata metadata = getAggregationMetadata(aggregationMapList);
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

  /*
   * Build the aggregation string for the given aggregation
   *
   * @param aggregation the aggregation to build the string for.
   *   The aggregation string is in the form
   * `bucketName:aggType:key=value,bucketName:aggType:key=value;bucketName:aggType:key=value`
   * where `,` represents a nested aggregation and `;` represents a sibling aggregation
   * NOTE: As of 07/25/2024 sibling aggregation parsing and processing has not been added
   * @return the aggregation string
   */
  public static Map<String, Object> buildAggregationString(String aggregation) {
    Map<String, Object> metadata = new HashMap<>();

    StringBuilder aggregationString = new StringBuilder();
    String[] siblings = aggregation.split(";");
    List<List<Map<String, String>>> aggregationsMapList = new ArrayList<>();

    for (String sibling : siblings) {
      List<Map<String, String>> aggregationsMap = new ArrayList<>();
      String[] nested = sibling.split(",");
      for (int i = 0; i < nested.length; i++) {
        Map<String, String> aggregationMap = new HashMap<>();
        String[] parts = nested[i].split(":");

        Iterator<String> partsIterator = Arrays.stream(parts).iterator();

        while (partsIterator.hasNext()) {
          String part = partsIterator.next();
          if (!partsIterator.hasNext()) {
            // last element = key=value pairs of the aggregation
            String[] subParts = part.split("&");
            Iterator<String> subPartsIterator = Arrays.stream(subParts).iterator();
            while (subPartsIterator.hasNext()) {
              String subpart = subPartsIterator.next();
              String[] kvPairs = subpart.split("=");
              aggregationString
                  .append("\"")
                  .append(kvPairs[0])
                  .append("\":\"")
                  .append(kvPairs[1])
                  .append("\"");
              if (subPartsIterator.hasNext()) aggregationString.append(",");
              aggregationMap.put(kvPairs[0], kvPairs[1]);
            }
            aggregationString.append("}");
          } else {
            String[] kvPairs = part.split("=");
            aggregationString.append("\"").append(kvPairs[1]).append("\":{");
            aggregationMap.put(kvPairs[0], kvPairs[1]);
          }
        }

        if (i < nested.length - 1) {
          aggregationString.append(",\"aggs\":{");
        }
        aggregationsMap.add(aggregationMap);
      }
      // nested aggregations will add the "aggs" key if nested.length > 1, hence *2
      aggregationString.append("}".repeat(((nested.length - 1) * 2) + 1));
      aggregationsMapList.add(aggregationsMap);
    }
    metadata.put("aggregationStr", aggregationString.toString());
    metadata.put("aggregationMapList", aggregationsMapList);
    return metadata;
  }

  public static List<TagLabel> parseTags(List<TagLabel> tags) {
    if (tags == null) {
      return Collections.emptyList();
    }
    return tags;
  }
}

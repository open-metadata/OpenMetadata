package org.openmetadata.service.search;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import lombok.Getter;
import org.openmetadata.schema.tests.type.DataQualityReportMetadata;

@Getter
public class SearchAggregation {
  public SearchAggregationNode aggregationTree;
  List<List<Map<String, String>>> rawAggregationMetadata;

  public SearchAggregation(
      SearchAggregationNode aggregationTree,
      List<List<Map<String, String>>> rawAggregationMetadata) {
    this.aggregationTree = aggregationTree;
    this.rawAggregationMetadata = rawAggregationMetadata;
  }

  /**
   * Factory method to create SearchAggregation from a tree structure.
   * Generates the rawAggregationMetadata from the node tree.
   */
  public static SearchAggregation fromTree(SearchAggregationNode rootNode) {
    SearchAggregation aggregation = new SearchAggregation(rootNode, new ArrayList<>());
    aggregation.rawAggregationMetadata = aggregation.generateMetadataFromTree();
    return aggregation;
  }

  /**
   * Static builder method for terms aggregation.
   */
  public static SearchAggregationNode terms(String name, String field) {
    return terms(name, field, 100);
  }

  /**
   * Static builder method for terms aggregation with explicit size.
   */
  public static SearchAggregationNode terms(String name, String field, int size) {
    Map<String, String> value = new HashMap<>();
    value.put("field", field);
    value.put("size", String.valueOf(size));
    return new SearchAggregationNode("terms", name, value);
  }

  /**
   * Static builder method for top_hits aggregation.
   */
  public static SearchAggregationNode topHits(
      String name, int size, String sortField, String sortOrder) {
    Map<String, String> value = new HashMap<>();
    value.put("size", String.valueOf(size));
    value.put("sort_field", sortField);
    value.put("sort_order", sortOrder);
    return new SearchAggregationNode("top_hits", name, value);
  }

  /**
   * Static builder method for filter aggregation.
   */
  public static SearchAggregationNode filter(String name, String filterJson) {
    Map<String, String> value = new HashMap<>();
    value.put("query", filterJson);
    return new SearchAggregationNode("filter", name, value);
  }

  /**
   * Static builder method for max aggregation.
   */
  public static SearchAggregationNode max(String name, String field) {
    Map<String, String> value = new HashMap<>();
    value.put("field", field);
    return new SearchAggregationNode("max", name, value);
  }

  /**
   * Static builder method for value_count aggregation.
   */
  public static SearchAggregationNode valueCount(String name, String field) {
    Map<String, String> value = new HashMap<>();
    value.put("field", field);
    return new SearchAggregationNode("value_count", name, value);
  }

  /**
   * Static builder method for bucket_selector aggregation.
   */
  public static SearchAggregationNode bucketSelector(
      String name, String script, String pathKeys, String pathValues) {
    Map<String, String> value = new HashMap<>();
    value.put("script", script);
    value.put("pathKeys", pathKeys);
    value.put("pathValues", pathValues);
    return new SearchAggregationNode("bucket_selector", name, value);
  }

  /**
   * Static builder method for bucket_sort aggregation.
   */
  public static SearchAggregationNode bucketSort(String name, Integer size, Integer from) {
    Map<String, String> value = new HashMap<>();
    if (size != null) {
      value.put("size", String.valueOf(size));
    }
    if (from != null) {
      value.put("from", String.valueOf(from));
    }
    return new SearchAggregationNode("bucket_sort", name, value);
  }

  /**
   * Static builder method for bucket_sort aggregation with sorting.
   */
  public static SearchAggregationNode bucketSort(
      String name, Integer size, Integer from, String sortField, String sortOrder) {
    Map<String, String> value = new HashMap<>();
    if (size != null) {
      value.put("size", String.valueOf(size));
    }
    if (from != null) {
      value.put("from", String.valueOf(from));
    }
    if (sortField != null) {
      value.put("sort_field", sortField);
    }
    if (sortOrder != null) {
      value.put("sort_order", sortOrder);
    }
    return new SearchAggregationNode("bucket_sort", name, value);
  }

  /**
   * Static builder method for stats_bucket pipeline aggregation.
   */
  public static SearchAggregationNode statsBucket(String name, String bucketsPath) {
    Map<String, String> value = new HashMap<>();
    value.put("buckets_path", bucketsPath);
    return new SearchAggregationNode("stats_bucket", name, value);
  }

  /*
   * Get the metadata for the aggregation results. We'll use the metadata to build the report and
   * to traverse the aggregation tree. 3 types of metadata are returned:
   *   1. dimensions: the list of dimensions
   *   2. metrics: the list of metrics
   *   3. keys: the list of keys to traverse the aggregation tree
   */
  public DataQualityReportMetadata getAggregationMetadata() {
    DataQualityReportMetadata metadata = new DataQualityReportMetadata();
    List<String> dimensions = new ArrayList<>();
    List<String> metrics = new ArrayList<>();
    List<String> keys = new ArrayList<>();

    for (List<Map<String, String>> aggregationsMap : rawAggregationMetadata) {
      // remove bucket_selector from metadata as it is a filter and neither a dimension nor a metric
      aggregationsMap.removeIf(
          aggregationMap -> aggregationMap.get("aggType").contains("bucket_selector"));
      for (int j = 0; j < aggregationsMap.size(); j++) {
        Map<String, String> aggregationMap = aggregationsMap.get(j);
        String aggType = aggregationMap.get("aggType");
        String field = aggregationMap.get("field");

        boolean isLeaf = j == aggregationsMap.size() - 1;
        if (isLeaf) {
          // leaf aggregation
          if (!aggType.contains("term") && !aggType.contains("filter")) {
            metrics.add(field);
          } else {
            if (field != null) {
              dimensions.add(field);
            }
            metrics.add("document_count");
          }
        } else {
          if (field != null) {
            dimensions.add(field);
          }
        }
        String formattedAggType = aggType.contains("term") ? "s%s".formatted(aggType) : aggType;
        keys.add("%s#%s".formatted(formattedAggType, aggregationMap.get("bucketName")));
      }
    }

    metadata.withKeys(keys).withDimensions(dimensions).withMetrics(metrics);

    return metadata;
  }

  /**
   * Generates rawAggregationMetadata from the aggregation tree structure.
   */
  private List<List<Map<String, String>>> generateMetadataFromTree() {
    List<List<Map<String, String>>> metadata = new ArrayList<>();
    generateMetadataFromNode(aggregationTree, new ArrayList<>(), metadata);
    return metadata;
  }

  /**
   * Recursively generates metadata from a node and its children.
   */
  private void generateMetadataFromNode(
      SearchAggregationNode node,
      List<Map<String, String>> currentPath,
      List<List<Map<String, String>>> allPaths) {

    // Skip root node
    if (!"root".equals(node.getType())) {
      Map<String, String> nodeMetadata = new HashMap<>();
      nodeMetadata.put("aggType", node.getType());
      nodeMetadata.put("bucketName", node.getName());

      // Add field information if available
      if (node.getValue() != null && node.getValue().containsKey("field")) {
        nodeMetadata.put("field", node.getValue().get("field"));
      }

      currentPath.add(nodeMetadata);
    }

    // If this is a leaf node, add the path to allPaths
    if (node.getChildren().isEmpty() && !"root".equals(node.getType())) {
      allPaths.add(new ArrayList<>(currentPath));
    } else {
      // Recursively process children
      for (SearchAggregationNode child : node.getChildren()) {
        generateMetadataFromNode(child, new ArrayList<>(currentPath), allPaths);
      }
    }
  }
}

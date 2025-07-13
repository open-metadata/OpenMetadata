package org.openmetadata.service.search;

import java.util.ArrayList;
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
}

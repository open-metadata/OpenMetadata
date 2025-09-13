package org.openmetadata.search.example;

import java.util.List;
import java.util.Map;
import org.openmetadata.search.SearchAggregationNode;
import org.openmetadata.search.aggregation.OMSearchAggregation;
import org.openmetadata.search.aggregation.OMSearchAggregationFactory;
import org.openmetadata.search.aggregation.elasticsearch.ElasticSearchAggregationFactory;

/**
 * Example showing how to migrate from the existing aggregation packages to the unified system.
 *
 * BEFORE (in openmetadata-service):
 * - org.openmetadata.service.search.elasticsearch.aggregations.*
 * - org.openmetadata.service.search.opensearch.aggregations.*
 *
 * AFTER (using openmetadata-search):
 * - org.openmetadata.search.aggregation.*
 */
public class AggregationMigrationExample {

  public void demonstrateOldVsNew() {

    // OLD WAY: Separate ES and OpenSearch implementations
    /*
    // For Elasticsearch:
    List<ElasticAggregations> esAggregations =
        ElasticAggregationsBuilder.buildAggregation(rootNode, null, new ArrayList<>());

    // For OpenSearch:
    List<OpenAggregations> osAggregations =
        OpenAggregationsBuilder.buildAggregation(rootNode, null, new ArrayList<>());
    */

    // NEW WAY: Single unified approach works for both ES and OpenSearch
    SearchAggregationNode rootNode = createSampleAggregationTree();

    // Can use either Elasticsearch or OpenSearch factory
    OMSearchAggregationFactory factory = new ElasticSearchAggregationFactory();
    // OMSearchAggregationFactory factory = new OpenSearchAggregationFactory(); // Future

    List<OMSearchAggregation> aggregations = factory.buildAggregationTree(rootNode);

    // Convert to native ES/OpenSearch aggregations when needed
    for (OMSearchAggregation agg : aggregations) {
      // For Elasticsearch
      es.co.elastic.clients.elasticsearch._types.aggregations.Aggregation esAgg =
          agg.build(es.co.elastic.clients.elasticsearch._types.aggregations.Aggregation.class);

      // For OpenSearch (future)
      // os.org.opensearch.client.opensearch._types.aggregations.Aggregation osAgg =
      //     agg.build(os.org.opensearch.client.opensearch._types.aggregations.Aggregation.class);
    }
  }

  public void demonstrateSpecificAggregations() {
    OMSearchAggregationFactory factory = new ElasticSearchAggregationFactory();

    // Terms aggregation (replaces ElasticTermsAggregations & OpenTermsAggregations)
    SearchAggregationNode termsNode =
        new SearchAggregationNode(
            "terms", "category_terms", Map.of("field", "category", "size", "10"));
    OMSearchAggregation termsAgg = factory.createAggregation("terms");
    termsAgg.createAggregation(termsNode);

    // Date histogram aggregation (replaces ElasticDateHistogramAggregations &
    // OpenDateHistogramAggregations)
    SearchAggregationNode dateHistogramNode =
        new SearchAggregationNode(
            "date_histogram",
            "daily_buckets",
            Map.of("field", "timestamp", "calendar_interval", "1d"));
    OMSearchAggregation dateHistAgg = factory.createAggregation("date_histogram");
    dateHistAgg.createAggregation(dateHistogramNode);

    // Avg aggregation (replaces ElasticAvgAggregations & OpenAvgAggregations)
    SearchAggregationNode avgNode =
        new SearchAggregationNode("avg", "average_score", Map.of("field", "score"));
    OMSearchAggregation avgAgg = factory.createAggregation("avg");
    avgAgg.createAggregation(avgNode);
  }

  private SearchAggregationNode createSampleAggregationTree() {
    // Create a sample aggregation tree like those used in AggregatedUnusedAssetsCountAggregator
    SearchAggregationNode root = new SearchAggregationNode("root", "root", Map.of());

    SearchAggregationNode timestampHistogram =
        new SearchAggregationNode(
            "date_histogram", "timestamp", Map.of("field", "timestamp", "calendar_interval", "1d"));

    // Add nested aggregations like in the original pattern
    SearchAggregationNode unusedThreeDays =
        new SearchAggregationNode(
            "sum", "unusedDataAssetsThreeDays", Map.of("field", "unusedThreeDays"));

    SearchAggregationNode unusedSevenDays =
        new SearchAggregationNode(
            "sum", "unusedDataAssetsSevenDays", Map.of("field", "unusedSevenDays"));

    timestampHistogram.addChild(unusedThreeDays);
    timestampHistogram.addChild(unusedSevenDays);
    root.addChild(timestampHistogram);

    return root;
  }

  /**
   * Migration path for existing code:
   *
   * 1. Replace imports:
   *    - Remove: org.openmetadata.service.search.elasticsearch.aggregations.*
   *    - Remove: org.openmetadata.service.search.opensearch.aggregations.*
   *    - Add: org.openmetadata.search.aggregation.*
   *
   * 2. Replace factory usage:
   *    - Remove: ElasticAggregationsBuilder.buildAggregation(...)
   *    - Remove: OpenAggregationsBuilder.buildAggregation(...)
   *    - Add: factory.buildAggregationTree(rootNode)
   *
   * 3. Replace specific aggregation creation:
   *    - Remove: new ElasticTermsAggregations()
   *    - Remove: new OpenTermsAggregations()
   *    - Add: factory.createAggregation("terms")
   *
   * 4. Update build calls:
   *    - Remove: aggregation.getElasticAggregationBuilder()
   *    - Add: aggregation.build(Aggregation.class)
   */
}

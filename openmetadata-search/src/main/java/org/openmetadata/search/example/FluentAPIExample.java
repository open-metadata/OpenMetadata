package org.openmetadata.search.example;

import org.openmetadata.search.query.builder.OMQueryBuilder;
import org.openmetadata.search.query.builder.OMQueryBuilderFactory;
import org.openmetadata.search.query.builder.OMSearchSourceBuilder;
import org.openmetadata.search.query.builder.elasticsearch.ElasticQueryBuilderFactory;

public class FluentAPIExample {

  public void demonstrateUnifiedAPI() {
    // Can use either Elasticsearch or OpenSearch factory
    OMQueryBuilderFactory factory = new ElasticQueryBuilderFactory();
    // OMQueryBuilderFactory factory = new OpenSearchQueryBuilderFactory();

    // Build complex queries using fluent API
    OMQueryBuilder query =
        factory
            .boolQuery()
            .must(factory.termQuery("status", "active"))
            .should(factory.matchQuery("name", "dashboard"))
            .should(factory.multiMatchQuery("search term", "description", "title"))
            .mustNot(factory.termQuery("deleted", "true"));

    // Build function score query
    OMQueryBuilder functionScoreQuery =
        factory
            .functionScore()
            .query(query)
            .add(
                factory.termQuery("featured", "true"),
                factory.functionScore().fieldValueFactor("popularity").weight(2.0f))
            .scoreMode("multiply")
            .boostMode("sum")
            .build();

    // Build search request with aggregations
    OMSearchSourceBuilder searchRequest =
        factory
            .searchSource()
            .query(functionScoreQuery)
            .from(0)
            .size(20)
            .aggregation("categories", factory.aggregation("categories", "terms").terms("category"))
            .aggregation(
                "date_histogram",
                factory.aggregation("dates", "date_histogram").dateHistogram("created_date", "1d"))
            .highlight(
                factory
                    .highlight()
                    .field("name")
                    .field("description", 150, 3)
                    .preTags("<mark>")
                    .postTags("</mark>"));

    // The same code works for both Elasticsearch and OpenSearch!
    // Just change the factory implementation
  }

  public void demonstrateAggregation() {
    OMQueryBuilderFactory factory = new ElasticQueryBuilderFactory();

    // Complex nested aggregation like AggregatedUnusedAssetsCountAggregator
    OMSearchSourceBuilder searchRequest =
        factory
            .searchSource()
            .size(0) // Only aggregations, no hits
            .aggregation(
                "timestamp_histogram",
                factory
                    .aggregation("timestamp", "date_histogram")
                    .dateHistogram("timestamp", "1d")
                    .subAggregation(
                        "unusedDataAssetsThreeDays",
                        factory.aggregation("unused_3d", "sum").sum("unusedThreeDays"))
                    .subAggregation(
                        "unusedDataAssetsSevenDays",
                        factory.aggregation("unused_7d", "sum").sum("unusedSevenDays"))
                    .subAggregation(
                        "frequentlyUsedDataAssetsThreeDays",
                        factory.aggregation("frequent_3d", "sum").sum("frequentThreeDays")));
  }
}

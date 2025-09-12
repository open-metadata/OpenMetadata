package org.openmetadata.search.aggregation.opensearch;

import org.openmetadata.search.aggregation.OMSearchAggregation;
import org.openmetadata.search.aggregation.OMSearchAggregationFactory;

public class OpenSearchAggregationFactory implements OMSearchAggregationFactory {

  @Override
  public OMSearchAggregation createAggregation(String type) {
    return switch (type) {
      case "bucket_selector" -> new OpenSearchBucketSelectorAggregation();
      case "date_histogram" -> new OpenSearchDateHistogramAggregation();
      case "terms" -> new OpenSearchTermsAggregation();
      case "avg" -> new OpenSearchAvgAggregation();
      case "min" -> new OpenSearchMinAggregation();
      case "cardinality" -> new OpenSearchCardinalityAggregation();
      case "nested" -> new OpenSearchNestedAggregation();
      case "top_hits" -> new OpenSearchTopHitsAggregation();
      case "sum" -> new OpenSearchSumAggregation();
      case "max" -> new OpenSearchMaxAggregation();
      case "histogram" -> new OpenSearchHistogramAggregation();
      case "range" -> new OpenSearchRangeAggregation();
      case "filter" -> new OpenSearchFilterAggregation();
      default -> throw new IllegalArgumentException("Unsupported aggregation type: " + type);
    };
  }
}

// Stub implementations for OpenSearch aggregation types
class OpenSearchBucketSelectorAggregation extends OpenSearchBaseAggregation {
  public OpenSearchBucketSelectorAggregation() {
    super("bucket_selector");
  }

  @Override
  public boolean isPipelineAggregation() {
    return true;
  }

  @Override
  protected void buildSpecificAggregation(org.openmetadata.search.SearchAggregationNode node) {
    /* stub */
  }
}

class OpenSearchDateHistogramAggregation extends OpenSearchBaseAggregation {
  public OpenSearchDateHistogramAggregation() {
    super("date_histogram");
  }

  @Override
  protected void buildSpecificAggregation(org.openmetadata.search.SearchAggregationNode node) {
    /* stub */
  }
}

class OpenSearchTermsAggregation extends OpenSearchBaseAggregation {
  public OpenSearchTermsAggregation() {
    super("terms");
  }

  @Override
  protected void buildSpecificAggregation(org.openmetadata.search.SearchAggregationNode node) {
    /* stub */
  }
}

class OpenSearchAvgAggregation extends OpenSearchBaseAggregation {
  public OpenSearchAvgAggregation() {
    super("avg");
  }

  @Override
  protected void buildSpecificAggregation(org.openmetadata.search.SearchAggregationNode node) {
    /* stub */
  }
}

class OpenSearchMinAggregation extends OpenSearchBaseAggregation {
  public OpenSearchMinAggregation() {
    super("min");
  }

  @Override
  protected void buildSpecificAggregation(org.openmetadata.search.SearchAggregationNode node) {
    /* stub */
  }
}

class OpenSearchCardinalityAggregation extends OpenSearchBaseAggregation {
  public OpenSearchCardinalityAggregation() {
    super("cardinality");
  }

  @Override
  protected void buildSpecificAggregation(org.openmetadata.search.SearchAggregationNode node) {
    /* stub */
  }
}

class OpenSearchNestedAggregation extends OpenSearchBaseAggregation {
  public OpenSearchNestedAggregation() {
    super("nested");
  }

  @Override
  protected void buildSpecificAggregation(org.openmetadata.search.SearchAggregationNode node) {
    /* stub */
  }
}

class OpenSearchTopHitsAggregation extends OpenSearchBaseAggregation {
  public OpenSearchTopHitsAggregation() {
    super("top_hits");
  }

  @Override
  protected void buildSpecificAggregation(org.openmetadata.search.SearchAggregationNode node) {
    /* stub */
  }
}

class OpenSearchSumAggregation extends OpenSearchBaseAggregation {
  public OpenSearchSumAggregation() {
    super("sum");
  }

  @Override
  protected void buildSpecificAggregation(org.openmetadata.search.SearchAggregationNode node) {
    /* stub */
  }
}

class OpenSearchMaxAggregation extends OpenSearchBaseAggregation {
  public OpenSearchMaxAggregation() {
    super("max");
  }

  @Override
  protected void buildSpecificAggregation(org.openmetadata.search.SearchAggregationNode node) {
    /* stub */
  }
}

class OpenSearchHistogramAggregation extends OpenSearchBaseAggregation {
  public OpenSearchHistogramAggregation() {
    super("histogram");
  }

  @Override
  protected void buildSpecificAggregation(org.openmetadata.search.SearchAggregationNode node) {
    /* stub */
  }
}

class OpenSearchRangeAggregation extends OpenSearchBaseAggregation {
  public OpenSearchRangeAggregation() {
    super("range");
  }

  @Override
  protected void buildSpecificAggregation(org.openmetadata.search.SearchAggregationNode node) {
    /* stub */
  }
}

class OpenSearchFilterAggregation extends OpenSearchBaseAggregation {
  public OpenSearchFilterAggregation() {
    super("filter");
  }

  @Override
  protected void buildSpecificAggregation(org.openmetadata.search.SearchAggregationNode node) {
    /* stub */
  }
}

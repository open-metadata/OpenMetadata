package org.openmetadata.search.aggregation.elasticsearch;

import org.openmetadata.search.SearchAggregationNode;

class ElasticNestedAggregation extends ElasticBaseAggregation {
  public ElasticNestedAggregation() {
    super("nested");
  }

  @Override
  public void createAggregation(SearchAggregationNode node) {
    this.name = node.getName();
    buildSpecificAggregation(node);
  }

  @Override
  protected void buildSpecificAggregation(SearchAggregationNode node) {
    /* stub */
  }
}

class ElasticTopHitsAggregation extends ElasticBaseAggregation {
  public ElasticTopHitsAggregation() {
    super("top_hits");
  }

  @Override
  public void createAggregation(SearchAggregationNode node) {
    this.name = node.getName();
    buildSpecificAggregation(node);
  }

  @Override
  protected void buildSpecificAggregation(SearchAggregationNode node) {
    /* stub */
  }
}

class ElasticSumAggregation extends ElasticBaseAggregation {
  public ElasticSumAggregation() {
    super("sum");
  }

  @Override
  public void createAggregation(SearchAggregationNode node) {
    this.name = node.getName();
    buildSpecificAggregation(node);
  }

  @Override
  protected void buildSpecificAggregation(SearchAggregationNode node) {
    /* stub */
  }
}

class ElasticMaxAggregation extends ElasticBaseAggregation {
  public ElasticMaxAggregation() {
    super("max");
  }

  @Override
  public void createAggregation(SearchAggregationNode node) {
    this.name = node.getName();
    buildSpecificAggregation(node);
  }

  @Override
  protected void buildSpecificAggregation(SearchAggregationNode node) {
    /* stub */
  }
}

class ElasticHistogramAggregation extends ElasticBaseAggregation {
  public ElasticHistogramAggregation() {
    super("histogram");
  }

  @Override
  public void createAggregation(SearchAggregationNode node) {
    this.name = node.getName();
    buildSpecificAggregation(node);
  }

  @Override
  protected void buildSpecificAggregation(SearchAggregationNode node) {
    /* stub */
  }
}

class ElasticRangeAggregation extends ElasticBaseAggregation {
  public ElasticRangeAggregation() {
    super("range");
  }

  @Override
  public void createAggregation(SearchAggregationNode node) {
    this.name = node.getName();
    buildSpecificAggregation(node);
  }

  @Override
  protected void buildSpecificAggregation(SearchAggregationNode node) {
    /* stub */
  }
}

class ElasticFilterAggregation extends ElasticBaseAggregation {
  public ElasticFilterAggregation() {
    super("filter");
  }

  @Override
  public void createAggregation(SearchAggregationNode node) {
    this.name = node.getName();
    buildSpecificAggregation(node);
  }

  @Override
  protected void buildSpecificAggregation(SearchAggregationNode node) {
    /* stub */
  }
}

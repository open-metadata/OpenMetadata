package org.openmetadata.search.aggregation.elasticsearch;

import static org.openmetadata.search.utils.SearchUtils.nullOrEmpty;

import es.co.elastic.clients.elasticsearch._types.aggregations.Aggregation;
import es.co.elastic.clients.elasticsearch._types.aggregations.TermsAggregation;
import java.util.Map;
import org.openmetadata.search.SearchAggregationNode;

public class ElasticTermsAggregation extends ElasticBaseAggregation {

  public ElasticTermsAggregation() {
    super("terms");
  }

  @Override
  public void createAggregation(SearchAggregationNode node) {
    this.name = node.getName();
    buildSpecificAggregation(node);
  }

  @Override
  protected void buildSpecificAggregation(SearchAggregationNode node) {
    Map<String, String> params = node.getValue();
    String field = params.get("field");
    String includesStr = params.get("include");
    String sizeStr = params.get("size");
    String missing = params.get("missing");

    TermsAggregation.Builder termsBuilder = new TermsAggregation.Builder().field(field);

    if (!nullOrEmpty(sizeStr)) {
      int size = Integer.parseInt(sizeStr);
      if (size > 0) {
        termsBuilder.size(size);
      }
    }

    if (!nullOrEmpty(includesStr)) {
      String[] includes = includesStr.split(",");
      // Note: Include/exclude pattern would need proper implementation with modern ES client
    }

    if (!nullOrEmpty(missing)) {
      termsBuilder.missing(missing);
    }

    this.aggregationBuilder = new Aggregation.Builder().terms(termsBuilder);
  }
}

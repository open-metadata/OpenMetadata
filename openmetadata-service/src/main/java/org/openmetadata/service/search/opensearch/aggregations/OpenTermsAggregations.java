package org.openmetadata.service.search.opensearch.aggregations;

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;

import java.util.Map;
import lombok.Getter;
import lombok.Setter;
import org.openmetadata.service.search.SearchAggregationNode;
import os.org.opensearch.search.aggregations.AggregationBuilder;
import os.org.opensearch.search.aggregations.AggregationBuilders;
import os.org.opensearch.search.aggregations.PipelineAggregationBuilder;
import os.org.opensearch.search.aggregations.bucket.terms.IncludeExclude;
import os.org.opensearch.search.aggregations.bucket.terms.TermsAggregationBuilder;

@Setter
@Getter
public class OpenTermsAggregations implements OpenAggregations {
  static final String aggregationType = "terms";
  AggregationBuilder elasticAggregationBuilder;

  @Override
  public void createAggregation(SearchAggregationNode node) {
    String[] includes = null;
    int size = -1;
    Map<String, String> params = node.getValue();
    String includesStr = params.get("include");
    String sizeStr = params.get("size");
    if (!nullOrEmpty(includesStr)) includes = includesStr.split(",");
    if (!nullOrEmpty(sizeStr)) size = Integer.parseInt(params.get("size"));
    TermsAggregationBuilder termsAggregationBuilder =
        AggregationBuilders.terms(node.getName()).field(params.get("field"));

    if (size > 0) termsAggregationBuilder.size(size);
    if (!nullOrEmpty(includes)) {
      IncludeExclude includeExclude = new IncludeExclude(includes, null);
      termsAggregationBuilder.includeExclude(includeExclude);
    }
    if (params.get("missing") != null) {
      termsAggregationBuilder.missing(params.get("missing"));
    }
    setElasticAggregationBuilder(termsAggregationBuilder);
  }

  @Override
  public void setSubAggregation(PipelineAggregationBuilder aggregation) {
    if (elasticAggregationBuilder != null) {
      elasticAggregationBuilder.subAggregation(aggregation);
    }
  }

  @Override
  public void setSubAggregation(AggregationBuilder aggregation) {
    if (elasticAggregationBuilder != null) {
      elasticAggregationBuilder.subAggregation(aggregation);
    }
  }
}

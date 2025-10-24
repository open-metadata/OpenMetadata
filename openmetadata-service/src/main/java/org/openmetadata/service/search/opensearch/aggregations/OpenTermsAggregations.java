package org.openmetadata.service.search.opensearch.aggregations;

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;

import java.util.Arrays;
import java.util.HashMap;
import java.util.Map;
import lombok.Getter;
import lombok.Setter;
import org.openmetadata.service.search.SearchAggregationNode;
import os.org.opensearch.client.opensearch._types.aggregations.Aggregation;
import os.org.opensearch.client.opensearch._types.aggregations.TermsAggregation;

@Setter
@Getter
public class OpenTermsAggregations implements OpenAggregations {
  static final String aggregationType = "terms";
  private String aggregationName;
  private Aggregation aggregation;
  private Map<String, Aggregation> subAggregations = new HashMap<>();

  @Override
  public void createAggregation(SearchAggregationNode node) {
    Map<String, String> params = node.getValue();
    this.aggregationName = node.getName();

    String field = params.get("field");
    String includesStr = params.get("include");
    String sizeStr = params.get("size");
    String missing = params.get("missing");

    int size = !nullOrEmpty(sizeStr) ? Integer.parseInt(sizeStr) : 10;

    this.aggregation =
        Aggregation.of(
            a ->
                a.terms(
                    TermsAggregation.of(
                        terms -> {
                          var builder = terms.field(field).size(size);

                          if (!nullOrEmpty(includesStr)) {
                            String[] includes = includesStr.split(",");
                            builder.include(i -> i.terms(Arrays.asList(includes)));
                          }

                          if (missing != null) {
                            builder.missing(m -> m.stringValue(missing));
                          }

                          return builder;
                        })));
  }

  @Override
  public void setSubAggregations(Map<String, Aggregation> subAggregations) {
    this.subAggregations = subAggregations;
  }
}

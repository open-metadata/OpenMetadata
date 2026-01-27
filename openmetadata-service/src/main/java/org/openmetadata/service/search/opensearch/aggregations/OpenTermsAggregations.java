package org.openmetadata.service.search.opensearch.aggregations;

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;

import java.util.Arrays;
import java.util.HashMap;
import java.util.Map;
import lombok.Getter;
import lombok.Setter;
import org.openmetadata.service.search.SearchAggregationNode;
import os.org.opensearch.client.opensearch._types.aggregations.Aggregation;

@Setter
@Getter
public class OpenTermsAggregations implements OpenAggregations {
  private String aggregationName;
  private Aggregation aggregation;
  private Map<String, Aggregation> subAggregations = new HashMap<>();
  private String field;
  private String includesStr;
  private int size;
  private String missing;

  @Override
  public void createAggregation(SearchAggregationNode node) {
    Map<String, String> params = node.getValue();
    this.aggregationName = node.getName();

    this.field = params.get("field");
    this.includesStr = params.get("include");
    String sizeStr = params.get("size");
    this.missing = params.get("missing");

    this.size = !nullOrEmpty(sizeStr) ? Integer.parseInt(sizeStr) : 10;

    buildAggregation();
  }

  private void buildAggregation() {
    if (!subAggregations.isEmpty()) {
      this.aggregation =
          Aggregation.of(
              a ->
                  a.terms(
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
                          })
                      .aggregations(subAggregations));
    } else {
      this.aggregation =
          Aggregation.of(
              a ->
                  a.terms(
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
                      }));
    }
  }

  @Override
  public void setSubAggregations(Map<String, Aggregation> subAggregations) {
    this.subAggregations = subAggregations;
    if (!subAggregations.isEmpty()) {
      buildAggregation();
    }
  }

  @Override
  public Boolean supportsSubAggregationsNatively() {
    return true;
  }
}

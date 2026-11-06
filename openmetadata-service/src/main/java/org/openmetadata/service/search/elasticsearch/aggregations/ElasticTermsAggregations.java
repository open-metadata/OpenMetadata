package org.openmetadata.service.search.elasticsearch.aggregations;

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;

import es.co.elastic.clients.elasticsearch._types.aggregations.Aggregation;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import lombok.Getter;
import lombok.Setter;
import org.openmetadata.service.search.SearchAggregation;
import org.openmetadata.service.search.SearchAggregationNode;
import org.openmetadata.service.search.SearchSourceBuilderFactory;

@Setter
@Getter
public class ElasticTermsAggregations implements ElasticAggregations {
  private String aggregationName;
  private Aggregation aggregation;
  private Map<String, Aggregation> subAggregations = new HashMap<>();
  private String field;
  private List<String> includedValues = List.of();
  private int size;
  private String missing;

  @Override
  public void createAggregation(SearchAggregationNode node) {
    Map<String, String> params = node.getValue();
    this.aggregationName = node.getName();

    this.field = SearchSourceBuilderFactory.resolveFieldForSortOrAggregation(params.get("field"));
    this.includedValues = SearchAggregation.includedValues(params);
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

                            if (!includedValues.isEmpty()) {
                              builder.include(i -> i.terms(includedValues));
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

                        if (!includedValues.isEmpty()) {
                          builder.include(i -> i.terms(includedValues));
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

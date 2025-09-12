package org.openmetadata.service.search.opensearch.aggregations;

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;

import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.Map;
import lombok.Getter;
import lombok.Setter;
import org.openmetadata.service.search.SearchAggregationNode;
import os.org.opensearch.index.query.QueryBuilders;
import os.org.opensearch.script.Script;
import os.org.opensearch.script.ScriptType;
import os.org.opensearch.search.aggregations.AggregationBuilder;
import os.org.opensearch.search.aggregations.AggregationBuilders;
import os.org.opensearch.search.aggregations.PipelineAggregationBuilder;
import os.org.opensearch.search.aggregations.bucket.filter.FiltersAggregationBuilder;
import os.org.opensearch.search.aggregations.bucket.filter.FiltersAggregator;

@Setter
@Getter
public class OpenFiltersAggregations implements OpenAggregations {
  private static final String SUB_AGGREGATION_NAME = "subAgg";
  private static final String PARAM_FIELD = "field";
  private static final String PARAM_FILTERS = "filters";
  private static final String PARAM_SUB_AGG_FIELD = "subAggField";
  private static final String PARAM_SUB_AGG_SCRIPT = "subAggScript";

  AggregationBuilder elasticAggregationBuilder;
  private int maxAggregationSize = 10000;

  @Override
  public void createAggregation(SearchAggregationNode node) {
    createFromParamsMap(node);
  }

  public void createAggregation(
      org.openmetadata.schema.api.search.Aggregation agg, int maxAggregationSize) {
    this.maxAggregationSize = maxAggregationSize;
    createFromAggregationObject(agg);
  }

  private void createFromAggregationObject(org.openmetadata.schema.api.search.Aggregation agg) {
    String field = agg.getField();

    if (nullOrEmpty(field)) {
      throw new IllegalArgumentException(
          "'" + PARAM_FIELD + "' parameter is required for filters aggregation");
    }

    FiltersAggregationBuilder filtersAggregationBuilder;

    String filtersParam = agg.getFilters();

    if (nullOrEmpty(filtersParam)) {
      filtersAggregationBuilder =
          AggregationBuilders.filters(agg.getName(), QueryBuilders.matchAllQuery());
    } else {
      String[] filterValues = filtersParam.split(",");
      Map<String, os.org.opensearch.index.query.QueryBuilder> filters = new LinkedHashMap<>();

      for (String filterValue : filterValues) {
        String trimmedValue = filterValue.trim();
        filters.put(trimmedValue, QueryBuilders.termQuery(field, trimmedValue));
      }

      filtersAggregationBuilder =
          AggregationBuilders.filters(
              agg.getName(),
              filters.entrySet().stream()
                  .map(entry -> new FiltersAggregator.KeyedFilter(entry.getKey(), entry.getValue()))
                  .toArray(FiltersAggregator.KeyedFilter[]::new));
    }

    String subAggField = agg.getSubAggField();
    String subAggScript = agg.getSubAggScript();

    if (!nullOrEmpty(subAggField) && !nullOrEmpty(subAggScript)) {
      filtersAggregationBuilder.subAggregation(
          AggregationBuilders.terms(SUB_AGGREGATION_NAME)
              .script(
                  new Script(ScriptType.INLINE, "painless", subAggScript, Collections.emptyMap()))
              .size(maxAggregationSize));
    } else if (!nullOrEmpty(subAggField)) {
      filtersAggregationBuilder.subAggregation(
          AggregationBuilders.terms(SUB_AGGREGATION_NAME)
              .field(subAggField)
              .size(maxAggregationSize));
    }

    setElasticAggregationBuilder(filtersAggregationBuilder);
  }

  private void createFromParamsMap(SearchAggregationNode node) {
    Map<String, String> params = node.getValue();

    String field = params.get(PARAM_FIELD);

    if (nullOrEmpty(field)) {
      throw new IllegalArgumentException(
          "'" + PARAM_FIELD + "' parameter is required for filters aggregation");
    }

    FiltersAggregationBuilder filtersAggregationBuilder;

    String filtersParam = params.get(PARAM_FILTERS);

    if (nullOrEmpty(filtersParam)) {
      filtersAggregationBuilder =
          AggregationBuilders.filters(node.getName(), QueryBuilders.matchAllQuery());
    } else {
      String[] filterValues = filtersParam.split(",");
      Map<String, os.org.opensearch.index.query.QueryBuilder> filters = new LinkedHashMap<>();

      for (String filterValue : filterValues) {
        String trimmedValue = filterValue.trim();
        filters.put(trimmedValue, QueryBuilders.termQuery(field, trimmedValue));
      }

      filtersAggregationBuilder =
          AggregationBuilders.filters(
              node.getName(),
              filters.entrySet().stream()
                  .map(entry -> new FiltersAggregator.KeyedFilter(entry.getKey(), entry.getValue()))
                  .toArray(FiltersAggregator.KeyedFilter[]::new));
    }

    String subAggField = params.get(PARAM_SUB_AGG_FIELD);
    String subAggScript = params.get(PARAM_SUB_AGG_SCRIPT);

    if (!nullOrEmpty(subAggField) && !nullOrEmpty(subAggScript)) {
      filtersAggregationBuilder.subAggregation(
          AggregationBuilders.terms(SUB_AGGREGATION_NAME)
              .script(
                  new Script(ScriptType.INLINE, "painless", subAggScript, Collections.emptyMap()))
              .size(maxAggregationSize));
    } else if (!nullOrEmpty(subAggField)) {
      filtersAggregationBuilder.subAggregation(
          AggregationBuilders.terms(SUB_AGGREGATION_NAME)
              .field(subAggField)
              .size(maxAggregationSize));
    }

    setElasticAggregationBuilder(filtersAggregationBuilder);
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

package org.openmetadata.search.query.builder.opensearch;

import java.util.List;
import java.util.Map;
import org.openmetadata.search.query.builder.OMFunctionScoreQueryBuilder;
import org.openmetadata.search.query.builder.OMQueryBuilder;

public class OpenSearchFunctionScoreQueryBuilder implements OMFunctionScoreQueryBuilder {

  @Override
  public OMFunctionScoreQueryBuilder query(OMQueryBuilder query) {
    return this;
  }

  @Override
  public OMFunctionScoreQueryBuilder add(OMQueryBuilder filter, OMScoreFunction function) {
    return this;
  }

  @Override
  public OMFunctionScoreQueryBuilder add(OMScoreFunction function) {
    return this;
  }

  @Override
  public OMFunctionScoreQueryBuilder functions(List<OMFilterFunctionBuilder> functions) {
    return this;
  }

  @Override
  public OMFunctionScoreQueryBuilder scoreMode(String scoreMode) {
    return this;
  }

  @Override
  public OMFunctionScoreQueryBuilder boostMode(String boostMode) {
    return this;
  }

  @Override
  public OMFunctionScoreQueryBuilder maxBoost(float maxBoost) {
    return this;
  }

  @Override
  public OMFunctionScoreQueryBuilder minScore(float minScore) {
    return this;
  }

  @Override
  public OMQueryBuilder build() {
    return new OpenSearchQueryBuilder();
  }

  @Override
  public OMScoreFunction fieldValueFactor(String field) {
    return new OpenSearchScoreFunction();
  }

  @Override
  public OMScoreFunction scriptScore(String script, Map<String, Object> params) {
    return new OpenSearchScoreFunction();
  }

  @Override
  public OMScoreFunction randomScore(int seed) {
    return new OpenSearchScoreFunction();
  }

  @Override
  public OMScoreFunction linearDecay(String field, Object origin, Object scale) {
    return new OpenSearchScoreFunction();
  }

  @Override
  public OMScoreFunction exponentialDecay(String field, Object origin, Object scale) {
    return new OpenSearchScoreFunction();
  }

  @Override
  public OMScoreFunction gaussianDecay(String field, Object origin, Object scale) {
    return new OpenSearchScoreFunction();
  }

  public static class OpenSearchScoreFunction implements OMScoreFunction {
    @Override
    public OMScoreFunction weight(float weight) {
      return this;
    }
  }
}

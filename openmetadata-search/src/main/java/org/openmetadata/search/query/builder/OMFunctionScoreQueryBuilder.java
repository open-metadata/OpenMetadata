package org.openmetadata.search.query.builder;

import java.util.List;
import java.util.Map;

public interface OMFunctionScoreQueryBuilder {

  OMFunctionScoreQueryBuilder query(OMQueryBuilder query);

  OMFunctionScoreQueryBuilder add(OMQueryBuilder filter, OMScoreFunction function);

  OMFunctionScoreQueryBuilder add(OMScoreFunction function);

  OMFunctionScoreQueryBuilder functions(List<OMFilterFunctionBuilder> functions);

  OMFunctionScoreQueryBuilder scoreMode(String scoreMode);

  OMFunctionScoreQueryBuilder boostMode(String boostMode);

  OMFunctionScoreQueryBuilder maxBoost(float maxBoost);

  OMFunctionScoreQueryBuilder minScore(float minScore);

  OMQueryBuilder build();

  interface OMFilterFunctionBuilder {
    OMFilterFunctionBuilder filter(OMQueryBuilder filter);

    OMFilterFunctionBuilder function(OMScoreFunction function);

    OMFilterFunctionBuilder weight(float weight);
  }

  interface OMScoreFunction {
    OMScoreFunction weight(float weight);
  }

  OMScoreFunction fieldValueFactor(String field);

  OMScoreFunction scriptScore(String script, Map<String, Object> params);

  OMScoreFunction randomScore(int seed);

  OMScoreFunction linearDecay(String field, Object origin, Object scale);

  OMScoreFunction exponentialDecay(String field, Object origin, Object scale);

  OMScoreFunction gaussianDecay(String field, Object origin, Object scale);
}

package org.openmetadata.search.query.builder.elasticsearch;

import es.co.elastic.clients.elasticsearch._types.query_dsl.FunctionScore;
import es.co.elastic.clients.elasticsearch._types.query_dsl.FunctionScoreQuery;
import es.co.elastic.clients.elasticsearch._types.query_dsl.Query;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import org.openmetadata.search.query.builder.OMFunctionScoreQueryBuilder;
import org.openmetadata.search.query.builder.OMQueryBuilder;

public class ElasticFunctionScoreQueryBuilder implements OMFunctionScoreQueryBuilder {
  private final FunctionScoreQuery.Builder functionScoreBuilder;
  private final List<FunctionScore> functions;

  public ElasticFunctionScoreQueryBuilder() {
    this.functionScoreBuilder = new FunctionScoreQuery.Builder();
    this.functions = new ArrayList<>();
  }

  @Override
  public OMFunctionScoreQueryBuilder query(OMQueryBuilder query) {
    ElasticQueryBuilder elasticQuery = (ElasticQueryBuilder) query;
    functionScoreBuilder.query(elasticQuery.build(Query.class));
    return this;
  }

  @Override
  public OMFunctionScoreQueryBuilder add(OMQueryBuilder filter, OMScoreFunction function) {
    ElasticQueryBuilder elasticFilter = (ElasticQueryBuilder) filter;
    ElasticScoreFunction elasticFunction = (ElasticScoreFunction) function;

    FunctionScore functionScore =
        FunctionScore.of(
            fs -> fs.filter(elasticFilter.build(Query.class)).weight(elasticFunction.getWeight()));

    functions.add(functionScore);
    return this;
  }

  @Override
  public OMFunctionScoreQueryBuilder add(OMScoreFunction function) {
    ElasticScoreFunction elasticFunction = (ElasticScoreFunction) function;

    FunctionScore functionScore = FunctionScore.of(fs -> fs.weight(elasticFunction.getWeight()));

    functions.add(functionScore);
    return this;
  }

  @Override
  public OMFunctionScoreQueryBuilder functions(List<OMFilterFunctionBuilder> functions) {
    // Implementation would convert OMFilterFunctionBuilder to FunctionScore
    return this;
  }

  @Override
  public OMFunctionScoreQueryBuilder scoreMode(String scoreMode) {
    // Convert string to FunctionScoreMode enum
    return this;
  }

  @Override
  public OMFunctionScoreQueryBuilder boostMode(String boostMode) {
    // Convert string to FunctionBoostMode enum
    return this;
  }

  @Override
  public OMFunctionScoreQueryBuilder maxBoost(float maxBoost) {
    functionScoreBuilder.maxBoost((double) maxBoost);
    return this;
  }

  @Override
  public OMFunctionScoreQueryBuilder minScore(float minScore) {
    functionScoreBuilder.minScore((double) minScore);
    return this;
  }

  @Override
  public OMQueryBuilder build() {
    if (!functions.isEmpty()) {
      functionScoreBuilder.functions(functions);
    }
    Query query = functionScoreBuilder.build()._toQuery();
    return new ElasticQueryBuilder(query);
  }

  @Override
  public OMScoreFunction fieldValueFactor(String field) {
    return new ElasticScoreFunction().fieldValueFactor(field);
  }

  @Override
  public OMScoreFunction scriptScore(String script, Map<String, Object> params) {
    return new ElasticScoreFunction().scriptScore(script, params);
  }

  @Override
  public OMScoreFunction randomScore(int seed) {
    return new ElasticScoreFunction().randomScore(seed);
  }

  @Override
  public OMScoreFunction linearDecay(String field, Object origin, Object scale) {
    return new ElasticScoreFunction().linearDecay(field, origin, scale);
  }

  @Override
  public OMScoreFunction exponentialDecay(String field, Object origin, Object scale) {
    return new ElasticScoreFunction().exponentialDecay(field, origin, scale);
  }

  @Override
  public OMScoreFunction gaussianDecay(String field, Object origin, Object scale) {
    return new ElasticScoreFunction().gaussianDecay(field, origin, scale);
  }

  public static class ElasticScoreFunction implements OMScoreFunction {
    private float weight = 1.0f;

    @Override
    public OMScoreFunction weight(float weight) {
      this.weight = weight;
      return this;
    }

    public float getWeight() {
      return weight;
    }

    public ElasticScoreFunction fieldValueFactor(String field) {
      // Implementation would create field value factor function
      return this;
    }

    public ElasticScoreFunction scriptScore(String script, Map<String, Object> params) {
      // Implementation would create script score function
      return this;
    }

    public ElasticScoreFunction randomScore(int seed) {
      // Implementation would create random score function
      return this;
    }

    public ElasticScoreFunction linearDecay(String field, Object origin, Object scale) {
      // Implementation would create linear decay function
      return this;
    }

    public ElasticScoreFunction exponentialDecay(String field, Object origin, Object scale) {
      // Implementation would create exponential decay function
      return this;
    }

    public ElasticScoreFunction gaussianDecay(String field, Object origin, Object scale) {
      // Implementation would create gaussian decay function
      return this;
    }
  }
}

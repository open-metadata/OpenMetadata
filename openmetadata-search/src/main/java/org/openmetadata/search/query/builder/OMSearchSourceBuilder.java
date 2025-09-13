package org.openmetadata.search.query.builder;

import java.util.List;
import java.util.Map;

public interface OMSearchSourceBuilder {

  OMSearchSourceBuilder query(OMQueryBuilder query);

  OMSearchSourceBuilder aggregation(String name, OMAggregationBuilder aggregation);

  OMSearchSourceBuilder highlight(OMHighlightBuilder highlight);

  OMSearchSourceBuilder sort(String field, String order);

  OMSearchSourceBuilder sort(String field);

  OMSearchSourceBuilder from(int from);

  OMSearchSourceBuilder size(int size);

  OMSearchSourceBuilder timeout(String timeout);

  OMSearchSourceBuilder minScore(float minScore);

  OMSearchSourceBuilder trackScores(boolean trackScores);

  OMSearchSourceBuilder trackTotalHits(boolean trackTotalHits);

  OMSearchSourceBuilder source(boolean fetch);

  OMSearchSourceBuilder source(String... includes);

  OMSearchSourceBuilder source(String[] includes, String[] excludes);

  OMSearchSourceBuilder storedField(String field);

  OMSearchSourceBuilder storedFields(List<String> fields);

  OMSearchSourceBuilder docValueField(String field);

  OMSearchSourceBuilder docValueFields(List<String> fields);

  OMSearchSourceBuilder scriptField(String name, String script);

  OMSearchSourceBuilder scriptField(String name, String script, Map<String, Object> params);

  OMSearchSourceBuilder explain(boolean explain);

  OMSearchSourceBuilder version(boolean version);

  OMSearchSourceBuilder seqNoAndPrimaryTerm(boolean seqNoAndPrimaryTerm);

  <T> T build(Class<T> targetType);
}

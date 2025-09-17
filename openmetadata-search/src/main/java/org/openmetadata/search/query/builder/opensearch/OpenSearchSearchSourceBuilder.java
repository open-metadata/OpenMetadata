package org.openmetadata.search.query.builder.opensearch;

import java.util.List;
import java.util.Map;
import org.openmetadata.search.query.builder.OMAggregationBuilder;
import org.openmetadata.search.query.builder.OMHighlightBuilder;
import org.openmetadata.search.query.builder.OMQueryBuilder;
import org.openmetadata.search.query.builder.OMSearchSourceBuilder;

public class OpenSearchSearchSourceBuilder implements OMSearchSourceBuilder {

  @Override
  public OMSearchSourceBuilder query(OMQueryBuilder query) {
    return this;
  }

  @Override
  public OMSearchSourceBuilder aggregation(String name, OMAggregationBuilder aggregation) {
    return this;
  }

  @Override
  public OMSearchSourceBuilder highlight(OMHighlightBuilder highlight) {
    return this;
  }

  @Override
  public OMSearchSourceBuilder sort(String field, String order) {
    return this;
  }

  @Override
  public OMSearchSourceBuilder sort(String field) {
    return this;
  }

  @Override
  public OMSearchSourceBuilder from(int from) {
    return this;
  }

  @Override
  public OMSearchSourceBuilder size(int size) {
    return this;
  }

  @Override
  public OMSearchSourceBuilder timeout(String timeout) {
    return this;
  }

  @Override
  public OMSearchSourceBuilder minScore(float minScore) {
    return this;
  }

  @Override
  public OMSearchSourceBuilder trackScores(boolean trackScores) {
    return this;
  }

  @Override
  public OMSearchSourceBuilder trackTotalHits(boolean trackTotalHits) {
    return this;
  }

  @Override
  public OMSearchSourceBuilder source(boolean fetch) {
    return this;
  }

  @Override
  public OMSearchSourceBuilder source(String... includes) {
    return this;
  }

  @Override
  public OMSearchSourceBuilder source(String[] includes, String[] excludes) {
    return this;
  }

  @Override
  public OMSearchSourceBuilder storedField(String field) {
    return this;
  }

  @Override
  public OMSearchSourceBuilder storedFields(List<String> fields) {
    return this;
  }

  @Override
  public OMSearchSourceBuilder docValueField(String field) {
    return this;
  }

  @Override
  public OMSearchSourceBuilder docValueFields(List<String> fields) {
    return this;
  }

  @Override
  public OMSearchSourceBuilder scriptField(String name, String script) {
    return this;
  }

  @Override
  public OMSearchSourceBuilder scriptField(String name, String script, Map<String, Object> params) {
    return this;
  }

  @Override
  public OMSearchSourceBuilder explain(boolean explain) {
    return this;
  }

  @Override
  public OMSearchSourceBuilder version(boolean version) {
    return this;
  }

  @Override
  public OMSearchSourceBuilder seqNoAndPrimaryTerm(boolean seqNoAndPrimaryTerm) {
    return this;
  }

  @Override
  @SuppressWarnings("unchecked")
  public <T> T build(Class<T> targetType) {
    // Stub implementation
    return null;
  }
}

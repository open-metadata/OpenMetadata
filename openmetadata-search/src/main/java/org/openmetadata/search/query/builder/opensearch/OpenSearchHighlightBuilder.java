package org.openmetadata.search.query.builder.opensearch;

import java.util.List;
import org.openmetadata.search.query.builder.OMHighlightBuilder;

public class OpenSearchHighlightBuilder implements OMHighlightBuilder {

  @Override
  public OMHighlightBuilder field(String field) {
    return this;
  }

  @Override
  public OMHighlightBuilder field(String field, int fragmentSize) {
    return this;
  }

  @Override
  public OMHighlightBuilder field(String field, int fragmentSize, int numberOfFragments) {
    return this;
  }

  @Override
  public OMHighlightBuilder fields(List<String> fields) {
    return this;
  }

  @Override
  public OMHighlightBuilder preTags(String... preTags) {
    return this;
  }

  @Override
  public OMHighlightBuilder postTags(String... postTags) {
    return this;
  }

  @Override
  public OMHighlightBuilder fragmentSize(int fragmentSize) {
    return this;
  }

  @Override
  public OMHighlightBuilder numberOfFragments(int numberOfFragments) {
    return this;
  }

  @Override
  public OMHighlightBuilder noMatchSize(int noMatchSize) {
    return this;
  }

  @Override
  public OMHighlightBuilder highlighterType(String type) {
    return this;
  }

  @Override
  public OMHighlightBuilder fragmenter(String fragmenter) {
    return this;
  }

  @Override
  public OMHighlightBuilder order(String order) {
    return this;
  }

  @Override
  public OMHighlightBuilder requireFieldMatch(boolean requireFieldMatch) {
    return this;
  }

  @Override
  public OMHighlightBuilder boundaryScannerType(String type) {
    return this;
  }

  @Override
  public OMHighlightBuilder boundaryMaxScan(int boundaryMaxScan) {
    return this;
  }

  @Override
  public OMHighlightBuilder boundaryChars(String boundaryChars) {
    return this;
  }

  @Override
  public OMHighlightBuilder phraseLimit(int phraseLimit) {
    return this;
  }

  @Override
  @SuppressWarnings("unchecked")
  public <T> T build(Class<T> targetType) {
    // Stub implementation
    return null;
  }
}

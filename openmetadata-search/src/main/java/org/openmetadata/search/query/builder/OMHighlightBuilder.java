package org.openmetadata.search.query.builder;

import java.util.List;

public interface OMHighlightBuilder {

  OMHighlightBuilder field(String field);

  OMHighlightBuilder field(String field, int fragmentSize);

  OMHighlightBuilder field(String field, int fragmentSize, int numberOfFragments);

  OMHighlightBuilder fields(List<String> fields);

  OMHighlightBuilder preTags(String... preTags);

  OMHighlightBuilder postTags(String... postTags);

  OMHighlightBuilder fragmentSize(int fragmentSize);

  OMHighlightBuilder numberOfFragments(int numberOfFragments);

  OMHighlightBuilder noMatchSize(int noMatchSize);

  OMHighlightBuilder highlighterType(String type);

  OMHighlightBuilder fragmenter(String fragmenter);

  OMHighlightBuilder order(String order);

  OMHighlightBuilder requireFieldMatch(boolean requireFieldMatch);

  OMHighlightBuilder boundaryScannerType(String type);

  OMHighlightBuilder boundaryMaxScan(int boundaryMaxScan);

  OMHighlightBuilder boundaryChars(String boundaryChars);

  OMHighlightBuilder phraseLimit(int phraseLimit);

  <T> T build(Class<T> targetType);
}

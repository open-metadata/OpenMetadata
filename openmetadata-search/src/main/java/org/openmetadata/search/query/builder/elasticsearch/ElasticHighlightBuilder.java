package org.openmetadata.search.query.builder.elasticsearch;

import es.co.elastic.clients.elasticsearch.core.search.Highlight;
import es.co.elastic.clients.elasticsearch.core.search.HighlightField;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.openmetadata.search.query.builder.OMHighlightBuilder;

public class ElasticHighlightBuilder implements OMHighlightBuilder {
  private final Highlight.Builder highlightBuilder;
  private final Map<String, HighlightField> fields = new HashMap<>();

  public ElasticHighlightBuilder() {
    this.highlightBuilder = new Highlight.Builder();
  }

  @Override
  public OMHighlightBuilder field(String field) {
    fields.put(field, HighlightField.of(hf -> hf));
    return this;
  }

  @Override
  public OMHighlightBuilder field(String field, int fragmentSize) {
    fields.put(field, HighlightField.of(hf -> hf.fragmentSize(fragmentSize)));
    return this;
  }

  @Override
  public OMHighlightBuilder field(String field, int fragmentSize, int numberOfFragments) {
    fields.put(
        field,
        HighlightField.of(
            hf -> hf.fragmentSize(fragmentSize).numberOfFragments(numberOfFragments)));
    return this;
  }

  @Override
  public OMHighlightBuilder fields(List<String> fields) {
    for (String field : fields) {
      field(field);
    }
    return this;
  }

  @Override
  public OMHighlightBuilder preTags(String... preTags) {
    highlightBuilder.preTags(List.of(preTags));
    return this;
  }

  @Override
  public OMHighlightBuilder postTags(String... postTags) {
    highlightBuilder.postTags(List.of(postTags));
    return this;
  }

  @Override
  public OMHighlightBuilder fragmentSize(int fragmentSize) {
    highlightBuilder.fragmentSize(fragmentSize);
    return this;
  }

  @Override
  public OMHighlightBuilder numberOfFragments(int numberOfFragments) {
    highlightBuilder.numberOfFragments(numberOfFragments);
    return this;
  }

  @Override
  public OMHighlightBuilder noMatchSize(int noMatchSize) {
    highlightBuilder.noMatchSize(noMatchSize);
    return this;
  }

  @Override
  public OMHighlightBuilder highlighterType(String type) {
    // Implementation would set highlighter type
    return this;
  }

  @Override
  public OMHighlightBuilder fragmenter(String fragmenter) {
    // Implementation would set fragmenter
    return this;
  }

  @Override
  public OMHighlightBuilder order(String order) {
    // Implementation would set order
    return this;
  }

  @Override
  public OMHighlightBuilder requireFieldMatch(boolean requireFieldMatch) {
    highlightBuilder.requireFieldMatch(requireFieldMatch);
    return this;
  }

  @Override
  public OMHighlightBuilder boundaryScannerType(String type) {
    // Implementation would set boundary scanner type
    return this;
  }

  @Override
  public OMHighlightBuilder boundaryMaxScan(int boundaryMaxScan) {
    // Implementation would set boundary max scan
    return this;
  }

  @Override
  public OMHighlightBuilder boundaryChars(String boundaryChars) {
    // Implementation would set boundary chars
    return this;
  }

  @Override
  public OMHighlightBuilder phraseLimit(int phraseLimit) {
    // Implementation would set phrase limit
    return this;
  }

  @Override
  @SuppressWarnings("unchecked")
  public <T> T build(Class<T> targetType) {
    if (targetType.isAssignableFrom(Highlight.class)) {
      if (!fields.isEmpty()) {
        highlightBuilder.fields(fields);
      }
      return (T) highlightBuilder.build();
    }
    throw new IllegalArgumentException("Unsupported target type: " + targetType);
  }
}

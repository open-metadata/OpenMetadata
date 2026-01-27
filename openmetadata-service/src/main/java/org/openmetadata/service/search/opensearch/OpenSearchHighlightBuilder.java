package org.openmetadata.service.search.opensearch;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import os.org.opensearch.client.opensearch.core.search.Highlight;
import os.org.opensearch.client.opensearch.core.search.HighlightField;

public class OpenSearchHighlightBuilder {
  private final Map<String, HighlightField> fields = new HashMap<>();
  private String preTag;
  private String postTag;

  public OpenSearchHighlightBuilder() {}

  public OpenSearchHighlightBuilder field(String name) {
    this.fields.put(name, HighlightField.of(h -> h));
    return this;
  }

  public OpenSearchHighlightBuilder field(String name, int fragmentSize) {
    this.fields.put(name, HighlightField.of(h -> h.fragmentSize(fragmentSize)));
    return this;
  }

  public OpenSearchHighlightBuilder fields(List<String> fieldNames) {
    for (String fieldName : fieldNames) {
      this.fields.put(fieldName, HighlightField.of(h -> h));
    }
    return this;
  }

  public OpenSearchHighlightBuilder preTags(String preTag) {
    this.preTag = preTag;
    return this;
  }

  public OpenSearchHighlightBuilder postTags(String postTag) {
    this.postTag = postTag;
    return this;
  }

  public Highlight build() {
    return Highlight.of(
        h -> {
          h.fields(fields);
          if (preTag != null) {
            h.preTags(preTag);
          }
          if (postTag != null) {
            h.postTags(postTag);
          }
          return h;
        });
  }
}

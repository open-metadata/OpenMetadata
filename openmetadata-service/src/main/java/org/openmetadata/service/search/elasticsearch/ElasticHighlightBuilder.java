package org.openmetadata.service.search.elasticsearch;

import es.co.elastic.clients.elasticsearch.core.search.Highlight;
import es.co.elastic.clients.elasticsearch.core.search.HighlightField;
import es.co.elastic.clients.util.NamedValue;
import java.util.ArrayList;
import java.util.List;

public class ElasticHighlightBuilder {
  private final List<NamedValue<HighlightField>> fields = new ArrayList<>();
  private String preTag;
  private String postTag;

  public ElasticHighlightBuilder() {}

  public ElasticHighlightBuilder field(String name) {
    this.fields.add(NamedValue.of(name, HighlightField.of(h -> h)));
    return this;
  }

  public ElasticHighlightBuilder field(String name, int fragmentSize) {
    this.fields.add(NamedValue.of(name, HighlightField.of(h -> h.fragmentSize(fragmentSize))));
    return this;
  }

  public ElasticHighlightBuilder fields(List<String> fieldNames) {
    for (String fieldName : fieldNames) {
      this.fields.add(NamedValue.of(fieldName, HighlightField.of(h -> h)));
    }
    return this;
  }

  public ElasticHighlightBuilder preTags(String preTag) {
    this.preTag = preTag;
    return this;
  }

  public ElasticHighlightBuilder postTags(String postTag) {
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

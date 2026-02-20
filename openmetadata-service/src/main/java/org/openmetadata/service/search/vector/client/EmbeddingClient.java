package org.openmetadata.service.search.vector.client;

import java.util.ArrayList;
import java.util.List;

public interface EmbeddingClient {
  float[] embed(String text);

  default List<float[]> embedBatch(List<String> texts) {
    List<float[]> results = new ArrayList<>();
    for (String text : texts) {
      results.add(embed(text));
    }
    return results;
  }

  int getDimension();

  String getModelId();
}

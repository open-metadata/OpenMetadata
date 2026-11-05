package org.openmetadata.service.search.vector;

import java.util.Set;

/** Keeps the package-private native builders accessible to real-engine integration tests. */
public final class MemoryVectorQueryTestSupport {
  private MemoryVectorQueryTestSupport() {}

  public static String build(
      float[] vector,
      VectorSearchParameters parameters,
      boolean openSearch,
      Set<String> readableAnchors) {
    return openSearch
        ? VectorSearchQueryBuilder.build(vector, parameters, readableAnchors)
        : VectorSearchQueryBuilder.buildNativeESQuery(
            vector,
            parameters,
            VectorSearchQueryBuilder.DEFAULT_KNN_NUM_CANDIDATES_MULTIPLIER,
            readableAnchors);
  }
}

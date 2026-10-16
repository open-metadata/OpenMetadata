package org.openmetadata.service.search.vector;

import java.util.Set;
import org.openmetadata.service.search.opensearch.queries.OpenSearchQueryBuilderFactory;
import org.openmetadata.service.search.security.ContextMemoryAnchorPins;
import org.openmetadata.service.search.security.ContextMemorySearchVisibility;

/** Resolves memory anchor access at the service boundary, before a vector query is rendered or paged. */
public final class VectorSearchMemoryAccess {
  private static final ContextMemorySearchVisibility MEMORY_VISIBILITY =
      new ContextMemorySearchVisibility(new OpenSearchQueryBuilderFactory());

  private VectorSearchMemoryAccess() {}

  public static Set<String> readableAnchorIds(VectorSearchParameters parameters) {
    return MEMORY_VISIBILITY.readableAnchorIds(
        parameters.subjectContext(),
        ContextMemoryAnchorPins.of(parameters.filters(), parameters.queryFilter()));
  }
}

package org.openmetadata.service.search.nlq;

import java.io.IOException;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.api.search.NLQConfiguration;
import org.openmetadata.schema.search.SearchRequest;

/**
 * A no-operation implementation of NLQService that returns null/empty responses.
 * This serves as a fallback when no active NLQ provider is configured.
 */
@Slf4j
public class NoOpNLQService implements NLQService {

  public NoOpNLQService(NLQConfiguration config) {
    LOG.info("Initializing NoOp NLQ Service");
  }

  public NoOpNLQService() {
    LOG.info("Initializing NoOp NLQ Service");
  }

  @Override
  public String transformNaturalLanguageQuery(SearchRequest request, String additionalContext) {
    return null;
  }

  @Override
  public void cacheQuery(String query, String transformedQuery) {}
}

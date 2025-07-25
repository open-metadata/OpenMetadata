package org.openmetadata.service.search;

import org.openmetadata.schema.service.configuration.elasticsearch.ElasticSearchConfiguration;

/**
 * Implementation of SearchRepositoryProvider.
 * This is the default provider that creates standard OpenMetadata SearchRepository instances.
 */
public class DefaultSearchRepositoryProvider implements SearchRepositoryProvider {

  @Override
  public SearchRepository createSearchRepository(
      ElasticSearchConfiguration elasticSearchConfiguration, int maxSize) {
    return new SearchRepository(elasticSearchConfiguration, maxSize);
  }

  @Override
  public int getPriority() {
    return 0;
  }

  @Override
  public boolean isAvailable() {
    return true;
  }
}

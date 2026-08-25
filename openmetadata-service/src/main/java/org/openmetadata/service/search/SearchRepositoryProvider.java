package org.openmetadata.service.search;

import org.openmetadata.schema.service.configuration.elasticsearch.ElasticSearchConfiguration;

/**
 * Service Provider Interface for creating SearchRepository instances.
 */
public interface SearchRepositoryProvider {

  /**
   * Creates a SearchRepository instance.
   *
   * @param elasticSearchConfiguration The Elasticsearch configuration
   * @param maxSize The maximum size parameter
   * @return SearchRepository instance
   */
  SearchRepository createSearchRepository(
      ElasticSearchConfiguration elasticSearchConfiguration, int maxSize);

  /**
   * Returns the priority of this provider.
   * Higher priority providers will be selected first.
   * OSS should return 0, Paid versions should return higher values.
   *
   * @return priority value
   */
  int getPriority();

  /**
   * Returns true if this provider is available/applicable.
   * This allows providers to check for required dependencies, licenses, etc.
   *
   * @return true if this provider can be used
   */
  boolean isAvailable();
}

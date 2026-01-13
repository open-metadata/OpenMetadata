package org.openmetadata.service.search;

import java.util.List;
import java.util.ServiceLoader;
import java.util.stream.StreamSupport;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.service.configuration.elasticsearch.ElasticSearchConfiguration;

/**
 * Factory for creating SearchRepository instances using Service Provider Interface (SPI).
 * This allows different implementations to be plugged in at runtime
 * without hardcoded class names or reflection.
 */
@Slf4j
public class SearchRepositoryFactory {

  /**
   * Creates a SearchRepository instance using the highest priority available provider.
   *
   * @param elasticSearchConfiguration The Elasticsearch configuration
   * @param maxSize The maximum size parameter
   * @return SearchRepository instance from the best available provider
   */
  public static SearchRepository createSearchRepository(
      ElasticSearchConfiguration elasticSearchConfiguration, int maxSize) {

    SearchRepositoryProvider provider = findBestProvider();

    LOG.info(
        "Using SearchRepository provider: {} (priority: {})",
        provider.getClass().getSimpleName(),
        provider.getPriority());

    return provider.createSearchRepository(elasticSearchConfiguration, maxSize);
  }

  /**
   * Finds the best available SearchRepositoryProvider using SPI.
   * Returns the provider with the highest priority that is available.
   */
  private static SearchRepositoryProvider findBestProvider() {
    ServiceLoader<SearchRepositoryProvider> loader =
        ServiceLoader.load(SearchRepositoryProvider.class);

    List<SearchRepositoryProvider> availableProviders =
        StreamSupport.stream(loader.spliterator(), false)
            .filter(SearchRepositoryProvider::isAvailable)
            .sorted((p1, p2) -> Integer.compare(p2.getPriority(), p1.getPriority()))
            .toList();

    if (availableProviders.isEmpty()) {
      LOG.warn(
          "No SearchRepositoryProvider found via SPI, falling back to default OSS implementation");
      return new DefaultSearchRepositoryProvider();
    }

    SearchRepositoryProvider bestProvider = availableProviders.getFirst();

    if (availableProviders.size() > 1) {
      LOG.info(
          "Multiple SearchRepository providers available, selected: {} with priority: {}",
          bestProvider.getClass().getSimpleName(),
          bestProvider.getPriority());
    }

    return bestProvider;
  }

  /**
   * Gets all available SearchRepository providers for debugging/inspection.
   *
   * @return List of all available providers
   */
  public static List<SearchRepositoryProvider> getAvailableProviders() {
    ServiceLoader<SearchRepositoryProvider> loader =
        ServiceLoader.load(SearchRepositoryProvider.class);

    return StreamSupport.stream(loader.spliterator(), false)
        .filter(SearchRepositoryProvider::isAvailable)
        .sorted((p1, p2) -> Integer.compare(p2.getPriority(), p1.getPriority()))
        .toList();
  }
}

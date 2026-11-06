package org.openmetadata.service.search.nlq;

import static org.junit.jupiter.api.Assertions.assertInstanceOf;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.service.configuration.elasticsearch.ElasticSearchConfiguration;
import org.openmetadata.schema.service.configuration.elasticsearch.NaturalLanguageSearchConfiguration;

/**
 * OpenMetadata ships no NLQ provider, so the factory must yield the no-op service for every
 * configuration this distribution can produce, including the ones it no longer writes out.
 */
class NLQServiceFactoryTest {

  private static final String MISSING_PROVIDER_CLASS = "com.example.search.nlq.ExternalNLQService";

  @Test
  @DisplayName("A null search configuration yields the no-op service instead of throwing")
  void nullConfigurationYieldsNoOp() {
    assertInstanceOf(NoOpNLQService.class, NLQServiceFactory.createNLQService(null));
  }

  @Test
  @DisplayName(
      "An absent naturalLanguageSearch section yields the no-op service instead of throwing")
  void absentSectionYieldsNoOp() {
    assertInstanceOf(
        NoOpNLQService.class, NLQServiceFactory.createNLQService(new ElasticSearchConfiguration()));
  }

  @Test
  @DisplayName("Semantic search alone does not select an NLQ provider")
  void semanticSearchOnlyYieldsNoOp() {
    ElasticSearchConfiguration config =
        configWith(new NaturalLanguageSearchConfiguration().withSemanticSearchEnabled(true));

    assertInstanceOf(NoOpNLQService.class, NLQServiceFactory.createNLQService(config));
  }

  @Test
  @DisplayName("A disabled configuration yields the no-op service even with a provider class set")
  void disabledConfigurationYieldsNoOp() {
    ElasticSearchConfiguration config =
        configWith(
            new NaturalLanguageSearchConfiguration()
                .withEnabled(false)
                .withProviderClass(MISSING_PROVIDER_CLASS));

    assertInstanceOf(NoOpNLQService.class, NLQServiceFactory.createNLQService(config));
  }

  @Test
  @DisplayName("A blank provider class yields the no-op service")
  void blankProviderClassYieldsNoOp() {
    assertInstanceOf(
        NoOpNLQService.class, NLQServiceFactory.createNLQService(enabledWithProvider("")));
  }

  @Test
  @DisplayName("A provider class that cannot be loaded falls back to the no-op service")
  void unloadableProviderFallsBackToNoOp() {
    assertInstanceOf(
        NoOpNLQService.class,
        NLQServiceFactory.createNLQService(enabledWithProvider(MISSING_PROVIDER_CLASS)));
  }

  private static ElasticSearchConfiguration enabledWithProvider(String providerClass) {
    return configWith(
        new NaturalLanguageSearchConfiguration()
            .withEnabled(true)
            .withProviderClass(providerClass));
  }

  private static ElasticSearchConfiguration configWith(
      NaturalLanguageSearchConfiguration nlqConfig) {
    return new ElasticSearchConfiguration().withNaturalLanguageSearch(nlqConfig);
  }
}

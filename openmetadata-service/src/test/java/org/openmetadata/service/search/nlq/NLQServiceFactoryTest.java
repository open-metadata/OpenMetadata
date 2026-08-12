package org.openmetadata.service.search.nlq;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertInstanceOf;
import static org.junit.jupiter.api.Assertions.assertTrue;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.service.configuration.elasticsearch.ElasticSearchConfiguration;
import org.openmetadata.schema.service.configuration.elasticsearch.NaturalLanguageSearchConfiguration;

/**
 * Natural language search is an extension point with no OpenMetadata provider, so the factory must
 * report it unavailable for every configuration this distribution can produce.
 */
class NLQServiceFactoryTest {

  private static final String REAL_PROVIDER_CLASS = "com.example.search.nlq.ExternalNLQService";

  @Test
  @DisplayName("A null search configuration reports no provider instead of throwing")
  void nullConfigurationHasNoProvider() {
    assertFalse(NLQServiceFactory.hasConfiguredProvider(null));
    assertInstanceOf(NoOpNLQService.class, NLQServiceFactory.createNLQService(null));
  }

  @Test
  @DisplayName("An absent naturalLanguageSearch section reports no provider")
  void absentSectionHasNoProvider() {
    ElasticSearchConfiguration config = new ElasticSearchConfiguration();

    assertFalse(NLQServiceFactory.hasConfiguredProvider(config));
    assertInstanceOf(NoOpNLQService.class, NLQServiceFactory.createNLQService(config));
  }

  @Test
  @DisplayName("Semantic search alone does not enable natural language search")
  void semanticSearchOnlyHasNoProvider() {
    ElasticSearchConfiguration config = configWith(new NaturalLanguageSearchConfiguration());
    config.getNaturalLanguageSearch().setSemanticSearchEnabled(true);

    assertFalse(NLQServiceFactory.hasConfiguredProvider(config));
  }

  @Test
  @DisplayName(
      "Enabling the flag without a provider does not make natural language search available")
  void enabledWithNoOpProviderHasNoProvider() {
    ElasticSearchConfiguration config =
        configWith(enabledWithProvider(NoOpNLQService.class.getName()));

    assertFalse(NLQServiceFactory.hasConfiguredProvider(config));
    assertInstanceOf(NoOpNLQService.class, NLQServiceFactory.createNLQService(config));
  }

  @Test
  @DisplayName(
      "Enabling the flag with a blank provider does not make natural language search available")
  void enabledWithBlankProviderHasNoProvider() {
    ElasticSearchConfiguration config = configWith(enabledWithProvider(""));

    assertFalse(NLQServiceFactory.hasConfiguredProvider(config));
  }

  @Test
  @DisplayName("A registered external provider is reported as available")
  void enabledWithExternalProviderHasProvider() {
    ElasticSearchConfiguration config = configWith(enabledWithProvider(REAL_PROVIDER_CLASS));

    assertTrue(NLQServiceFactory.hasConfiguredProvider(config));
  }

  @Test
  @DisplayName("A provider that cannot be loaded falls back to the no-op service")
  void unloadableProviderFallsBackToNoOp() {
    ElasticSearchConfiguration config = configWith(enabledWithProvider(REAL_PROVIDER_CLASS));

    assertInstanceOf(NoOpNLQService.class, NLQServiceFactory.createNLQService(config));
  }

  @Test
  @DisplayName("A disabled provider is not used even when a provider class is set")
  void disabledWithExternalProviderHasNoProvider() {
    NaturalLanguageSearchConfiguration nlqConfig = enabledWithProvider(REAL_PROVIDER_CLASS);
    nlqConfig.setEnabled(false);

    assertFalse(NLQServiceFactory.hasConfiguredProvider(configWith(nlqConfig)));
  }

  private static NaturalLanguageSearchConfiguration enabledWithProvider(String providerClass) {
    return new NaturalLanguageSearchConfiguration()
        .withEnabled(true)
        .withProviderClass(providerClass);
  }

  private static ElasticSearchConfiguration configWith(
      NaturalLanguageSearchConfiguration nlqConfig) {
    return new ElasticSearchConfiguration().withNaturalLanguageSearch(nlqConfig);
  }
}

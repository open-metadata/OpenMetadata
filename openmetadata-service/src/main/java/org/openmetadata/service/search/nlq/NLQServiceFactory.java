package org.openmetadata.service.search.nlq;

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;

import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.service.configuration.elasticsearch.ElasticSearchConfiguration;
import org.openmetadata.schema.service.configuration.elasticsearch.NaturalLanguageSearchConfiguration;
import org.openmetadata.service.util.ReflectionUtil;

/**
 * Factory for creating NLQService instances based on configuration.
 *
 * <p>This is an extension point: OpenMetadata ships {@link NoOpNLQService} as the only
 * implementation, so natural language search stays unavailable unless a distribution registers its
 * own provider class.
 */
@Slf4j
public class NLQServiceFactory {

  private static final String NO_OP_PROVIDER_CLASS = NoOpNLQService.class.getName();

  private NLQServiceFactory() {}

  /**
   * Whether an NLQ provider other than {@link NoOpNLQService} is enabled. Callers use this to decide
   * whether natural language search can actually serve a query, rather than trusting the {@code
   * enabled} flag on its own.
   */
  public static boolean hasConfiguredProvider(ElasticSearchConfiguration config) {
    NaturalLanguageSearchConfiguration nlqConfig =
        config != null ? config.getNaturalLanguageSearch() : null;
    boolean enabled = nlqConfig != null && Boolean.TRUE.equals(nlqConfig.getEnabled());
    String providerClass = enabled ? nlqConfig.getProviderClass() : null;
    return !nullOrEmpty(providerClass) && !NO_OP_PROVIDER_CLASS.equals(providerClass);
  }

  public static NLQService createNLQService(ElasticSearchConfiguration config) {
    NLQService service = new NoOpNLQService();
    if (hasConfiguredProvider(config)) {
      service = instantiateProvider(config.getNaturalLanguageSearch().getProviderClass(), config);
    } else {
      LOG.info("No natural language search provider configured. Returning NoOpNLQService.");
    }
    return service;
  }

  private static NLQService instantiateProvider(
      String providerClass, ElasticSearchConfiguration config) {
    NLQService service = new NoOpNLQService();
    try {
      LOG.info("Initializing NLQ service with class: {}", providerClass);
      Class<?> clazz = ReflectionUtil.createClass(providerClass);
      if (NLQService.class.isAssignableFrom(clazz)) {
        service =
            (NLQService)
                clazz.getDeclaredConstructor(ElasticSearchConfiguration.class).newInstance(config);
      } else {
        LOG.error("Specified class {} does not implement NLQService interface", providerClass);
      }
    } catch (ReflectiveOperationException | RuntimeException e) {
      LOG.error(
          "Failed to initialize NLQ service with class {}: {}", providerClass, e.getMessage(), e);
    }
    return service;
  }
}

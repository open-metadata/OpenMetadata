package org.openmetadata.service.search.nlq;

import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.service.configuration.elasticsearch.ElasticSearchConfiguration;
import org.openmetadata.service.util.ReflectionUtil;

/**
 * Factory for creating NLQService instances based on configuration.
 */
@Slf4j
public class NLQServiceFactory {

  private NLQServiceFactory() {}

  public static NLQService createNLQService(ElasticSearchConfiguration config) {
    if (config == null || !config.getNaturalLanguageSearch().getEnabled()) {
      LOG.info("Natural language search is disabled. Returning NoOpNLQService.");
      return new NoOpNLQService();
    }

    String serviceClass = config.getNaturalLanguageSearch().getProviderClass();
    if (serviceClass == null || serviceClass.isEmpty()) {
      LOG.warn("No provider class specified for NLQ service. Defaulting to NoOpNLQService.");
      return new NoOpNLQService();
    }

    try {
      LOG.info("Initializing NLQ service with class: {}", serviceClass);
      Class<?> clazz = ReflectionUtil.createClass(serviceClass);

      if (!NLQService.class.isAssignableFrom(clazz)) {
        LOG.error("Specified class {} does not implement NLQService interface", serviceClass);
        return new NoOpNLQService();
      }

      return (NLQService)
          clazz.getDeclaredConstructor(ElasticSearchConfiguration.class).newInstance(config);
    } catch (Exception e) {
      LOG.error(
          "Failed to initialize NLQ service with class {}: {}", serviceClass, e.getMessage(), e);
      return new NoOpNLQService();
    }
  }
}

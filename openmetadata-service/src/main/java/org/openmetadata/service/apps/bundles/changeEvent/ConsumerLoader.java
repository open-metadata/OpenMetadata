package org.openmetadata.service.apps.bundles.changeEvent;

import java.util.Optional;
import org.openmetadata.schema.entity.events.EventSubscription;
import org.openmetadata.service.util.DIContainer;

/** Finds the consumer an alert's className names, whatever job class Quartz happened to load. */
final class ConsumerLoader {

  private ConsumerLoader() {}

  static AbstractEventConsumer named(EventSubscription alert, AbstractEventConsumer loaded) {
    String wanted =
        Optional.ofNullable(alert.getClassName()).orElse(AlertPublisher.class.getCanonicalName());
    return wanted.equals(loaded.getClass().getCanonicalName())
        ? loaded
        : instantiate(wanted, loaded.dependencies);
  }

  private static AbstractEventConsumer instantiate(String className, DIContainer dependencies) {
    try {
      return Class.forName(className)
          .asSubclass(AbstractEventConsumer.class)
          .getDeclaredConstructor(DIContainer.class)
          .newInstance(dependencies);
    } catch (ReflectiveOperationException e) {
      throw new IllegalStateException("Cannot run the consumer " + className, e);
    }
  }
}

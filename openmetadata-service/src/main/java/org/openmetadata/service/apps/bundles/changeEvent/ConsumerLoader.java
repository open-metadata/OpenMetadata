package org.openmetadata.service.apps.bundles.changeEvent;

import java.util.Optional;
import org.openmetadata.schema.entity.events.EventSubscription;
import org.openmetadata.service.util.DIContainer;

/** Finds the consumer an alert's className names, whatever job class Quartz happened to load. */
final class ConsumerLoader {

  private ConsumerLoader() {}

  static AbstractEventConsumer named(EventSubscription alert, AbstractEventConsumer loaded) {
    String wanted = nameOf(alert);
    return wanted.equals(loaded.getClass().getCanonicalName())
        ? loaded
        : instantiate(wanted, loaded.dependencies);
  }

  /** The consumer class an alert names, loaded but not initialised, or empty when it cannot be. */
  static Optional<Class<? extends AbstractEventConsumer>> classOf(EventSubscription alert) {
    Optional<Class<? extends AbstractEventConsumer>> consumer = Optional.empty();
    try {
      consumer =
          Optional.of(
              Class.forName(nameOf(alert), false, ConsumerLoader.class.getClassLoader())
                  .asSubclass(AbstractEventConsumer.class));
    } catch (ClassNotFoundException | ClassCastException | LinkageError e) {
      // An alert naming a class this server does not have keeps the kind it always had.
    }
    return consumer;
  }

  private static String nameOf(EventSubscription alert) {
    return Optional.ofNullable(alert.getClassName())
        .orElse(AlertPublisher.class.getCanonicalName());
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

package org.openmetadata.service.events.consumer;

import java.util.Optional;
import org.openmetadata.schema.entity.events.EventSubscription;
import org.openmetadata.service.util.DIContainer;

/** The consumer an alert names, found by its id or alias among the registered ones. */
final class ConsumerLoader {

  private ConsumerLoader() {}

  /**
   * A consumer for the alert's tick. One naming a consumer nothing answers to fails the tick and
   * keeps its position: it is never run by another consumer instead.
   */
  static AbstractEventConsumer forAlert(EventSubscription alert, DIContainer dependencies) {
    String named = nameOf(alert);
    return Consumers.find(named)
        .orElseThrow(() -> new IllegalStateException("No consumer is registered as " + named))
        .create(dependencies);
  }

  /** The kind of consumer an alert names, or empty when nothing answers to its name. */
  static Optional<ConsumerKind> kindOf(EventSubscription alert) {
    return Consumers.find(nameOf(alert)).map(ConsumerProvider::type);
  }

  private static String nameOf(EventSubscription alert) {
    return Optional.ofNullable(alert.getClassName()).orElse(Consumers.DEFAULT);
  }
}

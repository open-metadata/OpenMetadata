package org.openmetadata.service.apps.bundles.changeEvent;

import org.openmetadata.schema.entity.events.EventSubscription;

/** What an alert's consumer does on each tick, which decides what the tick gives it. */
public enum ConsumerKind {
  /** Reads a batch, matches each event and delivers each match to the alert's destinations. */
  EVENT,
  /** Reads a batch and handles the whole batch itself. */
  BATCH,
  /** Reads no change events and produces its own work for the window since its previous run. */
  SELF_DRIVEN;

  /** Whether a consumer of this kind reads change events, so its position and rows describe it. */
  public boolean readsChangeEvents() {
    return this != SELF_DRIVEN;
  }

  /**
   * The kind a consumer class declares by implementing {@link BatchConsumer} or {@link
   * SelfDrivenConsumer}; one that declares neither handles events one by one.
   */
  public static ConsumerKind of(Class<?> consumer) {
    boolean batch = BatchConsumer.class.isAssignableFrom(consumer);
    boolean selfDriven = SelfDrivenConsumer.class.isAssignableFrom(consumer);
    if (batch && selfDriven) {
      throw new IllegalArgumentException(
          "A consumer is one kind, and " + consumer.getName() + " declares two");
    }
    ConsumerKind kind = EVENT;
    if (batch) {
      kind = BATCH;
    }
    if (selfDriven) {
      kind = SELF_DRIVEN;
    }
    return kind;
  }

  /**
   * The kind of the consumer an alert names, as its provider declares it, without building it. A
   * name nothing answers to counts as an event consumer, the kind every alert had before there
   * were kinds.
   */
  public static ConsumerKind of(EventSubscription alert) {
    return ConsumerLoader.kindOf(alert).orElse(EVENT);
  }
}

package org.openmetadata.service.apps.bundles.changeEvent;

/** What an alert's consumer does on each tick, which decides what the tick gives it. */
public enum ConsumerKind {
  /** Reads a batch, matches each event and delivers each match to the alert's destinations. */
  EVENT,
  /** Reads a batch and handles the whole batch itself. */
  BATCH,
  /** Reads no change events and produces its own work for the window since its previous run. */
  SELF_DRIVEN
}

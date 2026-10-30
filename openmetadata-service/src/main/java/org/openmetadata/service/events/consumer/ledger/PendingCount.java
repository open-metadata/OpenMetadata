package org.openmetadata.service.events.consumer.ledger;

/**
 * How many unread change events an alert's rules let through. When more events are unread than a
 * request may evaluate, {@code count} covers only the evaluated ones and {@code lowerBound} says so.
 */
public record PendingCount(long count, boolean lowerBound) {

  public static final PendingCount NONE = new PendingCount(0, false);
}

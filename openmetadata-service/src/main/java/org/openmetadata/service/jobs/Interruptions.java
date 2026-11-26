package org.openmetadata.service.jobs;

import org.apache.commons.lang3.exception.ExceptionUtils;
import org.openmetadata.service.events.consumer.ServerStopping;

/**
 * Tells work a server stop cut short from work that failed on its own.
 * ADR:2026-11-09-a-server-stop-leaves-memory-extraction-for-recovery
 */
public final class Interruptions {
  private Interruptions() {}

  /** True while the server stops, or when this thread or the failure's cause was interrupted. */
  public static boolean isStopInterruption(Throwable failure) {
    return ServerStopping.isSet()
        || Thread.currentThread().isInterrupted()
        || ExceptionUtils.indexOfType(failure, InterruptedException.class) >= 0;
  }
}

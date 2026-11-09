package org.openmetadata.service.context.center;

import org.apache.commons.lang3.exception.ExceptionUtils;

/** An extraction interrupted by a server stop is left for recovery, not marked Failed. */
final class Interruptions {
  private Interruptions() {}

  /** True when this thread was interrupted or an {@link InterruptedException} caused the failure. */
  static boolean isInterruption(Throwable failure) {
    return Thread.currentThread().isInterrupted()
        || ExceptionUtils.indexOfType(failure, InterruptedException.class) >= 0;
  }
}

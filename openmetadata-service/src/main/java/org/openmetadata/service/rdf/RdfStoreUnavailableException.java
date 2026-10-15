/*
 *  Copyright 2026 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */
package org.openmetadata.service.rdf;

import org.openmetadata.service.rdf.storage.JenaFusekiStorage;
import org.openmetadata.service.rdf.storage.RdfStorageCircuitOpenException;
import org.openmetadata.service.rdf.storage.RdfWriteOutcomeUnknownException;

/**
 * A live RDF write failed while the store could not be reached. The failure says nothing about the
 * write itself, so it waits for the store without spending one of its delivery attempts, and an
 * outage cannot dead-letter the queue.
 */
public final class RdfStoreUnavailableException extends RuntimeException {
  private static final long serialVersionUID = 1L;

  public RdfStoreUnavailableException(final Throwable cause) {
    super("RDF store could not be reached: " + cause.getMessage(), cause);
  }

  /** Whether {@code failure} is the kind an unreachable store produces. */
  static boolean isAvailabilityFailure(final Throwable failure) {
    return JenaFusekiStorage.isUnavailableFailure(failure)
        || JenaFusekiStorage.isTimeoutFailure(failure)
        || hasCause(failure, RdfStorageCircuitOpenException.class)
        || hasCause(failure, RdfWriteOutcomeUnknownException.class);
  }

  private static boolean hasCause(final Throwable failure, final Class<?> type) {
    boolean found = false;
    for (Throwable cause = failure; cause != null && !found; cause = nextCause(cause)) {
      found = type.isInstance(cause);
    }
    return found;
  }

  private static Throwable nextCause(final Throwable failure) {
    final Throwable cause = failure.getCause();
    return cause == failure ? null : cause;
  }
}

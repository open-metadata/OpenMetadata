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
package org.openmetadata.service.rdf.storage;

import java.time.Duration;
import java.util.Optional;
import lombok.Getter;

/**
 * A write to the RDF store was held back because storage maintenance is running or the store is
 * low on disk. Nothing was applied, so retrying after {@link #getRetryAfter()} is always safe, and
 * the write is not a delivery failure: it must not use up a retry, trip the circuit breaker or mark
 * the projection degraded.
 */
@Getter
public sealed class RdfStorageMaintenanceException extends RuntimeException
    permits RdfStorageLowDiskException {
  private final transient Duration retryAfter;

  public RdfStorageMaintenanceException(final String maintenanceJob, final Duration retryAfter) {
    super("RDF storage maintenance " + maintenanceJob + " is running; retry in " + retryAfter);
    this.retryAfter = retryAfter;
  }

  /** The maintenance refusal behind {@code failure}, if that is what it was. */
  public static Optional<RdfStorageMaintenanceException> find(final Throwable failure) {
    Throwable current = failure;
    while (current != null && !(current instanceof RdfStorageMaintenanceException)) {
      current = current.getCause() == current ? null : current.getCause();
    }
    return Optional.ofNullable((RdfStorageMaintenanceException) current);
  }
}

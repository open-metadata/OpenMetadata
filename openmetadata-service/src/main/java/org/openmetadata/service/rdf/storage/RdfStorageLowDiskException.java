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

/**
 * Fuseki's storage guard refused a write because its data volume is below the free-space
 * reserve. The guard answers before the write reaches TDB2, so nothing was applied: unlike other
 * 503s, the outcome is certain, and the write is retried, without using a delivery attempt, until
 * storage maintenance frees space. The queue's lag still marks the projection degraded meanwhile.
 * See ADR:2026-10-28-the-fuseki-image-refuses-writes-below-a-free-space-reserve-and-reports-its-volume.
 */
public final class RdfStorageLowDiskException extends RdfStorageMaintenanceException {
  static final String GUARD_MARKER = "OpenMetadata storage guard";
  static final Duration RETRY_AFTER = Duration.ofSeconds(30);

  public RdfStorageLowDiskException(final String operation) {
    super("low-disk (refused " + operation + ")", RETRY_AFTER);
  }
}

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

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import org.apache.jena.atlas.web.HttpException;
import org.junit.jupiter.api.Test;

/**
 * Fuseki's storage guard refuses a write before applying it, so its 503 is told apart from a 503
 * whose write may have been applied: only the guard's is a certain, retry-later refusal.
 */
class StorageGuardRefusalTest {
  private static final String GUARD_BODY =
      "OpenMetadata storage guard: the data volume is below its free-space reserve; "
          + "writes resume once space is freed";

  @Test
  void theGuardsServiceUnavailableIsARefusal() {
    final HttpException refused = new HttpException(503, "Service Unavailable", GUARD_BODY);

    assertTrue(JenaFusekiStorage.isStorageGuardRefusal(refused));
    assertTrue(
        JenaFusekiStorage.isStorageGuardRefusal(new RuntimeException("update failed", refused)));
  }

  @Test
  void anyOtherServiceUnavailableIsNot() {
    assertFalse(
        JenaFusekiStorage.isStorageGuardRefusal(
            new HttpException(503, "Service Unavailable", "Jetty is overloaded")));
    assertFalse(
        JenaFusekiStorage.isStorageGuardRefusal(new HttpException(500, "Error", GUARD_BODY)));
    assertFalse(JenaFusekiStorage.isStorageGuardRefusal(new IllegalStateException("x")));
  }

  @Test
  void aRefusalIsHeldBackLikeMaintenanceAndCarriesNoHttpCause() {
    final RdfStorageLowDiskException refusal = new RdfStorageLowDiskException("storeEntity");

    assertTrue(RdfStorageMaintenanceException.find(refusal).isPresent());
    assertFalse(JenaFusekiStorage.isCircuitBreakerFailure(refusal));
    assertFalse(RdfWriteRetry.isUncertain(refusal));
  }
}

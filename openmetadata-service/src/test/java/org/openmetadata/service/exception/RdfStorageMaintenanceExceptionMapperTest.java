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

package org.openmetadata.service.exception;

import static org.junit.jupiter.api.Assertions.assertEquals;

import jakarta.ws.rs.core.HttpHeaders;
import jakarta.ws.rs.core.Response;
import java.time.Duration;
import org.junit.jupiter.api.Test;
import org.openmetadata.service.rdf.storage.RdfStorageMaintenanceException;

class RdfStorageMaintenanceExceptionMapperTest {
  @Test
  void maintenanceTellsTheClientToRetryLater() {
    final Response response =
        new RdfStorageMaintenanceExceptionMapper()
            .toResponse(new RdfStorageMaintenanceException("compaction", Duration.ofSeconds(5)));

    assertEquals(503, response.getStatus());
    assertEquals("5", String.valueOf(response.getHeaderString(HttpHeaders.RETRY_AFTER)));
  }
}

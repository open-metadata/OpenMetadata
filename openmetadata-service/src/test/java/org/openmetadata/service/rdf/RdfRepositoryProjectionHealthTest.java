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

import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;

import java.net.URI;
import java.util.UUID;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.api.configuration.rdf.RdfConfiguration;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.service.Entity;
import org.openmetadata.service.rdf.storage.RdfStorageInterface;

class RdfRepositoryProjectionHealthTest {
  private static final String BASE_URI = "https://open-metadata.org/";

  @AfterEach
  void resetProjectionHealth() {
    RdfProjectionHealth.markReady();
  }

  @Test
  void storageFailureDegradesProjectionHealth() {
    final RdfStorageInterface storage = mock(RdfStorageInterface.class);
    doThrow(new IllegalStateException("storage unavailable"))
        .when(storage)
        .executeSparqlUpdate(anyString());
    final RdfRepository repository = new RdfRepository(configuration(), storage, null);

    repository.delete(new EntityReference().withId(UUID.randomUUID()).withType(Entity.TABLE));

    assertTrue(RdfProjectionHealth.isDegraded());
  }

  private static RdfConfiguration configuration() {
    return new RdfConfiguration().withEnabled(true).withBaseUri(URI.create(BASE_URI));
  }
}

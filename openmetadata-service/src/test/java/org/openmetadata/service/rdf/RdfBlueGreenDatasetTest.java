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

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotSame;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.net.URI;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.api.configuration.rdf.RdfConfiguration;
import org.openmetadata.service.rdf.storage.RdfStorageInterface;

@DisplayName("Blue/green dataset selection and routing")
class RdfBlueGreenDatasetTest {

  private static final String BASE_URI = "https://open-metadata.org/";

  @Nested
  @DisplayName("build target alternation")
  class AlternationTests {

    @Test
    @DisplayName("first rebuild targets the _a alternate")
    void firstRebuildTargetsA() {
      assertEquals("openmetadata_a", RdfRepository.alternateDatasetName("openmetadata", null));
      assertEquals(
          "openmetadata_a", RdfRepository.alternateDatasetName("openmetadata", "openmetadata"));
    }

    @Test
    @DisplayName("rebuild flips to the other alternate while _a is serving")
    void rebuildFlipsAwayFromServing() {
      assertEquals(
          "openmetadata_b", RdfRepository.alternateDatasetName("openmetadata", "openmetadata_a"));
      assertEquals(
          "openmetadata_a", RdfRepository.alternateDatasetName("openmetadata", "openmetadata_b"));
    }

    @Test
    @DisplayName("alternation never targets the serving dataset")
    void alternationNeverTargetsServing() {
      // Two fixed names bound disk at two copies; targeting the live one would
      // clear the graph users are querying, which is the failure blue/green exists
      // to prevent.
      for (String active :
          new String[] {null, "openmetadata", "openmetadata_a", "openmetadata_b"}) {
        assertNotSame(
            active, RdfRepository.alternateDatasetName("openmetadata", active), "active=" + active);
      }
    }
  }

  @Nested
  @DisplayName("repository routing")
  class RepositoryRoutingTests {

    @Test
    @DisplayName("capability follows backend dataset support, not a server flag")
    void blueGreenCapabilityFollowsBackendSupport() {
      // Whether a given run *uses* blue/green is a per-run app-config choice; the
      // repository only answers whether this deployment *can*.
      RdfStorageInterface unsupported = mock(RdfStorageInterface.class);
      lenient().when(unsupported.supportsDatasetManagement()).thenReturn(false);
      assertFalse(
          new RdfRepository(config(), unsupported, null).supportsBlueGreenRebuild(),
          "a backend without dataset management cannot do blue/green");

      RdfStorageInterface supported = mock(RdfStorageInterface.class);
      lenient().when(supported.supportsDatasetManagement()).thenReturn(true);
      assertTrue(
          new RdfRepository(config(), supported, null).supportsBlueGreenRebuild(),
          "a dataset-managing backend is capable regardless of any server flag");
    }

    @Test
    @DisplayName("routing to the serving dataset returns the same repository, not a copy")
    void routingToServingDatasetReturnsSelf() {
      RdfStorageInterface storage = mock(RdfStorageInterface.class);
      when(storage.currentDatasetName()).thenReturn("openmetadata");
      RdfRepository repository = new RdfRepository(config(), storage, null);

      assertSame(repository, repository.forDataset("openmetadata"));
      assertSame(repository, repository.forDataset(null));
      assertSame(repository, repository.forDataset("  "));
    }

    @Test
    @DisplayName("build dataset resolves to an alternate, never to the serving dataset")
    void buildDatasetResolvesToAlternate() {
      RdfStorageInterface storage = mock(RdfStorageInterface.class);
      when(storage.currentDatasetName()).thenReturn("openmetadata");
      // With no pointer row readable in a unit context, the active dataset falls back
      // to the configured one, so the build target is the first alternate.
      RdfRepository repository = new RdfRepository(config(), storage, null);

      String target = repository.resolveBuildDatasetName();

      assertEquals("openmetadata_a", target);
      assertNotSame("openmetadata", target);
    }
  }

  private static RdfConfiguration config() {
    return new RdfConfiguration()
        .withEnabled(true)
        .withBaseUri(URI.create(BASE_URI))
        .withRemoteEndpoint(URI.create("http://fuseki:3030/openmetadata"));
  }
}

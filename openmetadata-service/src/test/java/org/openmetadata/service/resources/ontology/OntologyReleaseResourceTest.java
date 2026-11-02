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

package org.openmetadata.service.resources.ontology;

import static org.junit.jupiter.api.Assertions.assertEquals;

import java.net.URI;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.api.configuration.rdf.RdfConfiguration;
import org.openmetadata.service.OpenMetadataApplicationConfig;

class OntologyReleaseResourceTest {
  private static OpenMetadataApplicationConfig configWith(final RdfConfiguration rdf) {
    final OpenMetadataApplicationConfig config = new OpenMetadataApplicationConfig();
    config.setRdfConfiguration(rdf);
    return config;
  }

  @Test
  void anAbsentRdfConfigurationUsesTheDefaultBase() {
    assertEquals(
        URI.create("https://open-metadata.org/"),
        OntologyReleaseResource.assetBase(configWith(null)));
  }

  @Test
  void anRdfConfigurationWithoutABaseUsesTheDefaultBase() {
    assertEquals(
        URI.create("https://open-metadata.org/"),
        OntologyReleaseResource.assetBase(configWith(new RdfConfiguration().withBaseUri(null))));
  }

  @Test
  void aConfiguredBaseIsUsedVerbatim() {
    assertEquals(
        URI.create("https://catalog.example.com/om/"),
        OntologyReleaseResource.assetBase(
            configWith(
                new RdfConfiguration()
                    .withBaseUri(URI.create("https://catalog.example.com/om/")))));
  }
}

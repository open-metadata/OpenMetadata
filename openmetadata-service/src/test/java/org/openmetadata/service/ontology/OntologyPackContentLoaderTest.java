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

package org.openmetadata.service.ontology;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import org.junit.jupiter.api.Test;

class OntologyPackContentLoaderTest {
  private final OntologyPackContentLoader loader =
      new OntologyPackContentLoader(OntologyPackContentLoaderTest.class.getClassLoader());

  @Test
  void readsExactClasspathContentAndComputesItsChecksum() {
    final OntologyPackContentLoader.PackContent content =
        loader.load("rdf/ontology-packs/fhir/core.ttl");

    assertTrue(content.body().contains("FHIR Resource"));
    assertEquals(
        "3b296bd1c87d2045f9f892334c08c776494adb0b4bfa2a75cebc0180cd56bcd3", content.sha256());
  }

  @Test
  void failsFastWhenRequiredPackContentIsMissing() {
    final IllegalStateException exception =
        assertThrows(
            IllegalStateException.class, () -> loader.load("rdf/ontology-packs/missing.ttl"));

    assertTrue(exception.getMessage().contains("rdf/ontology-packs/missing.ttl"));
  }
}

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

import java.util.List;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.api.data.OntologyPackManifest;
import org.openmetadata.schema.type.OntologyPackModule;

class OntologyPackCatalogTest {
  private final OntologyPackCatalog catalog =
      new OntologyPackCatalog(OntologyPackCatalogTest.class.getClassLoader());

  @Test
  void loadsTheSixInstallableCatalogueEntriesAndVerifiesBundledChecksums() {
    assertEquals(6, catalog.list().size());
    assertTrue(
        catalog.list().stream().allMatch(OntologyPackManifest::getBundled),
        "every catalogue entry ships installable bundled content");
  }

  @Test
  void selectsDependenciesInManifestOrder() {
    final OntologyPackManifest fhir = catalog.require("fhir");

    final List<String> selected =
        catalog.select(fhir, List.of("clinical")).stream().map(OntologyPackModule::getId).toList();

    assertEquals(List.of("core", "clinical"), selected);
  }

  @Test
  void rejectsUnknownPacksAndModules() {
    assertThrows(IllegalArgumentException.class, () -> catalog.require("missing"));
    assertThrows(
        IllegalArgumentException.class,
        () -> catalog.select(catalog.require("fhir"), List.of("missing")));
  }
}

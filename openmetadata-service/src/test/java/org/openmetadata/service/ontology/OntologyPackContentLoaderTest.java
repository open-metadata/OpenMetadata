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

class OntologyPackContentLoaderTest {
  private final OntologyPackContentLoader loader =
      new OntologyPackContentLoader(OntologyPackContentLoaderTest.class.getClassLoader());

  @Test
  void readsExactClasspathContentAndComputesItsChecksum() {
    final OntologyPackContentLoader.PackContent content =
        loader.load("rdf/ontology-packs/dcat/dcat.ttl");

    assertTrue(content.body().contains("dcat:Dataset"));
    assertEquals(
        "d1624d3bbf364f6fc1d43b9a188bbb9e67639b1a7d46a5cb7ea3f5d47d02b62f", content.sha256());
  }

  @Test
  void failsFastWhenRequiredPackContentIsMissing() {
    final IllegalStateException exception =
        assertThrows(
            IllegalStateException.class, () -> loader.load("rdf/ontology-packs/missing.ttl"));

    assertTrue(exception.getMessage().contains("rdf/ontology-packs/missing.ttl"));
  }

  @Test
  void selectedContentIncludesItsVerifiedDependencies() {
    final var catalog = new OntologyPackCatalog(getClass().getClassLoader());
    final var selected = loader.loadSelected(catalog, "sosa-ssn", List.of("ssn"));
    assertEquals("sosa-ssn", selected.manifest().getId());
    assertEquals(
        List.of("sosa", "ssn"), selected.modules().stream().map(module -> module.getId()).toList());
    assertEquals("turtle", selected.format());
    assertTrue(selected.body().contains("sosa:Sensor"));
    assertTrue(selected.body().contains("ssn:System"));
  }

  @Test
  void aPackInRdfXmlKeepsItsFormat() {
    final var catalog = new OntologyPackCatalog(getClass().getClassLoader());
    final var selected = loader.loadSelected(catalog, "foaf", List.of("foaf"));
    assertEquals("rdfxml", selected.format());
    assertTrue(selected.body().contains("http://xmlns.com/foaf/0.1/Person"));
  }

  @Test
  void independentlyLicensedPacksCannotLoadABundledPayload() {
    final var catalog = new OntologyPackCatalog(getClass().getClassLoader());
    catalog.require("dcat").setBundled(false);
    assertThrows(
        IllegalArgumentException.class,
        () -> loader.loadSelected(catalog, "dcat", List.of("dcat")));
  }

  @Test
  void loadsAPackTooBigForOneInteractiveImport() {
    final var catalog = new OntologyPackCatalog(getClass().getClassLoader());
    final var selected = loader.loadSelected(catalog, "fibo", List.of("fibo-quickstart"));
    assertEquals("turtle", selected.format());
    assertTrue(selected.body().contains("https://spec.edmcouncil.org/fibo/ontology/"));
  }
}

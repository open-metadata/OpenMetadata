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
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.api.data.OntologyPackManifest;
import org.openmetadata.schema.type.OntologyPackModule;

class OntologyPackCatalogTest {
  private static final String PACKS = "json/data/ontology/packs/";
  private static final Set<String> STARTER_PACKS = Set.of("isa-95", "hr-open");
  private static final Set<String> UPSTREAM_PACKS =
      Set.of(
          "brick",
          "dcat",
          "dpv",
          "epcis",
          "fhir",
          "fibo",
          "foaf",
          "gs1",
          "iof",
          "odrl",
          "org",
          "owl-time",
          "prov-o",
          "sosa-ssn");

  private final OntologyPackCatalog catalog =
      new OntologyPackCatalog(OntologyPackCatalogTest.class.getClassLoader());

  @Test
  void loadsEveryIndexedPackAndVerifiesBundledChecksums() {
    final Set<String> ids =
        catalog.list().stream().map(OntologyPackManifest::getId).collect(Collectors.toSet());

    assertEquals(16, catalog.list().size());
    assertTrue(ids.containsAll(UPSTREAM_PACKS) && ids.containsAll(STARTER_PACKS));
    assertTrue(
        catalog.list().stream().allMatch(OntologyPackManifest::getBundled),
        "every catalogue entry ships installable bundled content");
  }

  @Test
  void everyPackNamesItsPublisherLicenseAndAttribution() {
    for (final OntologyPackManifest pack : catalog.list()) {
      assertFalse(pack.getPublisher().isBlank(), pack.getId() + " publisher");
      assertFalse(pack.getAttribution().isBlank(), pack.getId() + " attribution");
      assertFalse(pack.getLicense().isBlank(), pack.getId() + " license");
    }
  }

  @Test
  void upstreamPacksKeepTheirPublishersUrlsAndStarterPacksSayTheyAreOurs() {
    for (final OntologyPackManifest pack : catalog.list()) {
      final boolean starter = STARTER_PACKS.contains(pack.getId());
      assertEquals(starter, pack.getName().endsWith("(OpenMetadata-authored)"), pack.getId());
      assertEquals(starter, "OpenMetadata".equals(pack.getPublisher()), pack.getId());
      assertEquals(
          starter,
          pack.getModules().stream().allMatch(module -> module.getSourceUrl() == null),
          pack.getId() + " module source URLs are the publisher's");
      if (starter) {
        assertEquals("Apache License 2.0", pack.getLicense(), pack.getId());
      }
    }
  }

  @Test
  void selectsDependenciesInManifestOrder() {
    final OntologyPackManifest sensors = catalog.require("sosa-ssn");

    final List<String> selected =
        catalog.select(sensors, List.of("ssn")).stream().map(OntologyPackModule::getId).toList();

    assertEquals(List.of("sosa", "ssn"), selected);
  }

  @Test
  void theEpcisPackPullsInTheCbvItsRangesPointAt() {
    final OntologyPackManifest epcis = catalog.require("epcis");

    final List<String> selected =
        catalog.select(epcis, List.of("epcis")).stream().map(OntologyPackModule::getId).toList();

    assertEquals(List.of("cbv", "epcis"), selected);
    assertEquals("GS1", epcis.getPublisher());
    assertEquals(
        "No license statement published by GS1; included pending confirmation", epcis.getLicense());
  }

  @Test
  void rejectsUnknownPacksAndModules() {
    assertThrows(IllegalArgumentException.class, () -> catalog.require("missing"));
    assertThrows(
        IllegalArgumentException.class,
        () -> catalog.select(catalog.require("sosa-ssn"), List.of("missing")));
  }

  @Test
  void failsFastWhenTheIndexIsMissing() {
    final ClassLoader empty = classpath(Map.of());

    final IllegalStateException exception =
        assertThrows(IllegalStateException.class, () -> new OntologyPackCatalog(empty));

    assertTrue(exception.getMessage().contains(PACKS + "index.json"));
  }

  @Test
  void failsFastWhenAnIndexedManifestIsMissing() {
    final ClassLoader loader = classpath(Map.of(PACKS + "index.json", "{\"packs\":[\"ghost\"]}"));

    final IllegalStateException exception =
        assertThrows(IllegalStateException.class, () -> new OntologyPackCatalog(loader));

    assertTrue(exception.getMessage().contains(PACKS + "ghost.json"));
  }

  @Test
  void failsFastWhenAManifestIsMalformed() {
    final ClassLoader loader =
        classpath(
            Map.of(PACKS + "index.json", "{\"packs\":[\"broken\"]}", PACKS + "broken.json", "{no"));

    final IllegalStateException exception =
        assertThrows(IllegalStateException.class, () -> new OntologyPackCatalog(loader));

    assertTrue(exception.getMessage().contains("broken.json"));
  }

  @Test
  void failsFastWhenAManifestDeclaresAnotherId() {
    final String manifest = realManifest("dcat").replace("\"id\": \"dcat\"", "\"id\": \"other\"");
    final ClassLoader loader =
        classpath(
            Map.of(PACKS + "index.json", "{\"packs\":[\"dcat\"]}", PACKS + "dcat.json", manifest));

    final IllegalStateException exception =
        assertThrows(IllegalStateException.class, () -> new OntologyPackCatalog(loader));

    assertTrue(exception.getMessage().contains("declares id 'other'"));
  }

  private static String realManifest(final String packId) {
    try (InputStream input =
        OntologyPackCatalogTest.class
            .getClassLoader()
            .getResourceAsStream(PACKS + packId + ".json")) {
      return new String(input.readAllBytes(), StandardCharsets.UTF_8);
    } catch (IOException exception) {
      throw new IllegalStateException(exception);
    }
  }

  private static ClassLoader classpath(final Map<String, String> resources) {
    return new ClassLoader(OntologyPackCatalogTest.class.getClassLoader()) {
      @Override
      public InputStream getResourceAsStream(final String name) {
        final String body = resources.get(name);
        if (body != null) {
          return new ByteArrayInputStream(body.getBytes(StandardCharsets.UTF_8));
        }
        return name.startsWith(PACKS) ? null : super.getResourceAsStream(name);
      }
    };
  }
}

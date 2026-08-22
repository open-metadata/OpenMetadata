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
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import jakarta.ws.rs.core.UriInfo;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Set;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.api.data.OntologyPackManifest;
import org.openmetadata.schema.entity.data.Glossary;
import org.openmetadata.schema.type.OntologyConfiguration;
import org.openmetadata.schema.type.OntologyPackInstallation;
import org.openmetadata.schema.type.OntologyPackModule;

class OntologyPackInstallationServiceTest {
  private static final long INSTALLED_AT = 1_788_000_000_000L;
  private static final Clock CLOCK =
      Clock.fixed(Instant.ofEpochMilli(INSTALLED_AT), ZoneOffset.UTC);

  @Test
  void recordsChecksummedProvenanceAndReplacesTheSamePackVersion() {
    final Glossary glossary = glossary();
    final AtomicReference<Glossary> saved = new AtomicReference<>();
    final OntologyPackInstallationService service = service(glossary, saved);
    final OntologyPackCatalog catalog = catalog();
    final OntologyPackManifest manifest = catalog.require("fhir");
    final List<OntologyPackModule> modules = catalog.select(manifest, Set.of("clinical"));

    final OntologyPackInstallation installation =
        service.record(manifest, modules, "Healthcare", context());

    assertEquals("fhir", installation.getPackId());
    assertEquals(INSTALLED_AT, installation.getInstalledAt());
    assertEquals(List.of("core", "clinical"), moduleIds(installation));
    assertTrue(
        installation.getModules().stream().allMatch(module -> module.getSha256().length() == 64));
    assertEquals(2, glossary.getOntologyConfiguration().getInstalledPacks().size());
    assertFalse(glossary.getOntologyConfiguration().getReadOnly());
    assertSame(glossary, saved.get());
  }

  @Test
  void failsWhenTheCommittedImporterDidNotCreateItsTarget() {
    final OntologyPackInstallationService service = service(null, new AtomicReference<>());
    final OntologyPackManifest manifest = catalog().require("fibo");

    final IllegalStateException exception =
        assertThrows(
            IllegalStateException.class,
            () -> service.record(manifest, manifest.getModules(), "Missing", context()));

    assertTrue(exception.getMessage().contains("Missing"));
  }

  private static OntologyPackInstallationService service(
      final Glossary glossary, final AtomicReference<Glossary> saved) {
    return new OntologyPackInstallationService(
        new OntologyPackInstallationService.InstallationStore() {
          @Override
          public Glossary find(final String glossaryName) {
            return glossary;
          }

          @Override
          public void save(final UriInfo uriInfo, final Glossary entity, final String user) {
            saved.set(entity);
          }
        },
        CLOCK);
  }

  private static Glossary glossary() {
    final OntologyPackInstallation existing =
        new OntologyPackInstallation().withPackId("fhir").withVersion("old");
    final OntologyPackInstallation other =
        new OntologyPackInstallation().withPackId("other").withVersion("1.0");
    final OntologyConfiguration configuration =
        new OntologyConfiguration().withInstalledPacks(List.of(existing, other));
    return new Glossary()
        .withName("Healthcare")
        .withDescription("Healthcare")
        .withOntologyConfiguration(configuration);
  }

  private static List<String> moduleIds(final OntologyPackInstallation installation) {
    return installation.getModules().stream().map(module -> module.getModuleId()).toList();
  }

  private static OntologyPackCatalog catalog() {
    return new OntologyPackCatalog(OntologyPackInstallationServiceTest.class.getClassLoader());
  }

  private static OntologyPackInstaller.InstallationContext context() {
    return new OntologyPackInstaller.InstallationContext(null, "alice", false);
  }
}

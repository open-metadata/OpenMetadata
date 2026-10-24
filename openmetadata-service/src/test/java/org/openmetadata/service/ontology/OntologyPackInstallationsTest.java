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
import static org.junit.jupiter.api.Assertions.assertNotSame;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.entity.data.Ontology;
import org.openmetadata.schema.entity.data.OntologyChangeSet;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.OntologyPackInstallation;
import org.openmetadata.schema.type.OntologyPackModuleInstallation;
import org.openmetadata.schema.type.OntologyPackSource;
import org.openmetadata.service.exception.BadRequestException;
import org.openmetadata.service.exception.PreconditionFailedException;

class OntologyPackInstallationsTest {
  private final OntologyPackCatalog catalog = OntologyPackCatalog.bundled();

  @Test
  void validatesDependencyExpandedSourceAndStampsCatalogProvenance() {
    final OntologyChangeSet changeSet = changeSet("fhir", List.of("core", "clinical"));

    OntologyPackInstallations.requireCurrent(catalog, changeSet);
    final var prepared = OntologyPackInstallations.prepare(catalog, changeSet, "steward", 123L);

    assertEquals(changeSet.getOntology().getId(), prepared.ontologyId());
    assertEquals(
        List.of("core", "clinical"),
        prepared.installation().getModules().stream()
            .map(OntologyPackModuleInstallation::getModuleId)
            .toList());
    assertEquals(
        catalog.require("fhir").getModules().getFirst().getSha256(),
        prepared.installation().getModules().getFirst().getSha256());
    assertEquals(123L, prepared.installation().getInstalledAt());
    assertEquals("steward", prepared.installation().getInstalledBy());
    assertEquals(catalog.require("fhir").getLicense(), prepared.installation().getLicense());
  }

  @Test
  void rejectsUnexpandedModulesAndGlossaryScope() {
    assertThrows(
        BadRequestException.class,
        () ->
            OntologyPackInstallations.requireCurrent(
                catalog, changeSet("fhir", List.of("clinical"))));
    final OntologyChangeSet glossary = changeSet("fhir", List.of("core"));
    glossary.setOntology(null);
    assertThrows(
        BadRequestException.class,
        () -> OntologyPackInstallations.requireCurrent(catalog, glossary));
  }

  @Test
  void mergesModulesOfTheSamePackWithoutMutatingPreviousRecord() {
    final OntologyPackInstallation first = installation("fhir", "core", "clinical");
    final OntologyPackInstallation second = installation("fhir", "core", "workflow");

    final List<OntologyPackInstallation> merged =
        OntologyPackInstallations.record(
            List.of(first), second, List.of("core", "clinical", "workflow"));

    assertEquals(1, merged.size());
    assertNotSame(first, merged.getFirst());
    assertEquals(
        List.of("core", "clinical", "workflow"),
        merged.getFirst().getModules().stream()
            .map(OntologyPackModuleInstallation::getModuleId)
            .toList());
    assertEquals(
        List.of("core", "clinical"),
        first.getModules().stream().map(OntologyPackModuleInstallation::getModuleId).toList());
  }

  @Test
  void stampsTheVerifiedDependencyExpandedSelection() {
    final var selected =
        new OntologyPackContentLoader(getClass().getClassLoader())
            .loadSelected(catalog, "fhir", List.of("clinical"));

    final OntologyPackSource source = OntologyPackInstallations.sourcePack(selected);

    assertEquals("fhir", source.getPackId());
    assertEquals(selected.manifest().getVersion(), source.getVersion());
    assertEquals(List.of("core", "clinical"), new ArrayList<>(source.getModuleIds()));
  }

  @Test
  void listsInstalledOntologiesInPackAndNameOrder() {
    final Ontology zed =
        new Ontology()
            .withId(UUID.randomUUID())
            .withName("Zed")
            .withFullyQualifiedName("Zed")
            .withInstalledPacks(List.of(installation("fhir", "core")));
    final Ontology alpha =
        new Ontology()
            .withId(UUID.randomUUID())
            .withName("Alpha")
            .withFullyQualifiedName("Alpha")
            .withInstalledPacks(
                List.of(installation("fhir", "core"), installation("fibo", "foundations")));
    final Ontology empty = new Ontology().withId(UUID.randomUUID()).withName("Empty");

    final var records = OntologyPackInstallations.records(List.of(zed, empty, alpha));

    assertEquals(
        List.of("fhir:Alpha", "fhir:Zed", "fibo:Alpha"),
        records.stream()
            .map(
                record ->
                    record.getInstallation().getPackId()
                        + ":"
                        + record.getOntology().getFullyQualifiedName())
            .toList());
  }

  @Test
  void replacesAnotherPackVersionAndRejectsStaleSourceAtApply() {
    final OntologyPackInstallation first = installation("fhir", "core");
    final OntologyPackInstallation newer = installation("fhir", "core").withVersion("2");
    final OntologyPackInstallation unrelated = installation("fibo", "foundations");

    assertEquals(
        List.of(newer, unrelated),
        OntologyPackInstallations.record(
            List.of(first, unrelated), newer, List.of("core", "clinical", "workflow")));
    assertEquals(List.of(newer), OntologyPackInstallations.record(null, newer, List.of("core")));

    final OntologyChangeSet unstamped = new OntologyChangeSet();
    OntologyPackInstallations.requireCurrent(catalog, unstamped);
    assertNull(OntologyPackInstallations.prepare(catalog, unstamped, "steward", 123L));

    final OntologyChangeSet stale = changeSet("fhir", List.of("core"));
    stale.getSourcePack().setVersion("old-version");
    assertThrows(
        BadRequestException.class, () -> OntologyPackInstallations.requireCurrent(catalog, stale));
    assertThrows(
        PreconditionFailedException.class,
        () -> OntologyPackInstallations.prepare(catalog, stale, "steward", 123L));
  }

  private OntologyChangeSet changeSet(final String packId, final List<String> moduleIds) {
    return new OntologyChangeSet()
        .withOntology(new EntityReference().withId(UUID.randomUUID()))
        .withSourcePack(
            new OntologyPackSource()
                .withPackId(packId)
                .withVersion(catalog.require(packId).getVersion())
                .withModuleIds(new LinkedHashSet<>(moduleIds)));
  }

  private static OntologyPackInstallation installation(
      final String packId, final String... moduleIds) {
    return new OntologyPackInstallation()
        .withPackId(packId)
        .withVersion("1")
        .withModules(
            java.util.Arrays.stream(moduleIds)
                .map(
                    id ->
                        new OntologyPackModuleInstallation()
                            .withModuleId(id)
                            .withSha256("a".repeat(64)))
                .toList())
        .withInstalledAt(1L)
        .withInstalledBy("steward");
  }
}

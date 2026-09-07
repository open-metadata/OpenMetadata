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
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;
import java.util.Set;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.api.data.InstallOntologyPack;
import org.openmetadata.schema.api.data.OntologyImportResult;
import org.openmetadata.schema.api.data.OntologyPackInstallResult;
import org.openmetadata.schema.type.OntologyPackInstallation;
import org.openmetadata.schema.type.OntologyPackModuleInstallation;
import org.openmetadata.schema.type.RdfValidationReport;

class OntologyPackInstallerTest {
  private final ClassLoader classLoader = OntologyPackInstallerTest.class.getClassLoader();

  @Test
  void installsTheDependencyClosureAsOneVerifiedImport() {
    final AtomicReference<ImportInvocation> invocation = new AtomicReference<>();
    final OntologyPackInstaller installer = installer(invocation);
    final InstallOntologyPack request =
        new InstallOntologyPack()
            .withModuleIds(Set.of("clinical"))
            .withTargetGlossaryName("Healthcare")
            .withDryRun(false);

    final OntologyPackInstallResult result = installer.install("fhir", request, context());

    assertEquals(List.of("core", "clinical"), result.getModuleIds());
    assertEquals(8, result.getConceptCount());
    assertEquals(6, result.getRelationshipCount());
    assertFalse(result.getDryRun());
    assertEquals("fhir", result.getInstallation().getPackId());
    assertEquals(2, result.getInstallation().getModules().size());
    assertTrue(invocation.get().rdf().contains("FHIR Resource"));
    assertTrue(invocation.get().rdf().contains("Clinical Record"));
    assertEquals("Healthcare", invocation.get().targetGlossary());
  }

  @Test
  void installsAPreviouslyCatalogueOnlyStandard() {
    final OntologyPackInstaller installer = installer(new AtomicReference<>());
    final InstallOntologyPack request =
        new InstallOntologyPack()
            .withModuleIds(Set.of("event-model"))
            .withTargetGlossaryName("SupplyChain")
            .withDryRun(true);

    final OntologyPackInstallResult result = installer.install("epcis", request, context());

    assertEquals(List.of("event-model"), result.getModuleIds());
    assertTrue(result.getDryRun());
  }

  @Test
  void dryRunDoesNotRecordAnInstallation() {
    final OntologyPackInstaller installer = installer(new AtomicReference<>());
    final InstallOntologyPack request =
        new InstallOntologyPack()
            .withModuleIds(Set.of("foundations"))
            .withTargetGlossaryName("FinancePreview")
            .withDryRun(true);

    final OntologyPackInstallResult result = installer.install("fibo", request, context());

    assertTrue(result.getDryRun());
    assertNull(result.getInstallation());
  }

  private OntologyPackInstaller installer(final AtomicReference<ImportInvocation> invocation) {
    final OntologyPackCatalog catalog = new OntologyPackCatalog(classLoader);
    return new OntologyPackInstaller(
        catalog,
        new OntologyPackContentLoader(classLoader),
        ignored ->
            (rdf, format, targetGlossary, dryRun) -> {
              invocation.set(new ImportInvocation(rdf, format, targetGlossary, dryRun));
              return importResult(dryRun);
            },
        (manifest, modules, targetGlossary, context) ->
            new OntologyPackInstallation()
                .withPackId(manifest.getId())
                .withVersion(manifest.getVersion())
                .withModules(
                    modules.stream()
                        .map(
                            module ->
                                new OntologyPackModuleInstallation()
                                    .withModuleId(module.getId())
                                    .withSha256(module.getSha256()))
                        .toList())
                .withInstalledAt(1L)
                .withInstalledBy(context.user())
                .withSourceUrl(manifest.getSourceUrl())
                .withLicense(manifest.getLicense())
                .withLicenseUrl(manifest.getLicenseUrl()));
  }

  private static OntologyImportResult importResult(final boolean dryRun) {
    return new OntologyImportResult()
        .withAnnexRevisions(List.of())
        .withConceptMappingsAdded(0)
        .withCustomPropertiesCreated(0)
        .withDryRun(dryRun)
        .withGlossariesCreated(1)
        .withMessages(List.of())
        .withRelationTypesRegistered(0)
        .withRelationsAdded(6)
        .withTermsCreated(8)
        .withTermsUpdated(0)
        .withValidationReport(
            new RdfValidationReport()
                .withConforms(true)
                .withViolationCount(0)
                .withViolations(List.of()));
  }

  private static OntologyPackInstaller.InstallationContext context() {
    return new OntologyPackInstaller.InstallationContext(null, "admin", true);
  }

  private record ImportInvocation(
      String rdf, String format, String targetGlossary, boolean dryRun) {}
}

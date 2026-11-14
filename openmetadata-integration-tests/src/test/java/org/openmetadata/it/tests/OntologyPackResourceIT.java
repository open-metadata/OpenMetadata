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

package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.Set;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.util.NamespaceCleanup;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.data.InstallOntologyPack;
import org.openmetadata.schema.api.data.OntologyPackInstallResult;
import org.openmetadata.schema.api.data.OntologyPackList;
import org.openmetadata.schema.entity.data.Glossary;
import org.openmetadata.service.Entity;

@Execution(ExecutionMode.CONCURRENT)
@ExtendWith(TestNamespaceExtension.class)
public class OntologyPackResourceIT {
  @AfterEach
  void cleanup(TestNamespace namespace) {
    NamespaceCleanup.deleteRoots(namespace.drainTrackedRoots());
  }

  @Test
  void listsTheLicensedCatalogueAndDryRunsDependencyClosure(TestNamespace namespace) {
    final OntologyPackList catalogue = SdkClients.adminClient().ontologyPacks().list();

    assertEquals(16, catalogue.getPacks().size());
    assertTrue(catalogue.getPacks().stream().anyMatch(pack -> pack.getId().equals("sosa-ssn")));

    final InstallOntologyPack request =
        new InstallOntologyPack()
            .withModuleIds(Set.of("ssn"))
            .withTargetGlossaryName(namespace.prefix("SensorDryRun"))
            .withDryRun(true);
    final OntologyPackInstallResult result = install("sosa-ssn", request);

    assertEquals(Set.of("sosa", "ssn"), Set.copyOf(result.getModuleIds()));
    assertEquals(27, result.getConceptCount());
    assertTrue(result.getDryRun());
  }

  @Test
  void installsVerifiedPackContentIntoANewGlossary(TestNamespace namespace) {
    final String targetGlossary = namespace.prefix("IsaLibrary");
    final InstallOntologyPack request =
        new InstallOntologyPack()
            .withModuleIds(Set.of("manufacturing-operations"))
            .withTargetGlossaryName(targetGlossary)
            .withDryRun(false);

    final OntologyPackInstallResult result = install("isa-95", request);
    final Glossary glossary = SdkClients.adminClient().glossaries().getByName(targetGlossary);
    namespace.trackRoot(Entity.GLOSSARY, glossary);

    assertEquals(9, result.getConceptCount());
    assertEquals(9, result.getImportResults().getFirst().getTermsCreated());
    assertEquals("isa-95", result.getPackId());
    assertEquals(Set.of("manufacturing-operations"), Set.copyOf(result.getModuleIds()));
    assertNotNull(glossary.getId());
    assertEquals(
        "Enterprise",
        SdkClients.adminClient()
            .glossaryTerms()
            .getByName(targetGlossary + ".Enterprise")
            .getDisplayName());
  }

  private static OntologyPackInstallResult install(
      final String packId, final InstallOntologyPack request) {
    return SdkClients.adminClient().ontologyPacks().install(packId, request);
  }
}

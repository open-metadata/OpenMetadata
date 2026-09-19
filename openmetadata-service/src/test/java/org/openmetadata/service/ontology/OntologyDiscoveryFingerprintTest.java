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

import jakarta.ws.rs.BadRequestException;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.entity.data.OntologyChangeSet;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.OntologyChangeOperation;
import org.openmetadata.schema.type.OntologyChangeOperationType;
import org.openmetadata.schema.type.OntologyDiscoveryContext;
import org.openmetadata.schema.type.OntologyDiscoveryEvidence;
import org.openmetadata.schema.type.OntologyVerificationProvider;

class OntologyDiscoveryFingerprintTest {
  private static final String TARGET_ONTOLOGY = "Customer Ontology";
  private static final String EXPECTED =
      "b169fc559a62d5ce5c5bb0eb106b6d9fac63b876dbdbe46820a03d5f58db3bfd";

  @Test
  void derivesTheAgentContractIndependentOfEvidenceAndSignalOrder() {
    final OntologyDiscoveryContext context = context();

    assertEquals(EXPECTED, OntologyDiscoveryFingerprint.derive(TARGET_ONTOLOGY, context));

    context.setEvidence(context.getEvidence().reversed());
    assertEquals(EXPECTED, OntologyDiscoveryFingerprint.derive(TARGET_ONTOLOGY, context));
  }

  @Test
  void rejectsCallerSuppliedAndReplacementOperationFingerprints() {
    final OntologyDiscoveryContext context = context().withEvidenceFingerprint("a".repeat(64));
    assertThrows(
        BadRequestException.class,
        () -> OntologyDiscoveryFingerprint.requireMatch(TARGET_ONTOLOGY, context));

    context.setEvidenceFingerprint(EXPECTED);
    final OntologyChangeSet changeSet =
        new OntologyChangeSet()
            .withGlossaries(List.of(new EntityReference().withFullyQualifiedName(TARGET_ONTOLOGY)))
            .withDiscoveryContext(context)
            .withOperations(
                List.of(
                    new OntologyChangeOperation()
                        .withId(UUID.randomUUID())
                        .withOperationType(OntologyChangeOperationType.CREATE_RELATIONSHIP_TYPE)
                        .withEvidenceFingerprint("c".repeat(64))))
            .withUndoCursor(1);

    assertThrows(
        BadRequestException.class,
        () -> OntologyChangeSetValidator.normalizeAndValidate(changeSet));
  }

  private static OntologyDiscoveryContext context() {
    return new OntologyDiscoveryContext()
        .withServiceFqn(" Snowflake.Prod ")
        .withAutomationId(UUID.randomUUID())
        .withConversationId(UUID.randomUUID())
        .withVerificationProvider(OntologyVerificationProvider.LAYA)
        .withVerificationModelId("convaiinnovations/laya@abc")
        .withRuleVersion("ontology-discovery-v2")
        .withEvidence(
            List.of(
                new OntologyDiscoveryEvidence()
                    .withEntityType("Table")
                    .withFullyQualifiedName("Snowflake.Prod.DB.Public.Customers")
                    .withSourceVersion(1.3)
                    .withUpdatedAt(1_720_000_000_000L)
                    .withSourceRunId(" Run-2 ")
                    .withSignals(Set.of("Source-Local-Laya", " Profiled  Column")),
                new OntologyDiscoveryEvidence()
                    .withEntityType("column")
                    .withFullyQualifiedName("Snowflake.Prod.DB.Public.Customers.Email")));
  }
}

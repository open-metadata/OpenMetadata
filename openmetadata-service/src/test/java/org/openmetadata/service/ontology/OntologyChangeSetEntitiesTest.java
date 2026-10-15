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

import java.util.List;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.entity.data.GlossaryTerm;
import org.openmetadata.schema.entity.data.OntologyAxiom;
import org.openmetadata.schema.entity.data.OntologyChangeSet;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.OntologyChangeApplicationResult;
import org.openmetadata.schema.type.OntologyChangeOperation;
import org.openmetadata.schema.type.OntologyChangeOperationResult;
import org.openmetadata.schema.type.OntologyChangeOperationResultStatus;
import org.openmetadata.schema.type.OntologyChangeOperationState;
import org.openmetadata.schema.type.OntologyChangeOperationType;
import org.openmetadata.service.Entity;

class OntologyChangeSetEntitiesTest {
  @Test
  void collectsTheAxiomsAndTermsWhoseGraphsAChangeSetChanges() {
    final UUID axiom = UUID.randomUUID();
    final UUID createdTerm = UUID.randomUUID();
    final UUID attributeTerm = UUID.randomUUID();
    final UUID appliedAxiom = UUID.randomUUID();
    final OntologyChangeSet changeSet =
        new OntologyChangeSet()
            .withOperations(
                List.of(
                    operation(OntologyChangeOperationType.UPSERT_AXIOM)
                        .withAxiom(new OntologyAxiom().withId(axiom)),
                    operation(OntologyChangeOperationType.CREATE_TERM)
                        .withTerm(new GlossaryTerm().withId(createdTerm)),
                    operation(OntologyChangeOperationType.UPSERT_ATTRIBUTE)
                        .withTargetId(attributeTerm),
                    operation(OntologyChangeOperationType.ADD_RELATIONSHIP)
                        .withTargetId(UUID.randomUUID()),
                    operation(OntologyChangeOperationType.DELETE_AXIOM)
                        .withTargetId(UUID.randomUUID()),
                    operation(OntologyChangeOperationType.UPSERT_AXIOM)
                        .withState(OntologyChangeOperationState.UNDONE)
                        .withAxiom(new OntologyAxiom().withId(UUID.randomUUID()))))
            .withApplicationResult(
                new OntologyChangeApplicationResult()
                    .withResults(
                        List.of(
                            applied(Entity.ONTOLOGY_AXIOM, appliedAxiom),
                            applied(Entity.GLOSSARY, UUID.randomUUID()),
                            new OntologyChangeOperationResult()
                                .withOperationId(UUID.randomUUID())
                                .withStatus(OntologyChangeOperationResultStatus.FAILED)
                                .withEntity(
                                    new EntityReference()
                                        .withId(UUID.randomUUID())
                                        .withType(Entity.GLOSSARY_TERM)))));

    assertEquals(
        Set.of(axiom, createdTerm, attributeTerm, appliedAxiom),
        OntologyChangeSetEntities.of(changeSet),
        "relationship and deletion operations, undone ones, failures and glossaries add nothing");
  }

  private static OntologyChangeOperation operation(final OntologyChangeOperationType type) {
    return new OntologyChangeOperation()
        .withId(UUID.randomUUID())
        .withOperationType(type)
        .withState(OntologyChangeOperationState.ACTIVE);
  }

  private static OntologyChangeOperationResult applied(final String entityType, final UUID id) {
    return new OntologyChangeOperationResult()
        .withOperationId(UUID.randomUUID())
        .withStatus(OntologyChangeOperationResultStatus.APPLIED)
        .withEntity(new EntityReference().withId(id).withType(entityType));
  }
}

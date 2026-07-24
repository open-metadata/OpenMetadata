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

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertThrows;

import jakarta.ws.rs.BadRequestException;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.entity.data.GlossaryTerm;
import org.openmetadata.schema.entity.data.OntologyChangeSet;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.OntologyChangeOperation;
import org.openmetadata.schema.type.OntologyChangeOperationType;
import org.openmetadata.schema.type.OntologyRelationship;

class OntologyChangePreflightTest {
  @Test
  void acceptsScopedTargetAtExpectedVersion() {
    final UUID glossaryId = UUID.randomUUID();
    final GlossaryTerm stored = storedTerm(glossaryId, 0.3);
    final OntologyChangeOperation operation = updateOperation(stored, 0.3);
    final OntologyChangePreflight preflight =
        new OntologyChangePreflight((entityType, id) -> stored);

    assertDoesNotThrow(() -> preflight.validate(changeSet(glossaryId), List.of(operation)));
  }

  @Test
  void rejectsOutOfScopeAndStaleTargets() {
    final UUID glossaryId = UUID.randomUUID();
    final GlossaryTerm stored = storedTerm(UUID.randomUUID(), 0.4);
    final OntologyChangeOperation operation = updateOperation(stored, 0.3);
    final OntologyChangePreflight preflight =
        new OntologyChangePreflight((entityType, id) -> stored);

    assertThrows(
        BadRequestException.class,
        () -> preflight.validate(changeSet(glossaryId), List.of(operation)));

    stored.setGlossary(new EntityReference().withId(glossaryId));
    assertThrows(
        BadRequestException.class,
        () -> preflight.validate(changeSet(glossaryId), List.of(operation)));
  }

  @Test
  void acceptsRelationshipsBetweenTermsCreatedEarlierInTheSamePlan() {
    final UUID glossaryId = UUID.randomUUID();
    final GlossaryTerm source = storedTerm(glossaryId, null);
    final GlossaryTerm target = storedTerm(glossaryId, null);
    final OntologyChangeOperation createSource = createOperation(source);
    final OntologyChangeOperation createTarget = createOperation(target);
    final OntologyChangeOperation relationship = relationshipOperation(source, target);
    final OntologyChangePreflight preflight =
        new OntologyChangePreflight(
            (entityType, id) -> {
              throw new AssertionError("Planned terms must not be loaded from persistence");
            });

    assertDoesNotThrow(
        () ->
            preflight.validate(
                changeSet(glossaryId), List.of(createSource, createTarget, relationship)));
  }

  @Test
  void rejectsConflictingBaseVersionsForOneStoredTarget() {
    final UUID glossaryId = UUID.randomUUID();
    final GlossaryTerm stored = storedTerm(glossaryId, 0.3);
    final OntologyChangeOperation first = updateOperation(stored, 0.3);
    final OntologyChangeOperation second = updateOperation(stored, 0.4);
    final OntologyChangePreflight preflight =
        new OntologyChangePreflight((entityType, id) -> stored);

    assertThrows(
        BadRequestException.class,
        () -> preflight.validate(changeSet(glossaryId), List.of(first, second)));
  }

  private static OntologyChangeSet changeSet(final UUID glossaryId) {
    return new OntologyChangeSet()
        .withGlossaries(List.of(new EntityReference().withId(glossaryId)));
  }

  private static OntologyChangeOperation createOperation(final GlossaryTerm term) {
    return new OntologyChangeOperation()
        .withId(UUID.randomUUID())
        .withOperationType(OntologyChangeOperationType.CREATE_TERM)
        .withTerm(term);
  }

  private static OntologyChangeOperation relationshipOperation(
      final GlossaryTerm source, final GlossaryTerm target) {
    final OntologyRelationship relationship =
        new OntologyRelationship()
            .withFromTerm(source.getEntityReference())
            .withToTerm(target.getEntityReference());
    return new OntologyChangeOperation()
        .withId(UUID.randomUUID())
        .withOperationType(OntologyChangeOperationType.ADD_RELATIONSHIP)
        .withTargetId(source.getId())
        .withRelationship(relationship);
  }

  private static OntologyChangeOperation updateOperation(
      final GlossaryTerm term, final double baseVersion) {
    return new OntologyChangeOperation()
        .withId(UUID.randomUUID())
        .withOperationType(OntologyChangeOperationType.UPDATE_TERM)
        .withTargetId(term.getId())
        .withBaseVersion(baseVersion)
        .withTerm(term);
  }

  private static GlossaryTerm storedTerm(final UUID glossaryId, final Double version) {
    return new GlossaryTerm()
        .withId(UUID.randomUUID())
        .withName("Customer")
        .withGlossary(new EntityReference().withId(glossaryId))
        .withVersion(version);
  }
}

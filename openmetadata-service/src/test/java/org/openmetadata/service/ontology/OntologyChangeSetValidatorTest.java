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
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import jakarta.ws.rs.BadRequestException;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.entity.data.GlossaryTerm;
import org.openmetadata.schema.entity.data.OntologyChangeSet;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.OntologyChangeOperation;
import org.openmetadata.schema.type.OntologyChangeOperationState;
import org.openmetadata.schema.type.OntologyChangeOperationType;
import org.openmetadata.schema.type.OntologyRelationship;

class OntologyChangeSetValidatorTest {
  @Test
  void normalizesActiveAndUndoneOperationsAtCursor() {
    final OntologyChangeOperation create = createTermOperation();
    final OntologyChangeOperation delete = deleteTermOperation(create.getTerm().getId(), null);
    final OntologyChangeSet changeSet =
        new OntologyChangeSet().withOperations(List.of(create, delete)).withUndoCursor(1);

    OntologyChangeSetValidator.normalizeAndValidate(changeSet);

    assertEquals(OntologyChangeOperationState.ACTIVE, create.getState());
    assertEquals(OntologyChangeOperationState.UNDONE, delete.getState());
    assertThrows(
        UnsupportedOperationException.class,
        () -> changeSet.getOperations().add(createTermOperation()));
  }

  @Test
  void rejectsDuplicateOperationIdsAndCursorOutsideTimeline() {
    final OntologyChangeOperation first = createTermOperation();
    final OntologyChangeOperation duplicate = createTermOperation().withId(first.getId());
    final OntologyChangeSet duplicateIds =
        new OntologyChangeSet().withOperations(List.of(first, duplicate)).withUndoCursor(2);
    final OntologyChangeSet invalidCursor =
        new OntologyChangeSet().withOperations(List.of(first)).withUndoCursor(2);

    assertThrows(
        BadRequestException.class,
        () -> OntologyChangeSetValidator.normalizeAndValidate(duplicateIds));
    assertThrows(
        BadRequestException.class,
        () -> OntologyChangeSetValidator.normalizeAndValidate(invalidCursor));
  }

  @Test
  void rejectsWrongPayloadAndOptimisticGuard() {
    final OntologyChangeOperation deleteWithPayload =
        deleteTermOperation(UUID.randomUUID(), 0.1).withTerm(term());
    final OntologyChangeOperation updateWithoutVersion =
        new OntologyChangeOperation()
            .withId(UUID.randomUUID())
            .withOperationType(OntologyChangeOperationType.UPDATE_TERM)
            .withTargetId(UUID.randomUUID())
            .withTerm(term());

    assertInvalid(deleteWithPayload);
    assertInvalid(updateWithoutVersion);
  }

  @Test
  void rejectsMismatchedUpdateTarget() {
    final OntologyChangeOperation operation =
        new OntologyChangeOperation()
            .withId(UUID.randomUUID())
            .withOperationType(OntologyChangeOperationType.UPDATE_TERM)
            .withTargetId(UUID.randomUUID())
            .withBaseVersion(0.1)
            .withTerm(term());

    assertInvalid(operation);
  }

  @Test
  void allowsReferencesOnlyAfterTheirPlannedTermsAreCreated() {
    final OntologyChangeOperation source = createTermOperation();
    final OntologyChangeOperation target = createTermOperation();
    final OntologyChangeOperation relationship = relationshipOperation(source, target);
    final OntologyChangeSet ordered =
        new OntologyChangeSet()
            .withOperations(List.of(source, target, relationship))
            .withUndoCursor(3);
    final OntologyChangeSet forwardReference =
        new OntologyChangeSet()
            .withOperations(List.of(source, relationship, target))
            .withUndoCursor(3);

    assertDoesNotThrow(() -> OntologyChangeSetValidator.normalizeAndValidate(ordered));
    assertThrows(
        BadRequestException.class,
        () -> OntologyChangeSetValidator.normalizeAndValidate(forwardReference));
  }

  private static void assertInvalid(final OntologyChangeOperation operation) {
    final OntologyChangeSet changeSet =
        new OntologyChangeSet().withOperations(List.of(operation)).withUndoCursor(1);
    assertThrows(
        BadRequestException.class,
        () -> OntologyChangeSetValidator.normalizeAndValidate(changeSet));
  }

  private static OntologyChangeOperation createTermOperation() {
    return new OntologyChangeOperation()
        .withId(UUID.randomUUID())
        .withOperationType(OntologyChangeOperationType.CREATE_TERM)
        .withTerm(term());
  }

  private static OntologyChangeOperation deleteTermOperation(
      final UUID targetId, final Double version) {
    return new OntologyChangeOperation()
        .withId(UUID.randomUUID())
        .withOperationType(OntologyChangeOperationType.DELETE_TERM)
        .withTargetId(targetId)
        .withBaseVersion(version);
  }

  private static OntologyChangeOperation relationshipOperation(
      final OntologyChangeOperation source, final OntologyChangeOperation target) {
    final OntologyRelationship relationship =
        new OntologyRelationship()
            .withFromTerm(source.getTerm().getEntityReference())
            .withToTerm(target.getTerm().getEntityReference());
    return new OntologyChangeOperation()
        .withId(UUID.randomUUID())
        .withOperationType(OntologyChangeOperationType.ADD_RELATIONSHIP)
        .withTargetId(source.getTerm().getId())
        .withRelationship(relationship);
  }

  private static GlossaryTerm term() {
    return new GlossaryTerm()
        .withId(UUID.randomUUID())
        .withName("Customer")
        .withGlossary(new EntityReference().withId(UUID.randomUUID()).withType("glossary"));
  }
}

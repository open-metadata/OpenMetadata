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

import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;

import jakarta.ws.rs.BadRequestException;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import org.openmetadata.schema.entity.data.OntologyChangeSet;
import org.openmetadata.schema.type.OntologyChangeOperation;
import org.openmetadata.schema.type.OntologyChangeOperationState;
import org.openmetadata.schema.type.OntologyChangeOperationType;

public final class OntologyChangeSetValidator {
  private OntologyChangeSetValidator() {}

  public static void normalizeAndValidate(final OntologyChangeSet changeSet) {
    final List<OntologyChangeOperation> operations =
        List.copyOf(listOrEmpty(changeSet.getOperations()));
    final int cursor =
        changeSet.getUndoCursor() == null ? operations.size() : changeSet.getUndoCursor();
    if (cursor < 0 || cursor > operations.size()) {
      throw new BadRequestException(
          "Ontology change set undoCursor must be between 0 and " + operations.size());
    }
    final String evidenceFingerprint = validateDiscoveryContext(changeSet);
    validateOperations(operations, cursor, plannedTermIds(operations), evidenceFingerprint);
    changeSet.setOperations(operations);
    changeSet.setUndoCursor(cursor);
  }

  private static void validateOperations(
      final List<OntologyChangeOperation> operations,
      final int cursor,
      final Set<UUID> plannedTermIds,
      final String evidenceFingerprint) {
    final Set<UUID> operationIds = new HashSet<>();
    final Set<UUID> availablePlannedTerms = new HashSet<>();
    for (int index = 0; index < operations.size(); index++) {
      final OntologyChangeOperation operation = operations.get(index);
      validateOperation(
          operation, operationIds, plannedTermIds, availablePlannedTerms, evidenceFingerprint);
      operation.setState(
          index < cursor
              ? OntologyChangeOperationState.ACTIVE
              : OntologyChangeOperationState.UNDONE);
      makeCreatedTermAvailable(operation, availablePlannedTerms);
    }
  }

  private static void validateOperation(
      final OntologyChangeOperation operation,
      final Set<UUID> operationIds,
      final Set<UUID> plannedTermIds,
      final Set<UUID> availablePlannedTerms,
      final String evidenceFingerprint) {
    if (operation == null || operation.getId() == null || !operationIds.add(operation.getId())) {
      throw new BadRequestException("Every ontology operation requires a unique id");
    }
    if (operation.getOperationType() == null) {
      throw invalid(operation, "operationType is required");
    }
    if (evidenceFingerprint != null
        && !evidenceFingerprint.equals(operation.getEvidenceFingerprint())) {
      throw invalid(operation, "evidenceFingerprint must match the immutable discovery context");
    }
    final PayloadKind expectedPayload = payloadKind(operation.getOperationType());
    validatePayload(operation, expectedPayload);
    validateOptimisticGuard(operation, plannedTermIds);
    validateTargetConsistency(operation);
    validatePlannedReferences(operation, plannedTermIds, availablePlannedTerms);
  }

  private static String validateDiscoveryContext(final OntologyChangeSet changeSet) {
    if (changeSet.getDiscoveryContext() == null) {
      return null;
    }
    final List<org.openmetadata.schema.type.EntityReference> glossaries =
        listOrEmpty(changeSet.getGlossaries());
    if (glossaries.size() != 1) {
      throw new BadRequestException(
          "An automated ontology discovery draft must target exactly one glossary");
    }
    final org.openmetadata.schema.type.EntityReference glossary = glossaries.getFirst();
    final String targetOntology =
        glossary.getFullyQualifiedName() == null
            ? glossary.getName()
            : glossary.getFullyQualifiedName();
    OntologyDiscoveryFingerprint.requireMatch(targetOntology, changeSet.getDiscoveryContext());
    return changeSet.getDiscoveryContext().getEvidenceFingerprint();
  }

  private static Set<UUID> plannedTermIds(final List<OntologyChangeOperation> operations) {
    final Set<UUID> termIds = new HashSet<>();
    for (final OntologyChangeOperation operation : operations) {
      if (isCompleteCreateTerm(operation) && !termIds.add(operation.getTerm().getId())) {
        throw invalid(operation, "term id is created more than once");
      }
    }
    return Set.copyOf(termIds);
  }

  private static boolean isCompleteCreateTerm(final OntologyChangeOperation operation) {
    return operation != null
        && operation.getOperationType() == OntologyChangeOperationType.CREATE_TERM
        && operation.getTerm() != null
        && operation.getTerm().getId() != null;
  }

  private static void validatePayload(
      final OntologyChangeOperation operation, final PayloadKind expectedPayload) {
    final int payloadCount = payloadCount(operation);
    final boolean isValid =
        expectedPayload == PayloadKind.NONE
            ? payloadCount == 0
            : payloadCount == 1 && hasPayload(operation, expectedPayload);
    if (!isValid) {
      throw invalid(operation, payloadRequirement(operation.getOperationType(), expectedPayload));
    }
  }

  private static String payloadRequirement(
      final OntologyChangeOperationType operationType, final PayloadKind payloadKind) {
    final String requirement =
        payloadKind == PayloadKind.NONE
            ? "operation " + operationType + " does not accept a payload"
            : "operation " + operationType + " requires exactly one " + payloadKind;
    return requirement;
  }

  private static int payloadCount(final OntologyChangeOperation operation) {
    int count = operation.getTerm() == null ? 0 : 1;
    count += operation.getRelationship() == null ? 0 : 1;
    count += operation.getAttribute() == null ? 0 : 1;
    count += operation.getMapping() == null ? 0 : 1;
    count += operation.getAxiom() == null ? 0 : 1;
    count += operation.getAssetBinding() == null ? 0 : 1;
    count += operation.getRelationshipType() == null ? 0 : 1;
    return count;
  }

  private static boolean hasPayload(
      final OntologyChangeOperation operation, final PayloadKind payloadKind) {
    final boolean isPresent =
        switch (payloadKind) {
          case NONE -> false;
          case TERM -> operation.getTerm() != null;
          case RELATIONSHIP -> operation.getRelationship() != null;
          case ATTRIBUTE -> operation.getAttribute() != null;
          case MAPPING -> operation.getMapping() != null;
          case AXIOM -> operation.getAxiom() != null;
          case ASSET_BINDING -> operation.getAssetBinding() != null;
          case RELATIONSHIP_TYPE -> operation.getRelationshipType() != null;
        };
    return isPresent;
  }

  private static void validateOptimisticGuard(
      final OntologyChangeOperation operation, final Set<UUID> plannedTermIds) {
    final boolean isCreate =
        operation.getOperationType() == OntologyChangeOperationType.CREATE_TERM
            || operation.getOperationType() == OntologyChangeOperationType.CREATE_RELATIONSHIP_TYPE
            || (operation.getOperationType() == OntologyChangeOperationType.UPSERT_AXIOM
                && operation.getTargetId() == null);
    final boolean targetsPlannedTerm =
        operation.getTargetId() != null && plannedTermIds.contains(operation.getTargetId());
    if (isCreate && (operation.getTargetId() != null || operation.getBaseVersion() != null)) {
      throw invalid(operation, "targetId and baseVersion must be absent for create operations");
    }
    if (!isCreate && operation.getTargetId() == null) {
      throw invalid(operation, "targetId is required for non-create operations");
    }
    if (!isCreate && targetsPlannedTerm && operation.getBaseVersion() != null) {
      throw invalid(operation, "baseVersion must be absent for a term created in this change set");
    }
    if (!isCreate && !targetsPlannedTerm && operation.getBaseVersion() == null) {
      throw invalid(operation, "baseVersion is required for an existing target");
    }
  }

  private static void validatePlannedReferences(
      final OntologyChangeOperation operation,
      final Set<UUID> plannedTermIds,
      final Set<UUID> availablePlannedTerms) {
    requirePlannedTermAvailable(
        operation, operation.getTargetId(), plannedTermIds, availablePlannedTerms);
    if (operation.getRelationship() != null) {
      requirePlannedTermAvailable(
          operation,
          operation.getRelationship().getFromTerm().getId(),
          plannedTermIds,
          availablePlannedTerms);
      requirePlannedTermAvailable(
          operation,
          operation.getRelationship().getToTerm().getId(),
          plannedTermIds,
          availablePlannedTerms);
    }
    if (operation.getTerm() != null && operation.getTerm().getParent() != null) {
      requirePlannedTermAvailable(
          operation,
          operation.getTerm().getParent().getId(),
          plannedTermIds,
          availablePlannedTerms);
    }
  }

  private static void requirePlannedTermAvailable(
      final OntologyChangeOperation operation,
      final UUID termId,
      final Set<UUID> plannedTermIds,
      final Set<UUID> availablePlannedTerms) {
    if (termId != null
        && plannedTermIds.contains(termId)
        && !availablePlannedTerms.contains(termId)) {
      throw invalid(operation, "a referenced term must be created by an earlier operation");
    }
  }

  private static void makeCreatedTermAvailable(
      final OntologyChangeOperation operation, final Set<UUID> availablePlannedTerms) {
    if (isCompleteCreateTerm(operation)) {
      availablePlannedTerms.add(operation.getTerm().getId());
    }
  }

  private static void validateTargetConsistency(final OntologyChangeOperation operation) {
    switch (operation.getOperationType()) {
      case CREATE_TERM -> requireEntityId(operation, operation.getTerm().getId(), "term");
      case UPDATE_TERM -> requireTarget(operation, operation.getTerm().getId(), "updated term");
      case ADD_RELATIONSHIP, UPDATE_RELATIONSHIP, DELETE_RELATIONSHIP -> requireTarget(
          operation, operation.getRelationship().getFromTerm().getId(), "relationship source");
      case UPSERT_AXIOM -> validateAxiomTarget(operation);
      case CREATE_RELATIONSHIP_TYPE -> requireEntityId(
          operation, operation.getRelationshipType().getId(), "relationship type");
      case BIND_ASSET, UNBIND_ASSET -> {
        requireEntityId(operation, operation.getTargetId(), "asset binding target term");
        requireEntityId(
            operation,
            operation.getAssetBinding().getAsset() == null
                ? null
                : operation.getAssetBinding().getAsset().getId(),
            "asset binding asset");
      }
      case DELETE_TERM,
          UPSERT_ATTRIBUTE,
          DELETE_ATTRIBUTE,
          UPSERT_MAPPING,
          DELETE_MAPPING,
          DELETE_AXIOM -> {}
    }
  }

  private static void validateAxiomTarget(final OntologyChangeOperation operation) {
    requireEntityId(operation, operation.getAxiom().getId(), "axiom");
    if (operation.getTargetId() != null) {
      requireTarget(operation, operation.getAxiom().getId(), "updated axiom");
    }
  }

  private static void requireTarget(
      final OntologyChangeOperation operation, final UUID entityId, final String targetName) {
    requireEntityId(operation, entityId, targetName);
    if (!operation.getTargetId().equals(entityId)) {
      throw invalid(operation, "targetId must match the " + targetName + " id");
    }
  }

  private static void requireEntityId(
      final OntologyChangeOperation operation, final UUID entityId, final String entityName) {
    if (entityId == null) {
      throw invalid(operation, entityName + " id is required");
    }
  }

  private static PayloadKind payloadKind(final OntologyChangeOperationType operationType) {
    final PayloadKind payloadKind =
        switch (operationType) {
          case CREATE_TERM, UPDATE_TERM -> PayloadKind.TERM;
          case DELETE_TERM, DELETE_AXIOM -> PayloadKind.NONE;
          case ADD_RELATIONSHIP, UPDATE_RELATIONSHIP, DELETE_RELATIONSHIP -> PayloadKind
              .RELATIONSHIP;
          case UPSERT_ATTRIBUTE, DELETE_ATTRIBUTE -> PayloadKind.ATTRIBUTE;
          case UPSERT_MAPPING, DELETE_MAPPING -> PayloadKind.MAPPING;
          case UPSERT_AXIOM -> PayloadKind.AXIOM;
          case BIND_ASSET, UNBIND_ASSET -> PayloadKind.ASSET_BINDING;
          case CREATE_RELATIONSHIP_TYPE -> PayloadKind.RELATIONSHIP_TYPE;
        };
    return payloadKind;
  }

  private static BadRequestException invalid(
      final OntologyChangeOperation operation, final String message) {
    return new BadRequestException(
        "Ontology operation '" + operation.getId() + "' is invalid: " + message);
  }

  private enum PayloadKind {
    NONE,
    TERM,
    RELATIONSHIP,
    ATTRIBUTE,
    MAPPING,
    AXIOM,
    ASSET_BINDING,
    RELATIONSHIP_TYPE
  }
}

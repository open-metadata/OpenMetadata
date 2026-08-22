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
import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;

import jakarta.ws.rs.BadRequestException;
import java.time.Clock;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import org.openmetadata.schema.entity.data.GlossaryTerm;
import org.openmetadata.schema.entity.data.RelationshipType;
import org.openmetadata.schema.type.EntityStatus;
import org.openmetadata.schema.type.OntologyChangeOperation;
import org.openmetadata.schema.type.OntologyChangeOperationState;
import org.openmetadata.schema.type.OntologyChangeOperationType;
import org.openmetadata.schema.type.OntologyRelationship;
import org.openmetadata.schema.type.OntologyStructuralRelationship;
import org.openmetadata.schema.type.RelationProvenance;
import org.openmetadata.schema.type.TermRelation;

final class OntologyStructuralRelationshipMerger {
  private final RelationshipTypeResolver relationshipTypes;
  private final Clock clock;

  OntologyStructuralRelationshipMerger(
      final RelationshipTypeResolver relationshipTypes, final Clock clock) {
    this.relationshipTypes = relationshipTypes;
    this.clock = clock;
  }

  void merge(
      final GlossaryTerm target,
      final List<OntologyStructuralRelationship> desired,
      final List<GlossaryTerm> context,
      final String user,
      final Accumulator accumulator) {
    deleteMissingRelationships(target, desired, context, user, accumulator);
    addMissingRelationships(target, desired, context, user, accumulator);
  }

  private void deleteMissingRelationships(
      final GlossaryTerm target,
      final List<OntologyStructuralRelationship> desired,
      final List<GlossaryTerm> context,
      final String user,
      final Accumulator accumulator) {
    for (final TermRelation relation : listOrEmpty(target.getRelatedTerms())) {
      if (isMissingAssertedRelationship(relation, desired, context)) {
        final RelationshipType type = relationshipTypes.require(relationTypeName(relation));
        addOperation(deleteOperation(target, relation, type, user), type, accumulator);
      }
    }
  }

  private static boolean isMissingAssertedRelationship(
      final TermRelation relation,
      final List<OntologyStructuralRelationship> desired,
      final List<GlossaryTerm> context) {
    return OntologyTermStructureMapper.isAsserted(relation)
        && !desired.contains(OntologyTermStructureMapper.subsetRelationship(relation, context));
  }

  private void addMissingRelationships(
      final GlossaryTerm target,
      final List<OntologyStructuralRelationship> desired,
      final List<GlossaryTerm> context,
      final String user,
      final Accumulator accumulator) {
    final List<OntologyStructuralRelationship> current =
        OntologyTermStructureMapper.subsetStructure(target, context).getRelationships();
    for (final OntologyStructuralRelationship relationship : desired) {
      if (!current.contains(relationship)) {
        addRelationship(target, relationship, context, user, accumulator);
      }
    }
  }

  private void addRelationship(
      final GlossaryTerm target,
      final OntologyStructuralRelationship relationship,
      final List<GlossaryTerm> context,
      final String user,
      final Accumulator accumulator) {
    final GlossaryTerm related =
        OntologyStructuralTermContext.requireTargetForSource(
            context, relationship.getTargetSourceTermId());
    final RelationshipType type =
        relationshipTypes.require(relationship.getRelationshipType().getName());
    addOperation(addOperation(target, related, type, user), type, accumulator);
  }

  private static void addOperation(
      final OntologyChangeOperation operation,
      final RelationshipType type,
      final Accumulator accumulator) {
    final RelationshipMutationKey key = mutationKey(operation, type);
    if (accumulator.keys().add(key)) {
      accumulator.operations().add(operation);
    }
  }

  private OntologyChangeOperation deleteOperation(
      final GlossaryTerm target,
      final TermRelation relation,
      final RelationshipType type,
      final String user) {
    final OntologyRelationship relationship =
        new OntologyRelationship()
            .withId(relation.getId() == null ? UUID.randomUUID() : relation.getId())
            .withFromTerm(target.getEntityReference())
            .withToTerm(relation.getTerm())
            .withRelationshipType(type.getEntityReference())
            .withProvenance(provenance(relation))
            .withStatus(status(relation))
            .withCreatedBy(relation.getCreatedBy() == null ? user : relation.getCreatedBy())
            .withCreatedAt(
                relation.getCreatedAt() == null ? clock.millis() : relation.getCreatedAt());
    return operation(OntologyChangeOperationType.DELETE_RELATIONSHIP, target, relationship);
  }

  private OntologyChangeOperation addOperation(
      final GlossaryTerm target,
      final GlossaryTerm related,
      final RelationshipType type,
      final String user) {
    final OntologyRelationship relationship =
        new OntologyRelationship()
            .withId(UUID.randomUUID())
            .withFromTerm(target.getEntityReference())
            .withToTerm(related.getEntityReference())
            .withRelationshipType(type.getEntityReference())
            .withProvenance(RelationProvenance.IMPORTED)
            .withStatus(EntityStatus.DRAFT)
            .withCreatedBy(user)
            .withCreatedAt(clock.millis());
    return operation(OntologyChangeOperationType.ADD_RELATIONSHIP, target, relationship);
  }

  private static OntologyChangeOperation operation(
      final OntologyChangeOperationType operationType,
      final GlossaryTerm target,
      final OntologyRelationship relationship) {
    return new OntologyChangeOperation()
        .withId(UUID.randomUUID())
        .withOperationType(operationType)
        .withTargetId(target.getId())
        .withBaseVersion(target.getVersion())
        .withRelationship(relationship)
        .withState(OntologyChangeOperationState.ACTIVE);
  }

  private static String relationTypeName(final TermRelation relation) {
    final String name =
        relation.getRelationshipType() == null
            ? relation.getRelationType()
            : relation.getRelationshipType().getName();
    if (nullOrEmpty(name) || name.isBlank()) {
      throw new BadRequestException("Structural relationship is missing its registered type");
    }
    return name;
  }

  private static RelationProvenance provenance(final TermRelation relation) {
    final RelationProvenance provenance =
        relation.getProvenance() == null ? RelationProvenance.MANUAL : relation.getProvenance();
    return provenance;
  }

  private static EntityStatus status(final TermRelation relation) {
    final EntityStatus status =
        relation.getStatus() == null ? EntityStatus.DRAFT : relation.getStatus();
    return status;
  }

  private static RelationshipMutationKey mutationKey(
      final OntologyChangeOperation operation, final RelationshipType type) {
    final OntologyRelationship relationship = operation.getRelationship();
    final UUID first =
        minimum(relationship.getFromTerm().getId(), relationship.getToTerm().getId());
    final UUID second =
        maximum(relationship.getFromTerm().getId(), relationship.getToTerm().getId());
    return new RelationshipMutationKey(
        operation.getOperationType(), first, second, canonicalName(type));
  }

  private static String canonicalName(final RelationshipType type) {
    final String inverseName = type.getInverse() == null ? null : type.getInverse().getName();
    final String canonical =
        inverseName == null || type.getName().compareTo(inverseName) <= 0
            ? type.getName()
            : inverseName;
    return canonical;
  }

  private static UUID minimum(final UUID first, final UUID second) {
    return first.compareTo(second) <= 0 ? first : second;
  }

  private static UUID maximum(final UUID first, final UUID second) {
    return first.compareTo(second) >= 0 ? first : second;
  }

  record Accumulator(List<OntologyChangeOperation> operations, Set<RelationshipMutationKey> keys) {
    static Accumulator empty() {
      return new Accumulator(new ArrayList<>(), new HashSet<>());
    }
  }

  private record RelationshipMutationKey(
      OntologyChangeOperationType operationType,
      UUID firstTermId,
      UUID secondTermId,
      String canonicalType) {}
}

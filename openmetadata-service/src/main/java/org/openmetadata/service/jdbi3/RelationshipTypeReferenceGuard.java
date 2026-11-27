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

package org.openmetadata.service.jdbi3;

import jakarta.ws.rs.BadRequestException;
import java.util.Collection;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import java.util.stream.Stream;
import org.openmetadata.schema.entity.data.RelationshipType;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.EventType;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.ontology.RelationshipTypeReferenceNames;
import org.openmetadata.service.ontology.RelationshipTypeReferences;
import org.openmetadata.service.ontology.RelationshipTypeReferences.PartnerUse;
import org.openmetadata.service.ontology.RelationshipTypeReferences.Reference;
import org.openmetadata.service.util.PostCommitActionQueue;

/**
 * Keeps the references between relationship types readable through deletes and restores: a type
 * still in use is not deleted, an inverse back-link is cleared with the delete, and a restored type
 * is left either paired or without an inverse
 * (ADR:2026-11-18-a-relationship-type-in-use-cannot-be-deleted).
 */
final class RelationshipTypeReferenceGuard {
  private final RelationshipTypeRepository repository;
  private final CollectionDAO daoCollection;

  RelationshipTypeReferenceGuard(final RelationshipTypeRepository repository) {
    this.repository = repository;
    this.daoCollection = repository.getDaoCollection();
  }

  /** Clears the inverse back-links a delete of {@code entity} may clear, once nothing else uses it. */
  void beforeDelete(final RelationshipType entity, final String deletedBy) {
    requireRemovable(entity, listIncludingDeleted(), Set.of())
        .forEach(partner -> changeInverse(partner, null, deletedBy));
  }

  /** A reference to a soft-deleted type would leave every read through it failing. */
  void rejectDeletedReferences(final RelationshipType entity) {
    for (final Reference reference : RelationshipTypeReferences.heldBy(entity)) {
      final RelationshipType target = findReferenced(reference.target());
      if (target != null && Boolean.TRUE.equals(target.getDeleted())) {
        throw new BadRequestException(
            "Relationship type '"
                + target.getName()
                + "' named in "
                + reference.field().jsonName()
                + " is deleted; restore it first");
      }
    }
  }

  private RelationshipType findReferenced(final EntityReference stored) {
    final EntityReference reference = RelationshipTypeReferenceNames.named(stored);
    final List<RelationshipType> byId =
        reference.getId() == null
            ? List.of()
            : daoCollection
                .relationshipTypeDAO()
                .findEntitiesByIds(List.of(reference.getId()), Include.ALL);
    final RelationshipType found =
        !byId.isEmpty() || reference.getFullyQualifiedName() == null
            ? byId.stream().findFirst().orElse(null)
            : repository.findByNameOrNull(reference.getFullyQualifiedName(), Include.ALL);
    return found == null ? null : RelationshipTypeReferenceNames.withNamedReferences(found);
  }

  /**
   * Rejects the delete while anything but an inverse back-link references {@code entity}, or a
   * relation is stored as it or as a partner whose back-link the delete would clear, and returns
   * those live partners. ADR:2026-11-18-a-relationship-type-in-use-cannot-be-deleted
   */
  private List<RelationshipType> requireRemovable(
      final RelationshipType entity,
      final List<RelationshipType> types,
      final Set<UUID> removedTogether) {
    final List<Reference> references =
        RelationshipTypeReferences.referencesTo(entity, types).stream()
            .filter(reference -> !removedTogether.contains(reference.owner().getId()))
            .toList();
    final List<Reference> blocking =
        references.stream().filter(reference -> !reference.isInverseBackLink()).toList();
    final List<RelationshipType> partners = livePartners(references);
    final List<PartnerUse> partnerUses = partnerUses(partners);
    final int relationCount = relationsStoredAs(entity);
    if (!blocking.isEmpty() || relationCount > 0 || !partnerUses.isEmpty()) {
      throw new BadRequestException(
          RelationshipTypeReferences.inUseMessage(entity, blocking, relationCount, partnerUses));
    }
    return partners;
  }

  /**
   * A soft-deleted partner keeps its back-link; restoring it unlinks the inverse when the deleted
   * type is gone.
   */
  private static List<RelationshipType> livePartners(final List<Reference> references) {
    return references.stream()
        .filter(Reference::isInverseBackLink)
        .map(Reference::owner)
        .filter(RelationshipTypeReferenceGuard::isLive)
        .toList();
  }

  private List<PartnerUse> partnerUses(final List<RelationshipType> partners) {
    return partners.stream()
        .map(partner -> new PartnerUse(partner.getName(), relationsStoredAs(partner)))
        .filter(use -> use.relationCount() > 0)
        .toList();
  }

  private int relationsStoredAs(final RelationshipType type) {
    return daoCollection
        .relationshipDAO()
        .countRelationsOfType(
            Entity.GLOSSARY_TERM, Relationship.RELATED_TO.ordinal(), type.getId(), type.getName());
  }

  private static boolean isLive(final RelationshipType type) {
    return type != null && !Boolean.TRUE.equals(type.getDeleted());
  }

  /**
   * Stores {@code type} with a new inverse as a versioned change that fails with 412 if the type
   * changed since it was read, and records it as a change event once the write commits.
   */
  private RelationshipType changeInverse(
      final RelationshipType type, final EntityReference inverse, final String updatedBy) {
    final RelationshipType updated =
        JsonUtils.deepCopy(type, RelationshipType.class).withInverse(inverse);
    updated.setUpdatedBy(updatedBy);
    updated.setUpdatedAt(System.currentTimeMillis());
    final EntityRepository<RelationshipType>.EntityUpdater updater =
        repository.getUpdater(type, updated, EntityRepository.Operation.PUT, null, true);
    updater.updateWithOptimisticLocking();
    updated.setChangeDescription(updater.getIncrementalChangeDescription());
    final EventType changeType = updater.getChangeType();
    PostCommitActionQueue.runOrDefer(
        () -> repository.storeChangeEventForAsyncOperation(updated, changeType, false, updatedBy));
    return updated;
  }

  /**
   * A restored type keeps its inverse only as one half of a pair, since a one-way link reads a
   * relation authored as this type from the higher term id back as its partner. A live partner with
   * no inverse and no stored relation is linked back; otherwise the restored type's inverse is
   * cleared, which changes no relation because a deleted type holds none.
   */
  void afterRestore(final RelationshipType entity) {
    final EntityReference inverse = RelationshipTypeReferenceNames.named(entity.getInverse());
    if (inverse != null && !RelationshipTypeReferences.refersTo(inverse, entity)) {
      final RelationshipType partner = findReferenced(inverse);
      if (isRelinkable(partner)) {
        changeInverse(partner, backLinkTo(entity), entity.getUpdatedBy());
      } else if (!isPairedWith(partner, entity)) {
        final RelationshipType unlinked = changeInverse(entity, null, entity.getUpdatedBy());
        entity
            .withInverse(null)
            .withVersion(unlinked.getVersion())
            .withChangeDescription(unlinked.getChangeDescription());
      }
    }
  }

  private static EntityReference backLinkTo(final RelationshipType restored) {
    return RelationshipTypeReferenceNames.referenceTo(restored);
  }

  /** The inverse {@code type} keeps when it is restored, as {@link #afterRestore} decides it. */
  EntityReference inverseKeptOnRestore(final RelationshipType type) {
    final EntityReference inverse = RelationshipTypeReferenceNames.named(type.getInverse());
    final boolean namesPartner =
        inverse != null && !RelationshipTypeReferences.refersTo(inverse, type);
    final RelationshipType partner = namesPartner ? findReferenced(inverse) : null;
    return !namesPartner || isRelinkable(partner) || isPairedWith(partner, type) ? inverse : null;
  }

  private boolean isRelinkable(final RelationshipType partner) {
    return isLive(partner) && partner.getInverse() == null && relationsStoredAs(partner) == 0;
  }

  private static boolean isPairedWith(final RelationshipType partner, final RelationshipType type) {
    return isLive(partner)
        && partner.getInverse() != null
        && RelationshipTypeReferences.refersTo(partner.getInverse(), type);
  }

  /** See {@link RelationshipTypeRepository#requireRemovableTogether}. */
  void requireRemovableTogether(
      final Collection<String> names, final List<RelationshipType> writtenTogether) {
    final List<RelationshipType> types = overlay(listIncludingDeleted(), writtenTogether);
    final List<RelationshipType> removed = removableNamed(types, names);
    final Set<UUID> removedIds = ids(removed);
    removed.forEach(type -> requireRemovable(type, types, removedIds));
  }

  /**
   * Runs as one transaction, so a delete refused by a concurrent change leaves every removed type in
   * place instead of a partial removal.
   */
  void deleteTogether(final String deletedBy, final Collection<String> names) {
    repository.executeInTransaction(
        () -> {
          requireRemovableTogether(names, List.of());
          final List<RelationshipType> removed = removableNamed(listIncludingDeleted(), names);
          removed.forEach(type -> detachReferencesTo(type, removed));
          removed.forEach(type -> repository.delete(deletedBy, type.getId(), false, true));
          return null;
        });
  }

  private static List<RelationshipType> overlay(
      final List<RelationshipType> stored, final List<RelationshipType> written) {
    final Set<String> writtenNames =
        written.stream().map(RelationshipType::getName).collect(Collectors.toUnmodifiableSet());
    return Stream.concat(
            stored.stream().filter(type -> !writtenNames.contains(type.getName())),
            written.stream())
        .toList();
  }

  private static List<RelationshipType> removableNamed(
      final List<RelationshipType> types, final Collection<String> names) {
    return types.stream()
        .filter(type -> names.contains(type.getName()))
        .filter(type -> !Boolean.TRUE.equals(type.getSystemDefined()))
        .toList();
  }

  private static Set<UUID> ids(final List<RelationshipType> types) {
    return types.stream().map(RelationshipType::getId).collect(Collectors.toUnmodifiableSet());
  }

  /**
   * Drops references to other types being removed in the same write, so each delete passes whatever
   * the order. A reference written by FQN before its target existed has no id and is matched by
   * FQN.
   */
  private void detachReferencesTo(
      final RelationshipType type, final List<RelationshipType> removed) {
    final RelationshipType detached = RelationshipTypeReferences.withoutReferencesTo(type, removed);
    if (!detached.equals(type)) {
      daoCollection.relationshipTypeDAO().update(detached);
      EntityRepository.invalidateCacheForEntity(
          Entity.RELATIONSHIP_TYPE, type.getId(), type.getFullyQualifiedName());
    }
  }

  private static Set<EntityReference> setOrEmpty(final Set<EntityReference> references) {
    return references == null ? Set.of() : references;
  }

  List<RelationshipType> listIncludingDeleted() {
    return daoCollection.relationshipTypeDAO().listIncludingDeleted().stream()
        .map(json -> JsonUtils.readValue(json, RelationshipType.class))
        .map(RelationshipTypeReferenceNames::withNamedReferences)
        .toList();
  }
}

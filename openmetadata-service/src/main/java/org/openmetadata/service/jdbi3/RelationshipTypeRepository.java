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

import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;

import jakarta.ws.rs.BadRequestException;
import java.util.Collection;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import java.util.stream.Stream;
import org.openmetadata.schema.entity.data.RelationshipType;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.EntityStatus;
import org.openmetadata.schema.type.EventType;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.schema.type.RelationshipCharacteristic;
import org.openmetadata.schema.type.change.ChangeSource;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.ontology.OntologyChangeEventPublisher;
import org.openmetadata.service.ontology.RelationshipTypeGraphValidator;
import org.openmetadata.service.ontology.RelationshipTypeReferences;
import org.openmetadata.service.ontology.RelationshipTypeReferences.Reference;
import org.openmetadata.service.ontology.RelationshipTypeResolver;
import org.openmetadata.service.ontology.RelationshipTypeValidator;
import org.openmetadata.service.resources.ontology.RelationshipTypeResource;
import org.openmetadata.service.util.EntityUtil.Fields;
import org.openmetadata.service.util.EntityUtil.RelationIncludes;

@Repository
public class RelationshipTypeRepository extends EntityRepository<RelationshipType> {
  private static final String UPDATE_FIELDS =
      "iri,rdfPredicate,category,inverse,domain,range,characteristics,cardinality,propertyChain,"
          + "disjointWith,crossGlossaryAllowed,paletteKey,replacedBy,entityStatus";
  private final RelationshipTypeResolver resolver;
  private final RelationshipTypeGraphValidator graphValidator;
  private final OntologyChangeEventPublisher eventPublisher;

  public RelationshipTypeRepository() {
    super(
        RelationshipTypeResource.COLLECTION_PATH,
        Entity.RELATIONSHIP_TYPE,
        RelationshipType.class,
        Entity.getCollectionDAO().relationshipTypeDAO(),
        UPDATE_FIELDS,
        UPDATE_FIELDS);
    resolver = new RelationshipTypeResolver(Entity.getCollectionDAO().relationshipTypeDAO());
    graphValidator =
        new RelationshipTypeGraphValidator(
            id ->
                Entity.getCollectionDAO()
                    .relationshipTypeDAO()
                    .findEntityById(id, Include.NON_DELETED));
    eventPublisher = new OntologyChangeEventPublisher();
  }

  @Override
  public void setFields(
      final RelationshipType entity,
      final Fields fields,
      final RelationIncludes relationIncludes) {}

  @Override
  public void clearFields(final RelationshipType entity, final Fields fields) {}

  @Override
  public void prepare(final RelationshipType entity, final boolean update) {
    entity.setFullyQualifiedName(entity.getName());
    applyDefaults(entity);
    hydrateReferences(entity);
    rejectDeletedReferences(entity);
    RelationshipTypeValidator.validate(entity);
    validateUniquePredicate(entity);
    graphValidator.validate(entity);
  }

  private void validateUniquePredicate(final RelationshipType entity) {
    final RelationshipType existing = resolver.findByPredicate(entity.getRdfPredicate());
    if (existing != null && !existing.getId().equals(entity.getId())) {
      throw new BadRequestException(
          "RDF predicate '"
              + entity.getRdfPredicate()
              + "' is already governed by '"
              + existing.getName()
              + "'");
    }
  }

  private static void applyDefaults(final RelationshipType entity) {
    entity.setIri(entity.getIri() == null ? entity.getRdfPredicate() : entity.getIri());
    entity.setDomain(entity.getDomain() == null ? Set.of() : entity.getDomain());
    entity.setRange(entity.getRange() == null ? Set.of() : entity.getRange());
    entity.setCharacteristics(
        entity.getCharacteristics() == null ? Set.of() : entity.getCharacteristics());
    entity.setPropertyChain(
        entity.getPropertyChain() == null ? List.of() : entity.getPropertyChain());
    entity.setDisjointWith(entity.getDisjointWith() == null ? Set.of() : entity.getDisjointWith());
    entity.setCrossGlossaryAllowed(
        entity.getCrossGlossaryAllowed() == null ? true : entity.getCrossGlossaryAllowed());
    entity.setSystemDefined(entity.getSystemDefined() == null ? false : entity.getSystemDefined());
    if (entity.getCharacteristics().contains(RelationshipCharacteristic.SYMMETRIC)
        && entity.getInverse() == null) {
      entity.setInverse(entity.getEntityReference());
    }
  }

  /**
   * Resolve FQN→id for {@code inverse}, {@code replacedBy}, {@code propertyChain}, and {@code
   * disjointWith} references. The public REST API ({@link
   * org.openmetadata.service.resources.ontology.RelationshipTypeMapper}) builds these references
   * with only {@code type} + {@code fullyQualifiedName} set ({@code id == null}), because a client
   * supplies FQN strings, not ids. Without this hydration the id-based checks in {@link
   * RelationshipTypeValidator} and downstream consumers (e.g. the RDF glossary exporter) break for
   * every client-supplied reference. Self-references (where the reference FQN equals the entity's
   * own FQN) are hydrated from the entity's own id, which is already set before {@code prepare}
   * runs.
   */
  private void hydrateReferences(final RelationshipType entity) {
    final String selfFqn = entity.getFullyQualifiedName();
    final UUID selfId = entity.getId();
    entity.setInverse(hydrate(entity.getInverse(), selfFqn, selfId));
    entity.setReplacedBy(hydrate(entity.getReplacedBy(), selfFqn, selfId));
    final List<EntityReference> propertyChain = entity.getPropertyChain();
    if (propertyChain != null) {
      entity.setPropertyChain(
          propertyChain.stream().map(ref -> hydrate(ref, selfFqn, selfId)).toList());
    }
    final Set<EntityReference> disjointWith = entity.getDisjointWith();
    if (disjointWith != null) {
      entity.setDisjointWith(
          disjointWith.stream()
              .map(ref -> hydrate(ref, selfFqn, selfId))
              .collect(Collectors.toUnmodifiableSet()));
    }
  }

  private EntityReference hydrate(
      final EntityReference reference, final String selfFqn, final UUID selfId) {
    if (reference == null || reference.getId() != null) {
      return reference;
    }
    final String fqn = reference.getFullyQualifiedName();
    if (fqn == null) {
      return reference;
    }
    if (fqn.equals(selfFqn)) {
      return reference.withId(selfId);
    }
    final RelationshipType resolved = findByNameOrNull(fqn, Include.ALL);
    if (resolved != null) {
      return reference.withId(resolved.getId());
    }
    return reference;
  }

  /** A reference to a soft-deleted type would leave every read through it failing. */
  private void rejectDeletedReferences(final RelationshipType entity) {
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

  private RelationshipType findReferenced(final EntityReference reference) {
    final List<RelationshipType> byId =
        reference.getId() == null
            ? List.of()
            : daoCollection
                .relationshipTypeDAO()
                .findEntitiesByIds(List.of(reference.getId()), Include.ALL);
    return !byId.isEmpty() || reference.getFullyQualifiedName() == null
        ? byId.stream().findFirst().orElse(null)
        : findByNameOrNull(reference.getFullyQualifiedName(), Include.ALL);
  }

  @Override
  public void storeEntity(final RelationshipType entity, final boolean update) {
    store(entity, update);
  }

  @Override
  public void storeRelationships(final RelationshipType entity) {}

  @Override
  protected void postCreate(final RelationshipType entity) {
    super.postCreate(entity);
    publishOntologyEvent(entity);
  }

  @Override
  protected void postUpdate(final RelationshipType original, final RelationshipType updated) {
    super.postUpdate(original, updated);
    publishOntologyEvent(updated);
  }

  private void publishOntologyEvent(final RelationshipType entity) {
    eventPublisher.publish(
        EventType.ONTOLOGY_RELATIONSHIP_TYPE_UPDATED, entity, entity.getUpdatedBy());
  }

  // System-defined relationship types ship with the ontology and are in use from the start.
  @Override
  protected Enum<?> initialEntityStatus(RelationshipType entity) {
    return Boolean.TRUE.equals(entity.getSystemDefined()) && entity.getEntityStatus() == null
        ? EntityStatus.APPROVED
        : super.initialEntityStatus(entity);
  }

  @Override
  protected void preDelete(final RelationshipType entity, final String deletedBy) {
    if (Boolean.TRUE.equals(entity.getSystemDefined())) {
      throw new BadRequestException(
          "System relationship type '" + entity.getName() + "' cannot be deleted");
    }
    requireUnreferenced(entity);
  }

  /** ADR:2026-11-18-a-relationship-type-in-use-cannot-be-deleted */
  private void requireUnreferenced(final RelationshipType entity) {
    requireUnreferenced(entity, listIncludingDeleted(), Set.of());
  }

  private void requireUnreferenced(
      final RelationshipType entity,
      final List<RelationshipType> types,
      final Set<UUID> removedTogether) {
    final List<Reference> references =
        RelationshipTypeReferences.referencesTo(entity, types).stream()
            .filter(reference -> !removedTogether.contains(reference.owner().getId()))
            .toList();
    final int relationCount =
        daoCollection
            .relationshipDAO()
            .countRelationsOfType(
                Entity.GLOSSARY_TERM,
                Relationship.RELATED_TO.ordinal(),
                entity.getId(),
                entity.getName());
    if (!references.isEmpty() || relationCount > 0) {
      throw new BadRequestException(
          RelationshipTypeReferences.inUseMessage(entity, references, relationCount));
    }
  }

  /**
   * The deprecated settings endpoint removes several types in one write, an inverse pair among
   * them, so references between the removed types do not block it. It runs before the write is
   * saved, so the definitions the same write saves replace the stored ones.
   */
  public void requireRemovableTogether(
      final Collection<String> names, final List<RelationshipType> writtenTogether) {
    final List<RelationshipType> types = overlay(listIncludingDeleted(), writtenTogether);
    final List<RelationshipType> removed = removableNamed(types, names);
    final Set<UUID> removedIds = ids(removed);
    removed.forEach(type -> requireUnreferenced(type, types, removedIds));
  }

  public void deleteTogether(final String deletedBy, final Collection<String> names) {
    requireRemovableTogether(names, List.of());
    final List<RelationshipType> removed = removableNamed(listIncludingDeleted(), names);
    final Set<UUID> removedIds = ids(removed);
    removed.forEach(type -> detachReferencesTo(type, removedIds));
    removed.forEach(type -> delete(deletedBy, type.getId(), false, true));
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

  /** Drops references to other types being removed in the same write, so each delete passes. */
  private void detachReferencesTo(final RelationshipType type, final Set<UUID> removedIds) {
    final boolean isDetached =
        RelationshipTypeReferences.heldBy(type).stream()
            .noneMatch(reference -> isRemoved(reference.target(), removedIds));
    if (!isDetached) {
      type.setInverse(keepUnless(type.getInverse(), removedIds));
      type.setReplacedBy(keepUnless(type.getReplacedBy(), removedIds));
      type.setPropertyChain(
          listOrEmpty(type.getPropertyChain()).stream()
                  .anyMatch(reference -> isRemoved(reference, removedIds))
              ? List.of()
              : type.getPropertyChain());
      type.setDisjointWith(
          setOrEmpty(type.getDisjointWith()).stream()
              .filter(reference -> !isRemoved(reference, removedIds))
              .collect(Collectors.toUnmodifiableSet()));
      daoCollection.relationshipTypeDAO().update(type);
      invalidateCacheForEntity(entityType, type.getId(), type.getFullyQualifiedName());
    }
  }

  private static EntityReference keepUnless(
      final EntityReference reference, final Set<UUID> removedIds) {
    return reference == null || isRemoved(reference, removedIds) ? null : reference;
  }

  /** A reference written by FQN before its target existed has no id and names no removed type. */
  private static boolean isRemoved(final EntityReference reference, final Set<UUID> removedIds) {
    return reference.getId() != null && removedIds.contains(reference.getId());
  }

  private static Set<EntityReference> setOrEmpty(final Set<EntityReference> references) {
    return references == null ? Set.of() : references;
  }

  private List<RelationshipType> listIncludingDeleted() {
    return daoCollection.relationshipTypeDAO().listIncludingDeleted().stream()
        .map(json -> JsonUtils.readValue(json, RelationshipType.class))
        .toList();
  }

  @Override
  public EntityUpdater getUpdater(
      final RelationshipType original,
      final RelationshipType updated,
      final Operation operation,
      final ChangeSource changeSource) {
    return new RelationshipTypeUpdater(original, updated, operation);
  }

  public class RelationshipTypeUpdater extends EntityUpdater {
    RelationshipTypeUpdater(
        final RelationshipType original,
        final RelationshipType updated,
        final Operation operation) {
      super(original, updated, operation);
    }

    @Override
    public void entitySpecificUpdate(final boolean consolidatingChanges) {
      validateImmutableFields();
      recordIdentityChanges();
      recordSemanticChanges();
      recordGovernanceChanges();
    }

    private void validateImmutableFields() {
      if (!original.getSystemDefined().equals(updated.getSystemDefined())) {
        throw new BadRequestException("The systemDefined field is immutable");
      }
    }

    private void recordIdentityChanges() {
      recordChange("iri", original.getIri(), updated.getIri());
      recordChange("rdfPredicate", original.getRdfPredicate(), updated.getRdfPredicate());
      recordChange("category", original.getCategory(), updated.getCategory());
      recordChange("paletteKey", original.getPaletteKey(), updated.getPaletteKey());
    }

    private void recordSemanticChanges() {
      recordChange("inverse", original.getInverse(), updated.getInverse());
      recordChange("domain", original.getDomain(), updated.getDomain(), true);
      recordChange("range", original.getRange(), updated.getRange(), true);
      boolean characteristicsChanged =
          recordChange(
              "characteristics", original.getCharacteristics(), updated.getCharacteristics(), true);
      // Defense-in-depth: the resource layer already validates via prepareInternal, but re-run the
      // validator here so the invariant holds for any updater caller that skips prepareInternal.
      if (characteristicsChanged) {
        RelationshipTypeValidator.validate(updated);
      }
      recordChange("cardinality", original.getCardinality(), updated.getCardinality());
      recordChange("propertyChain", original.getPropertyChain(), updated.getPropertyChain(), true);
      recordChange("disjointWith", original.getDisjointWith(), updated.getDisjointWith(), true);
    }

    private void recordGovernanceChanges() {
      recordChange(
          "crossGlossaryAllowed",
          original.getCrossGlossaryAllowed(),
          updated.getCrossGlossaryAllowed());
      recordChange("replacedBy", original.getReplacedBy(), updated.getReplacedBy());
    }
  }
}

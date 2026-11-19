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
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.function.Supplier;
import java.util.stream.Collectors;
import org.openmetadata.schema.entity.data.RelationshipType;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.EntityStatus;
import org.openmetadata.schema.type.EventType;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.RelationshipCharacteristic;
import org.openmetadata.schema.type.change.ChangeSource;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.ontology.OntologyChangeEventPublisher;
import org.openmetadata.service.ontology.RelationshipTypeGraphValidator;
import org.openmetadata.service.ontology.RelationshipTypeReferenceNames;
import org.openmetadata.service.ontology.RelationshipTypeResolver;
import org.openmetadata.service.ontology.RelationshipTypeValidator;
import org.openmetadata.service.resources.ontology.RelationshipTypeResource;
import org.openmetadata.service.util.EntityUtil.Fields;
import org.openmetadata.service.util.EntityUtil.RelationIncludes;
import org.openmetadata.service.util.FullyQualifiedName;

@Repository
public class RelationshipTypeRepository extends EntityRepository<RelationshipType> {
  private static final String UPDATE_FIELDS =
      "iri,rdfPredicate,category,inverse,domain,range,characteristics,cardinality,propertyChain,"
          + "disjointWith,crossGlossaryAllowed,paletteKey,replacedBy,entityStatus";
  private final RelationshipTypeResolver resolver;
  private final RelationshipTypeGraphValidator graphValidator;
  private final OntologyChangeEventPublisher eventPublisher;
  private final RelationshipTypeReferenceGuard referenceGuard;

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
    referenceGuard = new RelationshipTypeReferenceGuard(this);
  }

  @Override
  public void setFields(
      final RelationshipType entity, final Fields fields, final RelationIncludes relationIncludes) {
    RelationshipTypeReferenceNames.withNamedReferences(entity);
  }

  @Override
  public void setFieldsInBulk(final Fields fields, final List<RelationshipType> entities) {
    super.setFieldsInBulk(fields, entities);
    entities.forEach(RelationshipTypeReferenceNames::withNamedReferences);
  }

  @Override
  public void clearFields(final RelationshipType entity, final Fields fields) {}

  @Override
  public void prepare(final RelationshipType entity, final boolean update) {
    entity.setFullyQualifiedName(FullyQualifiedName.quoteName(entity.getName()));
    applyDefaults(entity);
    hydrateReferences(entity);
    referenceGuard.rejectDeletedReferences(entity);
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
   * Completes the {@code inverse}, {@code replacedBy}, {@code propertyChain} and {@code
   * disjointWith} references, which a client supplies by FQN and a PATCH may carry over with no
   * name, so every stored reference carries its name and, once its target exists, its id
   * (ADR:2026-11-19-relationship-type-references-carry-their-name). A self-reference resolves to the
   * entity itself, whose id is set before {@code prepare} runs.
   */
  private void hydrateReferences(final RelationshipType entity) {
    entity.setInverse(hydrate(entity.getInverse(), entity));
    entity.setReplacedBy(hydrate(entity.getReplacedBy(), entity));
    final List<EntityReference> propertyChain = entity.getPropertyChain();
    if (propertyChain != null) {
      entity.setPropertyChain(propertyChain.stream().map(ref -> hydrate(ref, entity)).toList());
    }
    final Set<EntityReference> disjointWith = entity.getDisjointWith();
    if (disjointWith != null) {
      entity.setDisjointWith(
          disjointWith.stream()
              .map(ref -> hydrate(ref, entity))
              .collect(Collectors.toCollection(LinkedHashSet::new)));
    }
  }

  private EntityReference hydrate(final EntityReference reference, final RelationshipType self) {
    final EntityReference named = RelationshipTypeReferenceNames.named(reference);
    final RelationshipType target = named == null ? null : findTarget(named, self);
    return target == null ? named : RelationshipTypeReferenceNames.referenceTo(target);
  }

  private RelationshipType findTarget(
      final EntityReference reference, final RelationshipType self) {
    final boolean isSelf =
        reference.getId() == null
            ? self.getName().equals(reference.getName())
            : reference.getId().equals(self.getId());
    final RelationshipType target = isSelf ? self : findStoredTarget(reference);
    requireOneIdentity(reference, target);
    return target;
  }

  /** By id, else by name, deleted or not; null when the reference names no type yet. */
  private RelationshipType findStoredTarget(final EntityReference reference) {
    final RelationshipType byId = reference.getId() == null ? null : findByIdOrNull(reference);
    return byId != null || reference.getName() == null
        ? byId
        : findByNameOrNull(FullyQualifiedName.quoteName(reference.getName()), Include.ALL);
  }

  /**
   * A reference whose id, name and FQN name different types is refused rather than resolved by one;
   * only the parts it carries are compared.
   */
  private static void requireOneIdentity(
      final EntityReference reference, final RelationshipType target) {
    final String name = reference.getName();
    final String fqn = reference.getFullyQualifiedName();
    final boolean isConflicting =
        (target != null && name != null && !target.getName().equals(name))
            || (name != null && fqn != null && !name.equals(FullyQualifiedName.unquoteName(fqn)));
    if (isConflicting) {
      throw new BadRequestException(
          String.format(
              "Relationship type reference %s names more than one relationship type",
              JsonUtils.pojoToJson(reference)));
    }
  }

  private RelationshipType findByIdOrNull(final EntityReference reference) {
    RelationshipType found;
    try {
      found = find(reference.getId(), Include.ALL);
    } catch (EntityNotFoundException exception) {
      found = null;
    }
    return found;
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

  /**
   * A delete clears its partners' inverse and a restore re-links or unlinks one, so each write runs
   * in one transaction with the partner updates it causes.
   */
  @Override
  protected <R> R executeEntityWrite(
      final List<RelationshipType> entities, final Supplier<R> work) {
    return executeInTransaction(work);
  }

  @Override
  protected void preDelete(final RelationshipType entity, final String deletedBy) {
    if (Boolean.TRUE.equals(entity.getSystemDefined())) {
      throw new BadRequestException(
          "System relationship type '" + entity.getName() + "' cannot be deleted");
    }
    referenceGuard.beforeDelete(entity, deletedBy);
  }

  /**
   * A restore links a partner back or clears the type's inverse, which on a live type would change
   * how its relations read, so only a deleted type is restored.
   */
  @Override
  public void validateRestore(final UUID id) {
    if (!Boolean.TRUE.equals(find(id, Include.ALL).getDeleted())) {
      throw new BadRequestException(
          String.format("Entity %s:%s is not in deleted state", entityType, id));
    }
  }

  @Override
  protected void postRestore(final RelationshipType entity) {
    super.postRestore(entity);
    referenceGuard.afterRestore(entity);
  }

  /** The inverse {@code type} keeps when it is restored. */
  public EntityReference inverseKeptOnRestore(final RelationshipType type) {
    return referenceGuard.inverseKeptOnRestore(type);
  }

  /**
   * The deprecated settings endpoint removes several types in one write, an inverse pair among
   * them, so references between the removed types do not block it, and a kept type's back-link to
   * a removed one is cleared as the type API's delete clears it. It runs before the write is saved,
   * so the definitions the same write saves replace the stored ones.
   */
  public void requireRemovableTogether(
      final Collection<String> names, final List<RelationshipType> writtenTogether) {
    referenceGuard.requireRemovableTogether(names, writtenTogether);
  }

  public void deleteTogether(final String deletedBy, final Collection<String> names) {
    referenceGuard.deleteTogether(deletedBy, names);
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

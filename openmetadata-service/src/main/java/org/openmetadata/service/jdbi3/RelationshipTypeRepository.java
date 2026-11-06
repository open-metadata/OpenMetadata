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
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import org.openmetadata.schema.entity.data.RelationshipType;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.EntityStatus;
import org.openmetadata.schema.type.EventType;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.RelationshipCharacteristic;
import org.openmetadata.schema.type.change.ChangeSource;
import org.openmetadata.service.Entity;
import org.openmetadata.service.ontology.OntologyChangeEventPublisher;
import org.openmetadata.service.ontology.RelationshipTypeGraphValidator;
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

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
import org.openmetadata.schema.entity.data.RelationshipType;
import org.openmetadata.schema.type.EntityStatus;
import org.openmetadata.schema.type.EventType;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.RelationshipCharacteristic;
import org.openmetadata.schema.type.change.ChangeSource;
import org.openmetadata.service.Entity;
import org.openmetadata.service.entity.EntityModuleDependencies;
import org.openmetadata.service.entity.EntityModuleFactory;
import org.openmetadata.service.entity.policy.EntityPolicy;
import org.openmetadata.service.entity.policy.EntityPolicyContext;
import org.openmetadata.service.entity.write.EntityOperation;
import org.openmetadata.service.entity.write.EntitySpecificMutation;
import org.openmetadata.service.entity.write.EntityUpdateRequest;
import org.openmetadata.service.entity.write.EntityUpdater;
import org.openmetadata.service.ontology.OntologyChangeEventPublisher;
import org.openmetadata.service.ontology.RelationshipTypeGraphValidator;
import org.openmetadata.service.ontology.RelationshipTypeResolver;
import org.openmetadata.service.ontology.RelationshipTypeValidator;
import org.openmetadata.service.resources.ontology.RelationshipTypeResource;
import org.openmetadata.service.util.EntityUtil.Fields;
import org.openmetadata.service.util.EntityUtil.RelationIncludes;

@Repository
public class RelationshipTypeRepository implements EntityPolicy<RelationshipType> {

  private static final String UPDATE_FIELDS =
      "iri,rdfPredicate,category,inverse,domain,range,characteristics,cardinality,propertyChain,"
          + "disjointWith,crossGlossaryAllowed,paletteKey,replacedBy,entityStatus";

  private final RelationshipTypeResolver resolver;

  private final RelationshipTypeGraphValidator graphValidator;

  private final OntologyChangeEventPublisher eventPublisher;

  public RelationshipTypeRepository() {
    this.entityContext =
        new EntityPolicyContext<>(
            new EntityPolicyContext.Schema<>(
                RelationshipTypeResource.COLLECTION_PATH,
                Entity.RELATIONSHIP_TYPE,
                RelationshipType.class,
                Entity.getCollectionDAO().relationshipTypeDAO()),
            new EntityPolicyContext.WriteFields(UPDATE_FIELDS, UPDATE_FIELDS, Set.of()),
            EntityModuleDependencies.standard());
    EntityModuleFactory.initialize(this, true);
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
    if (entity.getEntityStatus() == null && Boolean.TRUE.equals(entity.getSystemDefined())) {
      entity.setEntityStatus(EntityStatus.APPROVED);
    }
    if (entity.getCharacteristics().contains(RelationshipCharacteristic.SYMMETRIC)
        && entity.getInverse() == null) {
      entity.setInverse(entity.getEntityReference());
    }
  }

  @Override
  public void storeEntity(final RelationshipType entity, final boolean update) {
    persistence().store(entity, update);
  }

  @Override
  public void storeRelationships(final RelationshipType entity) {}

  @Override
  public void postCreate(final RelationshipType entity) {
    EntityPolicy.super.postCreate(entity);
    publishOntologyEvent(entity);
  }

  @Override
  public void postUpdate(final RelationshipType original, final RelationshipType updated) {
    EntityPolicy.super.postUpdate(original, updated);
    publishOntologyEvent(updated);
  }

  private void publishOntologyEvent(final RelationshipType entity) {
    eventPublisher.publish(
        EventType.ONTOLOGY_RELATIONSHIP_TYPE_UPDATED, entity, entity.getUpdatedBy());
  }

  @Override
  public void preDelete(final RelationshipType entity, final String deletedBy) {
    if (Boolean.TRUE.equals(entity.getSystemDefined())) {
      throw new BadRequestException(
          "System relationship type '" + entity.getName() + "' cannot be deleted");
    }
  }

  @Override
  public EntityUpdater<RelationshipType> getUpdater(
      final RelationshipType original,
      final RelationshipType updated,
      final EntityOperation operation,
      final ChangeSource changeSource) {
    return new RelationshipTypeUpdater(original, updated, operation).mutation();
  }

  public class RelationshipTypeUpdater implements EntitySpecificMutation<RelationshipType> {

    RelationshipTypeUpdater(
        final RelationshipType original,
        final RelationshipType updated,
        final EntityOperation operation) {
      this.entityUpdate =
          new EntityUpdater<>(
              context().services().getUpdaterServices(),
              new EntityUpdateRequest<>(original, updated, operation, null, false),
              this);
    }

    @Override
    public void update(
        EntityUpdater<RelationshipType> entityUpdate, final boolean consolidatingChanges) {
      validateImmutableFields();
      recordIdentityChanges();
      recordSemanticChanges();
      recordGovernanceChanges();
    }

    private void validateImmutableFields() {
      if (!entityUpdate
          .getOriginal()
          .getSystemDefined()
          .equals(entityUpdate.getUpdated().getSystemDefined())) {
        throw new BadRequestException("The systemDefined field is immutable");
      }
    }

    private void recordIdentityChanges() {
      entityUpdate.recordChange(
          "iri", entityUpdate.getOriginal().getIri(), entityUpdate.getUpdated().getIri());
      entityUpdate.recordChange(
          "rdfPredicate",
          entityUpdate.getOriginal().getRdfPredicate(),
          entityUpdate.getUpdated().getRdfPredicate());
      entityUpdate.recordChange(
          "category",
          entityUpdate.getOriginal().getCategory(),
          entityUpdate.getUpdated().getCategory());
      entityUpdate.recordChange(
          "paletteKey",
          entityUpdate.getOriginal().getPaletteKey(),
          entityUpdate.getUpdated().getPaletteKey());
    }

    private void recordSemanticChanges() {
      entityUpdate.recordChange(
          "inverse",
          entityUpdate.getOriginal().getInverse(),
          entityUpdate.getUpdated().getInverse());
      entityUpdate.recordChange(
          "domain",
          entityUpdate.getOriginal().getDomain(),
          entityUpdate.getUpdated().getDomain(),
          true);
      entityUpdate.recordChange(
          "range",
          entityUpdate.getOriginal().getRange(),
          entityUpdate.getUpdated().getRange(),
          true);
      entityUpdate.recordChange(
          "characteristics",
          entityUpdate.getOriginal().getCharacteristics(),
          entityUpdate.getUpdated().getCharacteristics(),
          true);
      entityUpdate.recordChange(
          "cardinality",
          entityUpdate.getOriginal().getCardinality(),
          entityUpdate.getUpdated().getCardinality());
      entityUpdate.recordChange(
          "propertyChain",
          entityUpdate.getOriginal().getPropertyChain(),
          entityUpdate.getUpdated().getPropertyChain(),
          true);
      entityUpdate.recordChange(
          "disjointWith",
          entityUpdate.getOriginal().getDisjointWith(),
          entityUpdate.getUpdated().getDisjointWith(),
          true);
    }

    private void recordGovernanceChanges() {
      entityUpdate.recordChange(
          "crossGlossaryAllowed",
          entityUpdate.getOriginal().getCrossGlossaryAllowed(),
          entityUpdate.getUpdated().getCrossGlossaryAllowed());
      entityUpdate.recordChange(
          "replacedBy",
          entityUpdate.getOriginal().getReplacedBy(),
          entityUpdate.getUpdated().getReplacedBy());
    }

    private final EntityUpdater<RelationshipType> entityUpdate;

    public EntityUpdater<RelationshipType> mutation() {
      return entityUpdate;
    }
  }

  private final EntityPolicyContext<RelationshipType> entityContext;

  @Override
  public final EntityPolicyContext<RelationshipType> context() {
    return entityContext;
  }
}

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
import java.net.URI;
import java.util.List;
import java.util.Set;
import org.openmetadata.schema.api.data.OntologyProfileReport;
import org.openmetadata.schema.entity.data.Glossary;
import org.openmetadata.schema.entity.data.OntologyAxiom;
import org.openmetadata.schema.type.EntityStatus;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.schema.type.change.ChangeSource;
import org.openmetadata.service.Entity;
import org.openmetadata.service.entity.EntityModuleDependencies;
import org.openmetadata.service.entity.EntityModuleFactory;
import org.openmetadata.service.entity.metadata.EntityRelationshipWriter;
import org.openmetadata.service.entity.policy.EntityPolicy;
import org.openmetadata.service.entity.policy.EntityPolicyContext;
import org.openmetadata.service.entity.write.EntityOperation;
import org.openmetadata.service.entity.write.EntitySpecificMutation;
import org.openmetadata.service.entity.write.EntityUpdateRequest;
import org.openmetadata.service.entity.write.EntityUpdater;
import org.openmetadata.service.ontology.OwlProfileGuard;
import org.openmetadata.service.ontology.RelationshipTypeResolver;
import org.openmetadata.service.resources.ontology.OntologyAxiomResource;
import org.openmetadata.service.util.EntityUtil.Fields;
import org.openmetadata.service.util.EntityUtil.RelationIncludes;
import org.openmetadata.service.util.FullyQualifiedName;

@Repository
public class OntologyAxiomRepository implements EntityPolicy<OntologyAxiom> {

  private static final String UPDATE_FIELDS =
      "axiomType,subjectIri,expressions,propertyIri,targetIri,literal,provenance,entityStatus";

  private final OwlProfileGuard profileGuard;

  public OntologyAxiomRepository() {
    this.entityContext =
        new EntityPolicyContext<>(
            new EntityPolicyContext.Schema<>(
                OntologyAxiomResource.COLLECTION_PATH,
                Entity.ONTOLOGY_AXIOM,
                OntologyAxiom.class,
                Entity.getCollectionDAO().ontologyAxiomDAO()),
            new EntityPolicyContext.WriteFields(UPDATE_FIELDS, UPDATE_FIELDS, Set.of()),
            EntityModuleDependencies.standard());
    EntityModuleFactory.initialize(this, true);
    final RelationshipTypeResolver relationshipTypes =
        new RelationshipTypeResolver(Entity.getCollectionDAO().relationshipTypeDAO());
    profileGuard =
        new OwlProfileGuard(
            relationshipTypes::isSimple,
            new PersistentVocabularyIndex(Entity.getCollectionDAO().ontologyAxiomDAO()));
  }

  @Override
  public void setFields(
      final OntologyAxiom entity, final Fields fields, final RelationIncludes relationIncludes) {}

  @Override
  public void clearFields(final OntologyAxiom entity, final Fields fields) {}

  @Override
  public void prepare(final OntologyAxiom entity, final boolean update) {
    final Glossary glossary = requireEditableGlossary(entity);
    entity.setGlossary(glossary.getEntityReference());
    entity.setFullyQualifiedName(
        FullyQualifiedName.add(glossary.getFullyQualifiedName(), entity.getName()));
    entity.setExpressions(List.copyOf(listOrEmpty(entity.getExpressions())));
    entity.setEntityStatus(
        entity.getEntityStatus() == null ? EntityStatus.DRAFT : entity.getEntityStatus());
    profileGuard.validateOrThrow(entity);
  }

  public OntologyProfileReport validate(final OntologyAxiom entity) {
    prepare(entity, false);
    return profileGuard.validate(entity);
  }

  private static Glossary requireEditableGlossary(final OntologyAxiom entity) {
    final Glossary glossary =
        Entity.getEntity(Entity.GLOSSARY, entity.getGlossary().getId(), "", Include.NON_DELETED);
    final boolean isReadOnly =
        glossary.getOntologyConfiguration() != null
            && Boolean.TRUE.equals(glossary.getOntologyConfiguration().getReadOnly());
    if (isReadOnly) {
      throw new BadRequestException("Reference ontology '" + glossary.getName() + "' is read-only");
    }
    return glossary;
  }

  @Override
  public void storeEntity(final OntologyAxiom entity, final boolean update) {
    persistence().store(entity, update);
  }

  @Override
  public void storeRelationships(final OntologyAxiom entity) {
    relationshipWrites()
        .add(
            new EntityRelationshipWriter.Edge(
                entity.getGlossary().getId(),
                entity.getId(),
                Entity.GLOSSARY,
                Entity.ONTOLOGY_AXIOM,
                Relationship.CONTAINS),
            EntityRelationshipWriter.Value.EMPTY,
            false);
  }

  @Override
  public EntityUpdater<OntologyAxiom> getUpdater(
      final OntologyAxiom original,
      final OntologyAxiom updated,
      final EntityOperation operation,
      final ChangeSource changeSource) {
    return new OntologyAxiomUpdater(original, updated, operation).mutation();
  }

  public class OntologyAxiomUpdater implements EntitySpecificMutation<OntologyAxiom> {

    OntologyAxiomUpdater(
        final OntologyAxiom original,
        final OntologyAxiom updated,
        final EntityOperation operation) {
      this.entityUpdate =
          new EntityUpdater<>(
              context().services().getUpdaterServices(),
              new EntityUpdateRequest<>(original, updated, operation, null, false),
              this);
    }

    @Override
    public void update(
        EntityUpdater<OntologyAxiom> entityUpdate, final boolean consolidatingChanges) {
      if (!entityUpdate
          .getOriginal()
          .getGlossary()
          .getId()
          .equals(entityUpdate.getUpdated().getGlossary().getId())) {
        throw new BadRequestException("An ontology axiom cannot move between glossaries");
      }
      recordAxiomChanges();
      recordAssertionChanges();
      recordGovernanceChanges();
    }

    private void recordAxiomChanges() {
      entityUpdate.recordChange(
          "axiomType",
          entityUpdate.getOriginal().getAxiomType(),
          entityUpdate.getUpdated().getAxiomType());
      entityUpdate.recordChange(
          "subjectIri",
          entityUpdate.getOriginal().getSubjectIri(),
          entityUpdate.getUpdated().getSubjectIri());
      entityUpdate.recordChange(
          "expressions",
          entityUpdate.getOriginal().getExpressions(),
          entityUpdate.getUpdated().getExpressions(),
          true);
    }

    private void recordAssertionChanges() {
      entityUpdate.recordChange(
          "propertyIri",
          entityUpdate.getOriginal().getPropertyIri(),
          entityUpdate.getUpdated().getPropertyIri());
      entityUpdate.recordChange(
          "targetIri",
          entityUpdate.getOriginal().getTargetIri(),
          entityUpdate.getUpdated().getTargetIri());
      entityUpdate.recordChange(
          "literal",
          entityUpdate.getOriginal().getLiteral(),
          entityUpdate.getUpdated().getLiteral());
    }

    private void recordGovernanceChanges() {
      entityUpdate.recordChange(
          "provenance",
          entityUpdate.getOriginal().getProvenance(),
          entityUpdate.getUpdated().getProvenance());
      entityUpdate.recordChange(
          "entityStatus",
          entityUpdate.getOriginal().getEntityStatus(),
          entityUpdate.getUpdated().getEntityStatus());
    }

    private final EntityUpdater<OntologyAxiom> entityUpdate;

    public EntityUpdater<OntologyAxiom> mutation() {
      return entityUpdate;
    }
  }

  private record PersistentVocabularyIndex(CollectionDAO.OntologyAxiomDAO dao)
      implements OwlProfileGuard.VocabularyIndex {

    @Override
    public boolean isClass(final URI iri) {
      return iri != null && dao.countClassSubjects(iri.toString()) > 0;
    }

    @Override
    public boolean isIndividual(final URI iri) {
      return iri != null && dao.countIndividualSubjects(iri.toString()) > 0;
    }
  }

  private final EntityPolicyContext<OntologyAxiom> entityContext;

  @Override
  public final EntityPolicyContext<OntologyAxiom> context() {
    return entityContext;
  }
}

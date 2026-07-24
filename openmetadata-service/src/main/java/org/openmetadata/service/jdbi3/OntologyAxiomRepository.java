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
import org.openmetadata.schema.api.data.OntologyProfileReport;
import org.openmetadata.schema.entity.data.Glossary;
import org.openmetadata.schema.entity.data.OntologyAxiom;
import org.openmetadata.schema.type.EntityStatus;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.schema.type.change.ChangeSource;
import org.openmetadata.service.Entity;
import org.openmetadata.service.ontology.OwlProfileGuard;
import org.openmetadata.service.ontology.RelationshipTypeResolver;
import org.openmetadata.service.resources.ontology.OntologyAxiomResource;
import org.openmetadata.service.util.EntityUtil.Fields;
import org.openmetadata.service.util.EntityUtil.RelationIncludes;
import org.openmetadata.service.util.FullyQualifiedName;

@Repository
public class OntologyAxiomRepository extends EntityRepository<OntologyAxiom> {
  private static final String UPDATE_FIELDS =
      "axiomType,subjectIri,expressions,propertyIri,targetIri,literal,provenance,entityStatus";
  private final OwlProfileGuard profileGuard;

  public OntologyAxiomRepository() {
    super(
        OntologyAxiomResource.COLLECTION_PATH,
        Entity.ONTOLOGY_AXIOM,
        OntologyAxiom.class,
        Entity.getCollectionDAO().ontologyAxiomDAO(),
        UPDATE_FIELDS,
        UPDATE_FIELDS);
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
    store(entity, update);
  }

  @Override
  public void storeRelationships(final OntologyAxiom entity) {
    addRelationship(
        entity.getGlossary().getId(),
        entity.getId(),
        Entity.GLOSSARY,
        Entity.ONTOLOGY_AXIOM,
        Relationship.CONTAINS);
  }

  @Override
  public EntityUpdater getUpdater(
      final OntologyAxiom original,
      final OntologyAxiom updated,
      final Operation operation,
      final ChangeSource changeSource) {
    return new OntologyAxiomUpdater(original, updated, operation);
  }

  public class OntologyAxiomUpdater extends EntityUpdater {
    OntologyAxiomUpdater(
        final OntologyAxiom original, final OntologyAxiom updated, final Operation operation) {
      super(original, updated, operation);
    }

    @Override
    public void entitySpecificUpdate(final boolean consolidatingChanges) {
      if (!original.getGlossary().getId().equals(updated.getGlossary().getId())) {
        throw new BadRequestException("An ontology axiom cannot move between glossaries");
      }
      recordAxiomChanges();
      recordAssertionChanges();
      recordGovernanceChanges();
    }

    private void recordAxiomChanges() {
      recordChange("axiomType", original.getAxiomType(), updated.getAxiomType());
      recordChange("subjectIri", original.getSubjectIri(), updated.getSubjectIri());
      recordChange("expressions", original.getExpressions(), updated.getExpressions(), true);
    }

    private void recordAssertionChanges() {
      recordChange("propertyIri", original.getPropertyIri(), updated.getPropertyIri());
      recordChange("targetIri", original.getTargetIri(), updated.getTargetIri());
      recordChange("literal", original.getLiteral(), updated.getLiteral());
    }

    private void recordGovernanceChanges() {
      recordChange("provenance", original.getProvenance(), updated.getProvenance());
      recordChange("entityStatus", original.getEntityStatus(), updated.getEntityStatus());
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
}

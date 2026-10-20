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

import java.util.List;
import org.openmetadata.schema.api.data.OntologyProfileReport;
import org.openmetadata.schema.entity.data.OntologyAxiom;
import org.openmetadata.schema.type.Include;
import org.openmetadata.service.Entity;
import org.openmetadata.service.ontology.OwlProfileGuard;
import org.openmetadata.service.resources.ontology.OntologyAxiomResource;
import org.openmetadata.service.util.FreshReadScope;

@Repository
public class OntologyAxiomRepository extends OntologyEntityRepository<OntologyAxiom> {
  private static final OwlProfileGuard SHAPE_GUARD = new OwlProfileGuard(iri -> null);

  public OntologyAxiomRepository() {
    super(
        Entity.ONTOLOGY_AXIOM,
        OntologyAxiom.class,
        Entity.getCollectionDAO().ontologyAxiomDAO(),
        OntologyAxiomResource.COLLECTION_PATH,
        "ontology,axiomType,subjectIri,expressions,propertyIri,targetIri,literal,provenance");
  }

  @Override
  protected void validateDefinition(final OntologyAxiom entity) {
    requireAbsoluteIri(entity.getSubjectIri(), "subjectIri");
    SHAPE_GUARD.validateOrThrow(entity);
    entity.setExpressions(List.copyOf(listOrEmpty(entity.getExpressions())));
  }

  public OntologyProfileReport validate(final OntologyAxiom entity) {
    final var shape = SHAPE_GUARD.validate(entity);
    if (!shape.getValid()) {
      return shape;
    }
    return executeInTransaction(
        () -> {
          try (FreshReadScope.Handle ignored = FreshReadScope.enter()) {
            prepare(entity, false);
            setFullyQualifiedName(entity);
            final var existing =
                findByNameOrNull(entity.getFullyQualifiedName(), Include.NON_DELETED);
            if (existing != null) {
              entity.setId(existing.getId());
            }
            return new OntologyWorkingModel(daoCollection).validate(entity);
          }
        });
  }
}

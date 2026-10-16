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

package org.openmetadata.service.resources.ontology;

import org.openmetadata.schema.api.data.CreateOntologyAxiom;
import org.openmetadata.schema.entity.data.OntologyAxiom;
import org.openmetadata.schema.type.Include;
import org.openmetadata.service.Entity;
import org.openmetadata.service.mapper.EntityMapper;

public final class OntologyAxiomMapper implements EntityMapper<OntologyAxiom, CreateOntologyAxiom> {
  @Override
  public OntologyAxiom createToEntity(final CreateOntologyAxiom request, final String user) {
    return copy(new OntologyAxiom(), request, user)
        .withGlossary(
            Entity.getEntityReferenceByName(
                Entity.GLOSSARY, request.getGlossary(), Include.NON_DELETED))
        .withAxiomType(request.getAxiomType())
        .withSubjectIri(request.getSubjectIri())
        .withExpressions(request.getExpressions())
        .withPropertyIri(request.getPropertyIri())
        .withTargetIri(request.getTargetIri())
        .withLiteral(request.getLiteral())
        .withProvenance(request.getProvenance())
        .withEntityStatus(request.getEntityStatus())
        .withProvider(request.getProvider());
  }
}

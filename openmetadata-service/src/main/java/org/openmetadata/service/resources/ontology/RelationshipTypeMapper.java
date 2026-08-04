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

import static org.openmetadata.service.util.EntityUtil.getEntityReference;

import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;
import org.openmetadata.schema.api.data.CreateRelationshipType;
import org.openmetadata.schema.entity.data.RelationshipType;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.SemanticReference;
import org.openmetadata.service.Entity;
import org.openmetadata.service.mapper.EntityMapper;

public final class RelationshipTypeMapper
    implements EntityMapper<RelationshipType, CreateRelationshipType> {
  @Override
  public RelationshipType createToEntity(final CreateRelationshipType request, final String user) {
    return copy(new RelationshipType(), request, user)
        .withIri(request.getIri())
        .withRdfPredicate(request.getRdfPredicate())
        .withCategory(request.getCategory())
        .withInverse(reference(request.getInverse()))
        .withDomain(semanticReferences(request.getDomain()))
        .withRange(semanticReferences(request.getRange()))
        .withCharacteristics(request.getCharacteristics())
        .withCardinality(request.getCardinality())
        .withPropertyChain(references(request.getPropertyChain()))
        .withDisjointWith(referenceSet(request.getDisjointWith()))
        .withCrossGlossaryAllowed(request.getCrossGlossaryAllowed())
        .withPaletteKey(request.getPaletteKey())
        .withSystemDefined(false)
        .withReplacedBy(reference(request.getReplacedBy()))
        .withEntityStatus(request.getEntityStatus());
  }

  private static EntityReference reference(final String fqn) {
    final EntityReference reference =
        fqn == null ? null : getEntityReference(Entity.RELATIONSHIP_TYPE, fqn);
    return reference;
  }

  private static List<EntityReference> references(final List<String> fqns) {
    final List<EntityReference> references =
        fqns == null ? List.of() : fqns.stream().map(RelationshipTypeMapper::reference).toList();
    return references;
  }

  private static Set<EntityReference> referenceSet(final Set<String> fqns) {
    final Set<EntityReference> references =
        fqns == null
            ? Set.of()
            : fqns.stream()
                .map(RelationshipTypeMapper::reference)
                .collect(Collectors.toUnmodifiableSet());
    return references;
  }

  private static Set<SemanticReference> semanticReferences(
      final List<SemanticReference> references) {
    final Set<SemanticReference> semanticReferences =
        references == null ? Set.of() : Set.copyOf(references);
    return semanticReferences;
  }
}

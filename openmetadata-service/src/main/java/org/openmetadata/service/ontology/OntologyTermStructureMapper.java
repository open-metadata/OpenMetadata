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

package org.openmetadata.service.ontology;

import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;

import jakarta.ws.rs.BadRequestException;
import java.net.URI;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.UUID;
import org.openmetadata.schema.api.data.ConceptMapping;
import org.openmetadata.schema.entity.data.GlossaryTerm;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.OntologyAttribute;
import org.openmetadata.schema.type.OntologySourceProvenance;
import org.openmetadata.schema.type.OntologyStructuralRelationship;
import org.openmetadata.schema.type.OntologyTermStructure;
import org.openmetadata.schema.type.RelationProvenance;
import org.openmetadata.schema.type.TermRelation;

final class OntologyTermStructureMapper {
  private OntologyTermStructureMapper() {}

  static OntologyTermStructure sourceStructure(final GlossaryTerm source) {
    return structure(
        source,
        source.getParent() == null ? null : source.getParent().getId(),
        sourceRelationships(source));
  }

  static OntologyTermStructure subsetStructure(
      final GlossaryTerm subset, final List<GlossaryTerm> context) {
    final UUID parentSourceId = subsetParentSourceId(subset, context);
    final List<OntologyStructuralRelationship> relationships = subsetRelationships(subset, context);
    final OntologyTermStructure structure = structure(subset, parentSourceId, relationships);
    structure.setConceptMappings(subsetMappings(subset));
    return structure;
  }

  private static OntologyTermStructure structure(
      final GlossaryTerm term,
      final UUID parentSourceId,
      final List<OntologyStructuralRelationship> relationships) {
    return new OntologyTermStructure()
        .withName(term.getName())
        .withDisplayName(term.getDisplayName())
        .withDescription(term.getDescription())
        .withEntityStatus(term.getEntityStatus())
        .withParentSourceTermId(parentSourceId)
        .withAttributes(sortedAttributes(term.getAttributes()))
        .withConceptMappings(sortedMappings(term.getConceptMappings()))
        .withRelationships(sortedRelationships(relationships));
  }

  private static List<OntologyStructuralRelationship> sourceRelationships(
      final GlossaryTerm source) {
    return listOrEmpty(source.getRelatedTerms()).stream()
        .filter(OntologyTermStructureMapper::isAsserted)
        .map(OntologyTermStructureMapper::sourceRelationship)
        .toList();
  }

  private static OntologyStructuralRelationship sourceRelationship(final TermRelation relation) {
    requireRelationship(relation);
    return new OntologyStructuralRelationship()
        .withTargetSourceTermId(relation.getTerm().getId())
        .withRelationshipType(stableReference(relation.getRelationshipType()));
  }

  private static List<OntologyStructuralRelationship> subsetRelationships(
      final GlossaryTerm subset, final List<GlossaryTerm> context) {
    return listOrEmpty(subset.getRelatedTerms()).stream()
        .filter(OntologyTermStructureMapper::isAsserted)
        .map(relation -> subsetRelationship(relation, context))
        .toList();
  }

  static OntologyStructuralRelationship subsetRelationship(
      final TermRelation relation, final List<GlossaryTerm> context) {
    requireRelationship(relation);
    final GlossaryTerm target = findById(context, relation.getTerm().getId());
    final UUID sourceId = targetSourceId(target, relation.getTerm().getId());
    return new OntologyStructuralRelationship()
        .withTargetSourceTermId(sourceId)
        .withRelationshipType(stableReference(relation.getRelationshipType()));
  }

  static boolean isAsserted(final TermRelation relation) {
    return relation.getProvenance() != RelationProvenance.INFERRED;
  }

  private static void requireRelationship(final TermRelation relation) {
    final boolean isInvalid =
        relation.getTerm() == null
            || relation.getTerm().getId() == null
            || relation.getRelationshipType() == null
            || relation.getRelationshipType().getId() == null;
    if (isInvalid) {
      throw new BadRequestException(
          "Structural merge requires relationships with registered typed identities");
    }
  }

  private static UUID subsetParentSourceId(
      final GlossaryTerm subset, final List<GlossaryTerm> context) {
    final UUID parentId = subset.getParent() == null ? null : subset.getParent().getId();
    final GlossaryTerm parent = parentId == null ? null : findById(context, parentId);
    return targetSourceId(parent, parentId);
  }

  private static UUID targetSourceId(final GlossaryTerm target, final UUID fallbackId) {
    final OntologySourceProvenance provenance = target == null ? null : target.getOntologySource();
    final UUID sourceId =
        provenance == null || provenance.getSourceTerm() == null
            ? fallbackId
            : provenance.getSourceTerm().getId();
    return sourceId;
  }

  private static GlossaryTerm findById(final List<GlossaryTerm> terms, final UUID termId) {
    return terms.stream().filter(term -> term.getId().equals(termId)).findFirst().orElse(null);
  }

  private static EntityReference stableReference(final EntityReference reference) {
    return new EntityReference()
        .withId(reference.getId())
        .withType(reference.getType())
        .withName(reference.getName())
        .withFullyQualifiedName(reference.getFullyQualifiedName());
  }

  private static List<OntologyAttribute> sortedAttributes(
      final List<OntologyAttribute> attributes) {
    return listOrEmpty(attributes).stream()
        .sorted(
            Comparator.comparing(
                    OntologyAttribute::getId, Comparator.nullsLast(Comparator.naturalOrder()))
                .thenComparing(
                    OntologyAttribute::getName, Comparator.nullsLast(Comparator.naturalOrder())))
        .toList();
  }

  private static List<ConceptMapping> sortedMappings(final List<ConceptMapping> mappings) {
    return listOrEmpty(mappings).stream()
        .sorted(Comparator.comparing(OntologyTermStructureMapper::mappingKey))
        .toList();
  }

  private static String mappingKey(final ConceptMapping mapping) {
    return String.valueOf(mapping.getConceptIri())
        + '|'
        + mapping.getMappingType()
        + '|'
        + mapping.getSchemeIri()
        + '|'
        + mapping.getSource();
  }

  private static List<OntologyStructuralRelationship> sortedRelationships(
      final List<OntologyStructuralRelationship> relationships) {
    return relationships.stream()
        .sorted(Comparator.comparing(OntologyTermStructureMapper::relationshipKey))
        .toList();
  }

  private static String relationshipKey(final OntologyStructuralRelationship relationship) {
    return relationship.getRelationshipType().getId() + "|" + relationship.getTargetSourceTermId();
  }

  private static List<ConceptMapping> subsetMappings(final GlossaryTerm subset) {
    final List<ConceptMapping> mappings = new ArrayList<>();
    boolean removedProvenanceMapping = false;
    for (final ConceptMapping mapping : listOrEmpty(subset.getConceptMappings())) {
      if (!removedProvenanceMapping && isProvenanceMapping(subset, mapping)) {
        removedProvenanceMapping = true;
      } else {
        mappings.add(mapping);
      }
    }
    return sortedMappings(mappings);
  }

  private static boolean isProvenanceMapping(
      final GlossaryTerm subset, final ConceptMapping mapping) {
    final OntologySourceProvenance provenance = subset.getOntologySource();
    final URI sourceIri = provenance == null ? null : provenance.getSourceIri();
    final boolean isExactMatch =
        mapping.getMappingType() == ConceptMapping.ConceptMappingType.EXACT_MATCH;
    final boolean matchesHref = sourceIri != null && sourceIri.equals(mapping.getConceptIri());
    final boolean matchesSource =
        provenance != null
            && provenance.getSourceGlossary() != null
            && provenance.getSourceGlossary().getName() != null
            && provenance.getSourceGlossary().getName().equals(mapping.getSource());
    final boolean matchesIdentity = sourceIri == null ? matchesSource : matchesHref;
    return isExactMatch && matchesIdentity;
  }
}

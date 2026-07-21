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

import java.net.URI;
import java.util.List;
import java.util.UUID;
import org.openmetadata.schema.api.data.ConceptMapping;
import org.openmetadata.schema.entity.data.Glossary;
import org.openmetadata.schema.entity.data.GlossaryTerm;
import org.openmetadata.schema.entity.data.RelationshipType;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.EntityStatus;
import org.openmetadata.schema.type.OntologyConfiguration;
import org.openmetadata.schema.type.OntologyLayer;
import org.openmetadata.schema.type.OntologySourceProvenance;
import org.openmetadata.schema.type.RelationProvenance;
import org.openmetadata.schema.type.TermRelation;
import org.openmetadata.service.ontology.OntologyStructuralDiffService.TermReader;

final class OntologyStructuralTestFixtures {
  static final long NOW = 1_788_200_000_000L;
  static final UUID SOURCE_ONE_ID = UUID.fromString("a4965864-3693-4149-9b8e-b729f92f6f14");
  static final UUID SOURCE_TWO_ID = UUID.fromString("a1c7c08b-bc2a-4932-9544-52db996492d6");

  private OntologyStructuralTestFixtures() {}

  static TermCase termCase() {
    final Glossary source = sourceGlossary();
    final Glossary target = targetGlossary();
    final GlossaryTerm sourceTerm = sourceTerm(source, SOURCE_ONE_ID, "Customer");
    final GlossaryTerm subsetTerm = subsetTerm(target, source, sourceTerm);
    return new TermCase(source, target, sourceTerm, subsetTerm);
  }

  static RelationshipCase relationshipCase() {
    final Glossary source = sourceGlossary();
    final Glossary target = targetGlossary();
    final GlossaryTerm sourceOne = sourceTerm(source, SOURCE_ONE_ID, "Customer");
    final GlossaryTerm sourceTwo = sourceTerm(source, SOURCE_TWO_ID, "Account");
    final GlossaryTerm subsetOne = subsetTerm(target, source, sourceOne);
    final GlossaryTerm subsetTwo = subsetTerm(target, source, sourceTwo);
    sourceOne.setRelatedTerms(List.of(relation(hasPart(), sourceTwo)));
    sourceTwo.setRelatedTerms(List.of(relation(partOf(), sourceOne)));
    return new RelationshipCase(source, target, sourceOne, sourceTwo, subsetOne, subsetTwo);
  }

  static TermReader reader(final List<GlossaryTerm> terms) {
    return termId ->
        terms.stream().filter(term -> term.getId().equals(termId)).findFirst().orElseThrow();
  }

  static RelationshipType hasPart() {
    return relationshipType("hasPart", "partOf");
  }

  static RelationshipType partOf() {
    return relationshipType("partOf", "hasPart");
  }

  static TermRelation relation(final RelationshipType relationshipType, final GlossaryTerm target) {
    return new TermRelation()
        .withId(UUID.randomUUID())
        .withRelationType(relationshipType.getName())
        .withRelationshipType(relationshipType.getEntityReference())
        .withTerm(target.getEntityReference())
        .withProvenance(RelationProvenance.IMPORTED)
        .withStatus(EntityStatus.DRAFT)
        .withCreatedBy("modeler")
        .withCreatedAt(NOW);
  }

  private static Glossary sourceGlossary() {
    return glossary(
        UUID.fromString("5cd42438-7026-48f1-a912-a33d8f3d6023"),
        "ReferenceModel",
        OntologyLayer.L_1,
        "https://example.org/reference/");
  }

  private static Glossary targetGlossary() {
    return glossary(
        UUID.fromString("6d29270a-41d8-48cb-a18c-b7f212685f34"),
        "ApplicationModel",
        OntologyLayer.L_3,
        "https://example.org/application/");
  }

  private static Glossary glossary(
      final UUID id, final String name, final OntologyLayer layer, final String baseIri) {
    return new Glossary()
        .withId(id)
        .withName(name)
        .withFullyQualifiedName(name)
        .withDescription(name + " description")
        .withVersion(0.4D)
        .withOntologyConfiguration(
            new OntologyConfiguration()
                .withBaseIri(URI.create(baseIri))
                .withLayer(layer)
                .withImports(List.of())
                .withPrefixes(List.of())
                .withIriMintingPattern("concept/{term}/{uuid}")
                .withReadOnly(false)
                .withInstalledPacks(List.of()));
  }

  private static GlossaryTerm sourceTerm(final Glossary source, final UUID id, final String name) {
    return new GlossaryTerm()
        .withId(id)
        .withName(name)
        .withDisplayName(name + " display")
        .withDescription(name + " description")
        .withFullyQualifiedName(source.getFullyQualifiedName() + '.' + name)
        .withGlossary(source.getEntityReference())
        .withIri(URI.create("https://example.org/reference/" + name))
        .withVersion(0.3D)
        .withEntityStatus(EntityStatus.APPROVED)
        .withConceptMappings(List.of())
        .withAttributes(List.of())
        .withRelatedTerms(List.of());
  }

  private static GlossaryTerm subsetTerm(
      final Glossary target, final Glossary source, final GlossaryTerm sourceTerm) {
    final UUID targetId = UUID.randomUUID();
    final ConceptMapping exactMatch =
        new ConceptMapping()
            .withConceptIri(sourceTerm.getIri())
            .withMappingType(ConceptMapping.ConceptMappingType.EXACT_MATCH)
            .withSource(source.getName());
    return new GlossaryTerm()
        .withId(targetId)
        .withName(sourceTerm.getName())
        .withDisplayName(sourceTerm.getDisplayName())
        .withDescription(sourceTerm.getDescription())
        .withFullyQualifiedName(target.getFullyQualifiedName() + '.' + sourceTerm.getName())
        .withGlossary(target.getEntityReference())
        .withIri(URI.create("https://example.org/application/" + targetId))
        .withVersion(0.2D)
        .withEntityStatus(sourceTerm.getEntityStatus())
        .withConceptMappings(List.of(exactMatch))
        .withAttributes(List.of())
        .withRelatedTerms(List.of())
        .withOntologySource(provenance(source, sourceTerm));
  }

  private static OntologySourceProvenance provenance(
      final Glossary source, final GlossaryTerm sourceTerm) {
    return new OntologySourceProvenance()
        .withSourceGlossary(source.getEntityReference())
        .withSourceGlossaryVersion(source.getVersion())
        .withSourceTerm(sourceTerm.getEntityReference())
        .withSourceTermVersion(sourceTerm.getVersion())
        .withSourceIri(sourceTerm.getIri())
        .withSourceSnapshot(OntologyTermStructureMapper.sourceStructure(sourceTerm))
        .withSelectedDirectly(true)
        .withCapturedAt(NOW)
        .withCapturedBy("modeler");
  }

  private static RelationshipType relationshipType(final String name, final String inverseName) {
    final EntityReference inverse =
        new EntityReference()
            .withId(RelationshipTypeIds.stableId(inverseName))
            .withType("relationshipType")
            .withName(inverseName)
            .withFullyQualifiedName(inverseName);
    return new RelationshipType()
        .withId(RelationshipTypeIds.stableId(name))
        .withName(name)
        .withFullyQualifiedName(name)
        .withDisplayName(name)
        .withDescription(name + " relationship")
        .withInverse(inverse);
  }

  record TermCase(
      Glossary source, Glossary target, GlossaryTerm sourceTerm, GlossaryTerm subsetTerm) {
    List<GlossaryTerm> terms() {
      return List.of(sourceTerm, subsetTerm);
    }
  }

  record RelationshipCase(
      Glossary source,
      Glossary target,
      GlossaryTerm sourceOne,
      GlossaryTerm sourceTwo,
      GlossaryTerm subsetOne,
      GlossaryTerm subsetTwo) {
    List<GlossaryTerm> terms() {
      return List.of(sourceOne, sourceTwo, subsetOne, subsetTwo);
    }

    List<GlossaryTerm> context() {
      return List.of(subsetOne, subsetTwo);
    }
  }
}

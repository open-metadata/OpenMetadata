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
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import org.openmetadata.schema.api.data.BuildOntologySubset;
import org.openmetadata.schema.entity.data.Glossary;
import org.openmetadata.schema.entity.data.GlossaryTerm;
import org.openmetadata.schema.entity.data.RelationshipType;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.EntityStatus;
import org.openmetadata.schema.type.OntologyConfiguration;
import org.openmetadata.schema.type.OntologyLayer;
import org.openmetadata.schema.type.RelationProvenance;
import org.openmetadata.schema.type.TermRelation;
import org.openmetadata.service.ontology.OntologySubsetTermSelector.TermLookup;

final class OntologySubsetTestFixtures {
  private static final String HAS_PART = "hasPart";
  private static final String PART_OF = "partOf";
  static final long NOW = 1_788_100_000_000L;
  static final Clock CLOCK = Clock.fixed(Instant.ofEpochMilli(NOW), ZoneOffset.UTC);
  static final UUID ROOT_ID = UUID.fromString("1165c76e-e832-4cd1-8c0a-4c8c7847483e");
  static final UUID CHILD_ID = UUID.fromString("3f89270a-41d8-48cb-a18c-b7f212685f34");
  static final UUID GRANDCHILD_ID = UUID.fromString("c384672a-5ab5-4666-96c8-1a69dbf67d8c");
  static final UUID EDGE_ID = UUID.fromString("ba3982cc-2c3f-43c3-bdc9-9cc226344a7a");

  private OntologySubsetTestFixtures() {}

  static Glossary sourceGlossary() {
    return glossary(
        UUID.fromString("91378fae-3e2d-48df-884b-d5512415c1bb"),
        "ReferenceModel",
        OntologyLayer.L_1,
        "https://example.org/reference/",
        0.4D);
  }

  static Glossary targetGlossary() {
    return glossary(
        UUID.fromString("d2b4cf5c-f408-43f7-917d-47097a2ee954"),
        "ApplicationModel",
        OntologyLayer.L_3,
        "https://example.org/application/",
        0.2D);
  }

  static List<GlossaryTerm> sourceTerms() {
    final Glossary source = sourceGlossary();
    final GlossaryTerm root = term(source, ROOT_ID, "Customer", null, 0.3D);
    final GlossaryTerm child = term(source, CHILD_ID, "Account", root, 0.2D);
    final GlossaryTerm grandchild = term(source, GRANDCHILD_ID, "Balance", child, 0.5D);
    root.setRelatedTerms(List.of(relation(EDGE_ID, HAS_PART, child, RelationProvenance.MANUAL)));
    child.setRelatedTerms(List.of(relation(EDGE_ID, PART_OF, root, RelationProvenance.MANUAL)));
    grandchild.setRelatedTerms(
        List.of(
            relation(
                UUID.fromString("70c66f97-21e7-49c4-9dfd-af09dc74f1c4"),
                "relatedTo",
                root,
                RelationProvenance.INFERRED)));
    return List.of(root, child, grandchild);
  }

  static BuildOntologySubset request(final boolean includeDescendants) {
    return new BuildOntologySubset()
        .withSourceGlossaryId(sourceGlossary().getId())
        .withTargetGlossaryId(targetGlossary().getId())
        .withSourceTermIds(Set.of(ROOT_ID))
        .withIncludeDescendants(includeDescendants)
        .withIncludeRelationships(true)
        .withChangeSetName("applicationSubset")
        .withChangeSetDisplayName("Application subset")
        .withChangeSetDescription("Version-pinned application concepts");
  }

  static OntologySubsetTermSelector selector() {
    return new OntologySubsetTermSelector(new ListTermLookup(sourceTerms()));
  }

  static OntologySubsetDraftFactory draftFactory() {
    return new OntologySubsetDraftFactory(
        new OntologyIriMinter(), OntologySubsetTestFixtures::relationshipType, CLOCK);
  }

  static RelationshipType relationshipType(final String name) {
    final String inverseName = inverseName(name);
    final EntityReference inverse =
        inverseName == null
            ? null
            : new EntityReference()
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

  private static Glossary glossary(
      final UUID id,
      final String name,
      final OntologyLayer layer,
      final String baseIri,
      final double version) {
    return new Glossary()
        .withId(id)
        .withName(name)
        .withFullyQualifiedName(name)
        .withDescription(name + " description")
        .withVersion(version)
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

  private static GlossaryTerm term(
      final Glossary glossary,
      final UUID id,
      final String name,
      final GlossaryTerm parent,
      final double version) {
    final String parentFqn =
        parent == null ? glossary.getFullyQualifiedName() : parent.getFullyQualifiedName();
    final String fqn = parentFqn + '.' + name;
    return new GlossaryTerm()
        .withId(id)
        .withName(name)
        .withDisplayName(name + " display")
        .withDescription(name + " source description")
        .withFullyQualifiedName(fqn)
        .withGlossary(glossary.getEntityReference())
        .withParent(parent == null ? null : parent.getEntityReference())
        .withIri(URI.create("https://example.org/reference/" + name))
        .withVersion(version)
        .withEntityStatus(EntityStatus.APPROVED)
        .withConceptMappings(List.of())
        .withAttributes(List.of());
  }

  private static TermRelation relation(
      final UUID id,
      final String type,
      final GlossaryTerm target,
      final RelationProvenance provenance) {
    return new TermRelation()
        .withId(id)
        .withRelationType(type)
        .withRelationshipType(relationshipType(type).getEntityReference())
        .withTerm(target.getEntityReference())
        .withProvenance(provenance)
        .withStatus(EntityStatus.APPROVED);
  }

  private static String inverseName(final String name) {
    final String inverse =
        switch (name) {
          case HAS_PART -> PART_OF;
          case PART_OF -> HAS_PART;
          default -> null;
        };
    return inverse;
  }

  private static final class ListTermLookup implements TermLookup {
    private final List<GlossaryTerm> terms;

    private ListTermLookup(final List<GlossaryTerm> terms) {
      this.terms = terms;
    }

    @Override
    public GlossaryTerm read(final UUID termId) {
      return terms.stream().filter(term -> term.getId().equals(termId)).findFirst().orElseThrow();
    }

    @Override
    public List<GlossaryTerm> descendants(final GlossaryTerm root, final int limit) {
      final String prefix = root.getFullyQualifiedName() + '.';
      return terms.stream()
          .filter(term -> term.getFullyQualifiedName().startsWith(prefix))
          .limit(limit)
          .toList();
    }
  }
}

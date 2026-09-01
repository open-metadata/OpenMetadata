/*
 *  Copyright 2026 Collate.
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

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.api.data.GlossaryTermRelationGraphEdge;
import org.openmetadata.schema.api.data.OntologyAssetCluster;
import org.openmetadata.schema.entity.data.GlossaryTerm;
import org.openmetadata.schema.entity.data.RelationshipType;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.EntityStatus;
import org.openmetadata.schema.type.RelationProvenance;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.schema.type.TermRelationMetadata;
import org.openmetadata.service.jdbi3.OntologyDAO.OntologyLineageRow;
import org.openmetadata.service.jdbi3.OntologyDAO.OntologyRelationRow;
import org.openmetadata.service.search.InheritedFieldEntitySearch.GlossaryTermAssetBucket;

class GlossaryTermRepositoryOntologyTest {

  @Test
  void excludesTermsWithoutAnAuthorizedAssetBucket() {
    GlossaryTerm visible = term("Visible");
    GlossaryTerm hidden = term("Hidden");
    GlossaryTermAssetBucket visibleBucket =
        new GlossaryTermAssetBucket(visible.getFullyQualifiedName(), 2, List.of());

    List<OntologyAssetCluster> clusters =
        GlossaryTermRepository.ontologyClusters(
            List.of(visible, hidden), Map.of(visible.getFullyQualifiedName(), visibleBucket));
    List<GlossaryTerm> visibleTerms =
        GlossaryTermRepository.visibleOntologyTerms(List.of(visible, hidden), clusters);

    assertEquals(1, clusters.size());
    assertEquals(visible.getId(), clusters.getFirst().getTerm().getId());
    assertEquals(2, clusters.getFirst().getAssetCount());
    assertEquals(List.of(visible), visibleTerms);
    assertEquals(
        List.of(visible.getId()),
        GlossaryTermRepository.visibleOntologySeedTermIds(List.of(visible, hidden), clusters));
  }

  @Test
  void includesConnectedTermsOutsideTheRankedSeedPageWithinTheBound() {
    GlossaryTerm firstSeed = term("FirstSeed");
    GlossaryTerm secondSeed = term("SecondSeed");
    GlossaryTerm firstContext = term("FirstContext");
    GlossaryTerm secondContext = term("SecondContext");
    List<OntologyRelationRow> relations =
        List.of(
            relation(firstSeed.getId(), secondSeed.getId(), Relationship.RELATED_TO),
            relation(firstSeed.getId(), firstContext.getId(), Relationship.RELATED_TO),
            relation(secondContext.getId(), secondSeed.getId(), Relationship.CONTAINS));

    assertEquals(
        List.of(firstContext.getId()),
        GlossaryTermRepository.connectedOntologyTermIds(
            List.of(firstSeed, secondSeed), relations, 1));
    assertEquals(
        List.of(firstContext.getId(), secondContext.getId()),
        GlossaryTermRepository.connectedOntologyTermIds(
            List.of(firstSeed, secondSeed), relations, 2));
  }

  @Test
  void mapsHierarchyAndObservedLineageIntoTheOntologyContract() {
    UUID parentId = UUID.randomUUID();
    UUID childId = UUID.randomUUID();
    OntologyRelationRow hierarchy = relation(parentId, childId, Relationship.CONTAINS);
    GlossaryTermRelationGraphEdge hierarchyEdge =
        GlossaryTermRepository.toOntologyParentEdge(hierarchy);

    assertNotNull(hierarchyEdge.getId());
    assertEquals(parentId, hierarchyEdge.getFrom());
    assertEquals(childId, hierarchyEdge.getTo());
    assertEquals("parentOf", hierarchyEdge.getRelationType());
    assertEquals(RelationProvenance.MANUAL, hierarchyEdge.getProvenance());
    assertEquals(EntityStatus.APPROVED, hierarchyEdge.getStatus());

    assertEquals(
        List.of(assetId(parentId), assetId(childId)),
        GlossaryTermRepository.ontologyAssetIds(
            List.of(cluster(parentId, parentId, childId), cluster(childId, childId))));
    assertEquals(
        parentId,
        GlossaryTermRepository.toOntologyLineageEdges(
                List.of(new OntologyLineageRow(parentId.toString(), childId.toString())))
            .getFirst()
            .getFromEntity());
    assertEquals(
        childId,
        GlossaryTermRepository.toOntologyLineageEdges(
                List.of(new OntologyLineageRow(parentId.toString(), childId.toString())))
            .getFirst()
            .getToEntity());
  }

  @Test
  void boundsAndDeduplicatesOntologyRelationCandidates() {
    UUID first = UUID.fromString("11111111-1111-1111-1111-111111111111");
    UUID second = UUID.fromString("22222222-2222-2222-2222-222222222222");
    UUID third = UUID.fromString("33333333-3333-3333-3333-333333333333");
    OntologyRelationRow duplicate = relation(first, second, Relationship.RELATED_TO);

    assertEquals(500, GlossaryTermRepository.ontologyRelationCandidateLimit(100));
    assertEquals(2500, GlossaryTermRepository.ontologyRelationCandidateLimit(500));
    assertEquals(
        List.of(duplicate, relation(third, first, Relationship.RELATED_TO)),
        GlossaryTermRepository.boundedOntologyRelations(
            List.of(duplicate),
            List.of(duplicate, relation(third, first, Relationship.RELATED_TO)),
            2));
  }

  @Test
  void skipsSemanticEdgesWithUnregisteredRelationshipTypes() {
    UUID from = UUID.randomUUID();
    UUID to = UUID.randomUUID();
    OntologyRelationRow relation = relation(from, to, Relationship.RELATED_TO);
    TermRelationMetadata metadata =
        new TermRelationMetadata()
            .withRelationType("relatedTo")
            .withProvenance(RelationProvenance.MANUAL)
            .withStatus(EntityStatus.APPROVED);

    assertTrue(GlossaryTermRepository.toOntologySemanticEdge(relation, metadata, null).isEmpty());

    RelationshipType relationshipType =
        new RelationshipType()
            .withId(UUID.randomUUID())
            .withName("relatedTo")
            .withFullyQualifiedName("relatedTo");
    var edge = GlossaryTermRepository.toOntologySemanticEdge(relation, metadata, relationshipType);

    assertTrue(edge.isPresent());
    assertEquals(from, edge.orElseThrow().getFrom());
    assertEquals(to, edge.orElseThrow().getTo());
    assertFalse(edge.orElseThrow().getRelationshipType().getId().toString().isBlank());
  }

  private static OntologyRelationRow relation(UUID from, UUID to, Relationship relationship) {
    return new OntologyRelationRow(from.toString(), to.toString(), relationship.ordinal(), null);
  }

  private static OntologyAssetCluster cluster(UUID termId, UUID... assetIds) {
    GlossaryTerm clusterTerm = term("Cluster" + termId);
    clusterTerm.setId(termId);
    GlossaryTermAssetBucket bucket =
        new GlossaryTermAssetBucket(
            clusterTerm.getFullyQualifiedName(),
            assetIds.length,
            List.of(assetIds).stream()
                .map(id -> new EntityReference().withId(id).withType("table"))
                .toList());
    return GlossaryTermRepository.ontologyClusters(
            List.of(clusterTerm), Map.of(clusterTerm.getFullyQualifiedName(), bucket))
        .getFirst();
  }

  private static String assetId(UUID id) {
    return id.toString();
  }

  private static GlossaryTerm term(String name) {
    return new GlossaryTerm()
        .withId(UUID.randomUUID())
        .withName(name)
        .withFullyQualifiedName("Ontology." + name);
  }
}

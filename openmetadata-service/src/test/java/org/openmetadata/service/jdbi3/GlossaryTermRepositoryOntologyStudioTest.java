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
import static org.junit.jupiter.api.Assertions.assertNotNull;

import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.api.data.GlossaryTermRelationGraphEdge;
import org.openmetadata.schema.api.data.OntologyStudioAsset;
import org.openmetadata.schema.api.data.OntologyStudioAssetCluster;
import org.openmetadata.schema.entity.data.GlossaryTerm;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.EntityStatus;
import org.openmetadata.schema.type.RelationProvenance;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.service.jdbi3.OntologyStudioDAO.StudioLineageRow;
import org.openmetadata.service.jdbi3.OntologyStudioDAO.StudioRelationRow;
import org.openmetadata.service.search.InheritedFieldEntitySearch.OntologyStudioAssetBucket;

class GlossaryTermRepositoryOntologyStudioTest {

  @Test
  void excludesTermsWithoutAnAuthorizedAssetBucket() {
    GlossaryTerm visible = term("Visible");
    GlossaryTerm hidden = term("Hidden");
    OntologyStudioAssetBucket visibleBucket =
        new OntologyStudioAssetBucket(visible.getFullyQualifiedName(), 2, List.of());

    List<OntologyStudioAssetCluster> clusters =
        GlossaryTermRepository.studioClusters(
            List.of(visible, hidden), Map.of(visible.getFullyQualifiedName(), visibleBucket));
    List<GlossaryTerm> visibleTerms =
        GlossaryTermRepository.visibleStudioTerms(List.of(visible, hidden), clusters);

    assertEquals(1, clusters.size());
    assertEquals(visible.getId(), clusters.getFirst().getTerm().getId());
    assertEquals(2, clusters.getFirst().getAssetCount());
    assertEquals(List.of(visible), visibleTerms);
  }

  @Test
  void includesConnectedTermsOutsideTheRankedSeedPageWithinTheBound() {
    GlossaryTerm firstSeed = term("FirstSeed");
    GlossaryTerm secondSeed = term("SecondSeed");
    GlossaryTerm firstContext = term("FirstContext");
    GlossaryTerm secondContext = term("SecondContext");
    List<StudioRelationRow> relations =
        List.of(
            relation(firstSeed.getId(), secondSeed.getId(), Relationship.RELATED_TO),
            relation(firstSeed.getId(), firstContext.getId(), Relationship.RELATED_TO),
            relation(secondContext.getId(), secondSeed.getId(), Relationship.CONTAINS));

    assertEquals(
        List.of(firstContext.getId()),
        GlossaryTermRepository.connectedStudioTermIds(
            List.of(firstSeed, secondSeed), relations, 1));
    assertEquals(
        List.of(firstContext.getId(), secondContext.getId()),
        GlossaryTermRepository.connectedStudioTermIds(
            List.of(firstSeed, secondSeed), relations, 2));
  }

  @Test
  void mapsHierarchyAndObservedLineageIntoTheStudioContract() {
    UUID parentId = UUID.randomUUID();
    UUID childId = UUID.randomUUID();
    StudioRelationRow hierarchy = relation(parentId, childId, Relationship.CONTAINS);
    GlossaryTermRelationGraphEdge hierarchyEdge =
        GlossaryTermRepository.toStudioParentEdge(hierarchy);

    assertNotNull(hierarchyEdge.getId());
    assertEquals(parentId, hierarchyEdge.getFrom());
    assertEquals(childId, hierarchyEdge.getTo());
    assertEquals("parentOf", hierarchyEdge.getRelationType());
    assertEquals(RelationProvenance.MANUAL, hierarchyEdge.getProvenance());
    assertEquals(EntityStatus.APPROVED, hierarchyEdge.getStatus());

    assertEquals(
        List.of(assetId(parentId), assetId(childId)),
        GlossaryTermRepository.studioAssetIds(
            List.of(cluster(parentId, parentId, childId), cluster(childId, childId))));
    assertEquals(
        parentId,
        GlossaryTermRepository.toStudioLineageEdges(
                List.of(new StudioLineageRow(parentId.toString(), childId.toString())))
            .getFirst()
            .getFromEntity());
    assertEquals(
        childId,
        GlossaryTermRepository.toStudioLineageEdges(
                List.of(new StudioLineageRow(parentId.toString(), childId.toString())))
            .getFirst()
            .getToEntity());
  }

  private static StudioRelationRow relation(UUID from, UUID to, Relationship relationship) {
    return new StudioRelationRow(from.toString(), to.toString(), relationship.ordinal(), null);
  }

  private static OntologyStudioAssetCluster cluster(UUID termId, UUID... assetIds) {
    GlossaryTerm clusterTerm = term("Cluster" + termId);
    clusterTerm.setId(termId);
    OntologyStudioAssetBucket bucket =
        new OntologyStudioAssetBucket(
            clusterTerm.getFullyQualifiedName(),
            assetIds.length,
            List.of(assetIds).stream()
                .map(
                    id ->
                        new OntologyStudioAsset()
                            .withEntity(new EntityReference().withId(id).withType("table")))
                .toList());
    return GlossaryTermRepository.studioClusters(
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
        .withFullyQualifiedName("Studio." + name);
  }
}

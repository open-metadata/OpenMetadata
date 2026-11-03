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

package org.openmetadata.service.migration.utils.v210;

import static org.junit.jupiter.api.Assertions.assertNull;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.LineageDetails;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.CollectionDAO;

class LineageEdgePipelineCleanupMigrationTest {

  private static final int UPSTREAM = Relationship.UPSTREAM.ordinal();

  @Test
  void clearsOnlyTheUpstreamEdgesThatNameANonPipeline() {
    UUID serviceFrom = UUID.randomUUID();
    UUID serviceTo = UUID.randomUUID();
    List<CollectionDAO.EntityRelationshipObject> batch =
        List.of(
            edge(serviceFrom, serviceTo, UPSTREAM, pipelineOfType(Entity.DATABASE_SERVICE)),
            edge(UUID.randomUUID(), UUID.randomUUID(), UPSTREAM, pipelineOfType(Entity.PIPELINE)),
            edge(
                UUID.randomUUID(),
                UUID.randomUUID(),
                Relationship.CONTAINS.ordinal(),
                pipelineOfType(Entity.DATABASE_SERVICE)));
    CollectionDAO.EntityRelationshipDAO relationshipDAO = relationshipDaoReturning(batch);

    LineageEdgePipelineCleanupMigration.clearNonPipelineEdgePipelines(
        collectionDaoOf(relationshipDAO));

    ArgumentCaptor<String> rewritten = ArgumentCaptor.forClass(String.class);
    verify(relationshipDAO, times(1))
        .insert(
            eq(serviceFrom),
            eq(serviceTo),
            eq("table"),
            eq("table"),
            eq(UPSTREAM),
            rewritten.capture());
    assertNull(JsonUtils.readValue(rewritten.getValue(), LineageDetails.class).getPipeline());
  }

  @Test
  void leavesAnEdgeWhosePipelineIsAPipelineUntouched() {
    List<CollectionDAO.EntityRelationshipObject> batch =
        List.of(
            edge(UUID.randomUUID(), UUID.randomUUID(), UPSTREAM, pipelineOfType(Entity.PIPELINE)));
    CollectionDAO.EntityRelationshipDAO relationshipDAO = relationshipDaoReturning(batch);

    LineageEdgePipelineCleanupMigration.clearNonPipelineEdgePipelines(
        collectionDaoOf(relationshipDAO));

    verify(relationshipDAO, never()).insert(any(), any(), any(), any(), anyInt(), any());
  }

  private static CollectionDAO.EntityRelationshipDAO relationshipDaoReturning(
      List<CollectionDAO.EntityRelationshipObject> firstPage) {
    CollectionDAO.EntityRelationshipDAO relationshipDAO =
        mock(CollectionDAO.EntityRelationshipDAO.class);
    when(relationshipDAO.getAllRelationshipsAfter(
            anyString(), anyString(), anyInt(), anyString(), anyInt()))
        .thenReturn(firstPage)
        .thenReturn(List.of());
    return relationshipDAO;
  }

  private static CollectionDAO collectionDaoOf(
      CollectionDAO.EntityRelationshipDAO relationshipDAO) {
    CollectionDAO collectionDAO = mock(CollectionDAO.class);
    when(collectionDAO.relationshipDAO()).thenReturn(relationshipDAO);
    return collectionDAO;
  }

  private static LineageDetails pipelineOfType(String type) {
    return new LineageDetails()
        .withPipeline(new EntityReference().withId(UUID.randomUUID()).withType(type));
  }

  private static CollectionDAO.EntityRelationshipObject edge(
      UUID fromId, UUID toId, int relation, LineageDetails details) {
    return CollectionDAO.EntityRelationshipObject.builder()
        .fromId(fromId.toString())
        .toId(toId.toString())
        .fromEntity("table")
        .toEntity("table")
        .relation(relation)
        .relationType("")
        .json(JsonUtils.pojoToJson(details))
        .build();
  }
}

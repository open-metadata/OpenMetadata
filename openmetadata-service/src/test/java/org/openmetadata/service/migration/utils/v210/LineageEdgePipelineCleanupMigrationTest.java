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

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.NavigableMap;
import java.util.TreeMap;
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
  private static final int CONTAINS = Relationship.CONTAINS.ordinal();

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
                CONTAINS,
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

  /**
   * Drives the keyset walk over more rows than a single batch holds, with a fake DAO that honors the
   * cursor, so a scan that skipped, re-read, or looped on a batch boundary would leave the wrong rows
   * cleared. Every seeded row's final state is asserted, so a row the cursor skips is caught.
   */
  @Test
  void walksEveryBatchClearingOnlyNonPipelineUpstreamEdgesAndIsIdempotent() {
    List<Seeded> seeded = new ArrayList<>();
    int upstreamCount = 650; // > BATCH_SIZE (500): forces at least two batches plus a terminator
    for (int i = 0; i < upstreamCount; i++) {
      seeded.add(seededUpstream(i));
    }
    int containsWithNonPipeline = 15; // non-UPSTREAM rows are read but must be left untouched
    for (int i = 0; i < containsWithNonPipeline; i++) {
      seeded.add(
          new Seeded(
              edge(
                  UUID.randomUUID(),
                  UUID.randomUUID(),
                  CONTAINS,
                  details(Entity.DATABASE_SERVICE, i)),
              false));
    }

    InMemoryRelationships store =
        new InMemoryRelationships(seeded.stream().map(Seeded::row).toList());
    LineageEdgePipelineCleanupMigration.clearNonPipelineEdgePipelines(store.collectionDAO);

    long expectedCleared = seeded.stream().filter(Seeded::clearedByMigration).count();
    assertEquals(expectedCleared, store.upserts, "cleared exactly the non-pipeline upstream edges");
    assertTrue(store.queries >= 2, "keyset walk spanned more than one batch");
    assertFinalState(seeded, store);

    int upsertsAfterFirstRun = store.upserts;
    LineageEdgePipelineCleanupMigration.clearNonPipelineEdgePipelines(store.collectionDAO);
    assertEquals(upsertsAfterFirstRun, store.upserts, "a second run rewrites nothing");
    assertFinalState(seeded, store);
  }

  private static void assertFinalState(List<Seeded> seeded, InMemoryRelationships store) {
    for (Seeded s : seeded) {
      LineageDetails details = store.detailsOf(s.row());
      assertEquals("q" + s.row().getToId(), details.getSqlQuery(), "unrelated metadata survives");
      if (s.clearedByMigration()) {
        assertNull(details.getPipeline(), "non-pipeline upstream reference is cleared");
      } else if (s.hadPipeline()) {
        assertNotNull(details.getPipeline(), "a pipeline or non-upstream reference survives");
      }
    }
  }

  private static Seeded seededUpstream(int i) {
    return switch (i % 5) {
      case 0 -> new Seeded(upstream(details(Entity.DATABASE_SERVICE, i)), true);
      case 1 -> new Seeded(upstream(details(Entity.PIPELINE, i)), false);
      case 2 -> new Seeded(upstream(details(Entity.STORED_PROCEDURE, i)), false);
      case 3 -> new Seeded(upstream(details(Entity.DASHBOARD_SERVICE, i)), true);
      default -> new Seeded(upstream(detailsWithoutPipeline(i)), false);
    };
  }

  private record Seeded(CollectionDAO.EntityRelationshipObject row, boolean clearedByMigration) {
    boolean hadPipeline() {
      return JsonUtils.readValue(row.getJson(), LineageDetails.class).getPipeline() != null;
    }
  }

  private static CollectionDAO.EntityRelationshipObject upstream(LineageDetails details) {
    return edge(UUID.randomUUID(), UUID.randomUUID(), UPSTREAM, details);
  }

  private static LineageDetails details(String pipelineType, int i) {
    return detailsWithoutPipeline(i)
        .withPipeline(new EntityReference().withId(UUID.randomUUID()).withType(pipelineType));
  }

  private static LineageDetails detailsWithoutPipeline(int i) {
    return new LineageDetails();
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
        .json(JsonUtils.pojoToJson(details.withSqlQuery("q" + toId)))
        .build();
  }

  /**
   * An in-memory {@link CollectionDAO.EntityRelationshipDAO} that pages with the same keyset seek the
   * migration issues: each read returns the rows ordered after the cursor, and each rewrite upserts
   * in place on the full key. State is exposed so a test can assert the rows the migration left.
   */
  private static final class InMemoryRelationships {
    private final NavigableMap<RelKey, CollectionDAO.EntityRelationshipObject> rows =
        new TreeMap<>();
    private final CollectionDAO collectionDAO;
    private int queries;
    private int upserts;

    InMemoryRelationships(List<CollectionDAO.EntityRelationshipObject> seed) {
      seed.forEach(row -> rows.put(RelKey.of(row), row));
      CollectionDAO.EntityRelationshipDAO dao = mock(CollectionDAO.EntityRelationshipDAO.class);
      when(dao.getAllRelationshipsAfter(anyString(), anyString(), anyInt(), anyString(), anyInt()))
          .thenAnswer(
              invocation ->
                  page(
                      new RelKey(
                          invocation.getArgument(0),
                          invocation.getArgument(1),
                          invocation.getArgument(2),
                          invocation.getArgument(3)),
                      invocation.getArgument(4)));
      doAnswer(invocation -> upsert(invocation.getArguments()))
          .when(dao)
          .insert(
              any(UUID.class), any(UUID.class), anyString(), anyString(), anyInt(), anyString());
      collectionDAO = mock(CollectionDAO.class);
      when(collectionDAO.relationshipDAO()).thenReturn(dao);
    }

    private List<CollectionDAO.EntityRelationshipObject> page(RelKey after, int limit) {
      queries++;
      return rows.tailMap(after, false).values().stream().limit(limit).toList();
    }

    private Object upsert(Object[] args) {
      upserts++;
      UUID fromId = (UUID) args[0];
      UUID toId = (UUID) args[1];
      RelKey key = new RelKey(fromId.toString(), toId.toString(), (int) args[4], "");
      rows.put(
          key,
          CollectionDAO.EntityRelationshipObject.builder()
              .fromId(fromId.toString())
              .toId(toId.toString())
              .fromEntity((String) args[2])
              .toEntity((String) args[3])
              .relation((int) args[4])
              .relationType("")
              .json((String) args[5])
              .build());
      return null;
    }

    private LineageDetails detailsOf(CollectionDAO.EntityRelationshipObject row) {
      return JsonUtils.readValue(rows.get(RelKey.of(row)).getJson(), LineageDetails.class);
    }
  }

  private record RelKey(String fromId, String toId, int relation, String relationType)
      implements Comparable<RelKey> {
    private static RelKey of(CollectionDAO.EntityRelationshipObject row) {
      String relationType = row.getRelationType() == null ? "" : row.getRelationType();
      return new RelKey(row.getFromId(), row.getToId(), row.getRelation(), relationType);
    }

    @Override
    public int compareTo(RelKey other) {
      return Comparator.comparing(RelKey::fromId)
          .thenComparing(RelKey::toId)
          .thenComparingInt(RelKey::relation)
          .thenComparing(RelKey::relationType)
          .compare(this, other);
    }
  }
}

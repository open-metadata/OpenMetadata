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
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.when;

import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.NavigableMap;
import java.util.TreeMap;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.mockito.MockedStatic;
import org.openmetadata.schema.entity.data.Pipeline;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.LineageDetails;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.CollectionDAO;

class ServiceLineagePipelineHopRepairMigrationTest {

  private static final int UPSTREAM = Relationship.UPSTREAM.ordinal();

  /**
   * Three pipeline-annotated child edges share a service pair (fromService -> pipelineService ->
   * toService). The existing hop rows carry the backfill's hard-coded assetEdges=1. The repair must
   * recompute each hop's refcount to 3 from the child edges themselves.
   */
  @Test
  void repairRecomputesAssetEdgesFromChildEdgesForExistingHopRows() {
    UUID fromServiceId = UUID.randomUUID();
    UUID toServiceId = UUID.randomUUID();
    UUID pipelineServiceId = UUID.randomUUID();

    TestTopology topo =
        new TestTopology()
            .withServices(fromServiceId, toServiceId, pipelineServiceId)
            .withChildEdges(3)
            .withExistingHops(fromServiceId, pipelineServiceId, toServiceId, 1);

    topo.runRepair();

    assertEquals(
        3,
        topo.assetEdgesOf(fromServiceId, pipelineServiceId),
        "fromService -> pipelineService hop must count the 3 contributing child edges");
    assertEquals(
        3,
        topo.assetEdgesOf(pipelineServiceId, toServiceId),
        "pipelineService -> toService hop must count the 3 contributing child edges");
  }

  /** A hop row the backfill never created is inserted with the recomputed count. */
  @Test
  void repairCreatesMissingHopRows() {
    UUID fromServiceId = UUID.randomUUID();
    UUID toServiceId = UUID.randomUUID();
    UUID pipelineServiceId = UUID.randomUUID();

    TestTopology topo =
        new TestTopology()
            .withServices(fromServiceId, toServiceId, pipelineServiceId)
            .withChildEdges(2);

    assertNull(
        topo.edgeRow(fromServiceId, pipelineServiceId),
        "precondition: the fromService -> pipelineService hop does not exist");

    topo.runRepair();

    assertEquals(
        2,
        topo.assetEdgesOf(fromServiceId, pipelineServiceId),
        "the missing hop must be created with the correct count");
    assertEquals(
        2,
        topo.assetEdgesOf(pipelineServiceId, toServiceId),
        "the missing hop must be created with the correct count");
  }

  /** A second run reads the same child rows, arrives at the same target, and changes nothing. */
  @Test
  void repairIsIdempotent() {
    UUID fromServiceId = UUID.randomUUID();
    UUID toServiceId = UUID.randomUUID();
    UUID pipelineServiceId = UUID.randomUUID();

    TestTopology topo =
        new TestTopology()
            .withServices(fromServiceId, toServiceId, pipelineServiceId)
            .withChildEdges(3)
            .withExistingHops(fromServiceId, pipelineServiceId, toServiceId, 1);

    topo.runRepair();
    int upsertsAfterFirstRun = topo.upserts();
    assertEquals(3, topo.assetEdgesOf(fromServiceId, pipelineServiceId));

    topo.runRepair();

    assertEquals(
        upsertsAfterFirstRun,
        topo.upserts(),
        "a second run must not rewrite a hop whose count already matches");
    assertEquals(3, topo.assetEdgesOf(fromServiceId, pipelineServiceId), "count must remain 3");
  }

  /** Plain (non-pipeline-annotated) child edges do not contribute to pipeline-service hops. */
  @Test
  void repairSkipsNonPipelineAnnotatedEdges() {
    UUID fromServiceId = UUID.randomUUID();
    UUID toServiceId = UUID.randomUUID();
    UUID pipelineServiceId = UUID.randomUUID();

    TestTopology topo =
        new TestTopology()
            .withServices(fromServiceId, toServiceId, pipelineServiceId)
            .withChildEdges(2)
            .withPlainChildEdge()
            .withExistingHops(fromServiceId, pipelineServiceId, toServiceId, 1);

    topo.runRepair();

    assertEquals(
        2,
        topo.assetEdgesOf(fromServiceId, pipelineServiceId),
        "only the 2 pipeline-annotated edges must be counted");
  }

  /**
   * Drives the keyset walk over more rows than a single batch holds, so a scan that skipped or
   * looped on a batch boundary would leave the wrong count.
   */
  @Test
  void repairWalksEveryBatch() {
    UUID fromServiceId = UUID.randomUUID();
    UUID toServiceId = UUID.randomUUID();
    UUID pipelineServiceId = UUID.randomUUID();

    TestTopology topo =
        new TestTopology()
            .withServices(fromServiceId, toServiceId, pipelineServiceId)
            .withChildEdges(650)
            .withExistingHops(fromServiceId, pipelineServiceId, toServiceId, 1);

    topo.runRepair();

    assertTrue(topo.queries() >= 2, "keyset walk spanned more than one batch");
    assertEquals(
        650,
        topo.assetEdgesOf(fromServiceId, pipelineServiceId),
        "all 650 contributing child edges must be counted across batch boundaries");
    assertEquals(
        650,
        topo.assetEdgesOf(pipelineServiceId, toServiceId),
        "all 650 contributing child edges must be counted across batch boundaries");
  }

  // --- Test infrastructure ---

  private static final class TestTopology {
    private final InMemoryRelationships store = new InMemoryRelationships();
    private final Map<UUID, EntityReference> entityServices = new HashMap<>();
    private UUID fromServiceId;
    private UUID toServiceId;
    private UUID pipelineServiceId;

    int queries() {
      return store.queries;
    }

    int upserts() {
      return store.upserts;
    }

    TestTopology withServices(UUID from, UUID to, UUID pipeline) {
      this.fromServiceId = from;
      this.toServiceId = to;
      this.pipelineServiceId = pipeline;
      return this;
    }

    TestTopology withChildEdges(int count) {
      for (int i = 0; i < count; i++) {
        UUID fromTable = UUID.randomUUID();
        UUID toTable = UUID.randomUUID();
        UUID pipeline = UUID.randomUUID();
        entityServices.put(fromTable, serviceRef(fromServiceId, Entity.DATABASE_SERVICE));
        entityServices.put(toTable, serviceRef(toServiceId, Entity.DATABASE_SERVICE));
        entityServices.put(pipeline, serviceRef(pipelineServiceId, Entity.PIPELINE_SERVICE));
        store.add(childEdge(fromTable, toTable, pipeline));
      }
      return this;
    }

    TestTopology withPlainChildEdge() {
      UUID fromTable = UUID.randomUUID();
      UUID toTable = UUID.randomUUID();
      entityServices.put(fromTable, serviceRef(fromServiceId, Entity.DATABASE_SERVICE));
      entityServices.put(toTable, serviceRef(toServiceId, Entity.DATABASE_SERVICE));
      store.add(plainChildEdge(fromTable, toTable));
      return this;
    }

    TestTopology withExistingHops(
        UUID fromService, UUID pipelineService, UUID toService, int assetEdges) {
      store.add(
          serviceHopRow(
              fromService,
              Entity.DATABASE_SERVICE,
              pipelineService,
              Entity.PIPELINE_SERVICE,
              assetEdges));
      store.add(
          serviceHopRow(
              pipelineService,
              Entity.PIPELINE_SERVICE,
              toService,
              Entity.DATABASE_SERVICE,
              assetEdges));
      return this;
    }

    int assetEdgesOf(UUID fromId, UUID toId) {
      CollectionDAO.EntityRelationshipObject row = edgeRow(fromId, toId);
      assertNotNull(row, "expected service edge " + fromId + " -> " + toId + " is missing");
      LineageDetails details = JsonUtils.readValue(row.getJson(), LineageDetails.class);
      return details.getAssetEdges() == null ? 0 : details.getAssetEdges();
    }

    CollectionDAO.EntityRelationshipObject edgeRow(UUID fromId, UUID toId) {
      return store.getRecord(fromId, toId, UPSTREAM);
    }

    void runRepair() {
      try (MockedStatic<Entity> entityStatic = mockStatic(Entity.class)) {
        entityStatic
            .when(() -> Entity.entityHasField(anyString(), eq(Entity.FIELD_SERVICE)))
            .thenReturn(true);
        entityStatic
            .when(
                () ->
                    Entity.getEntity(
                        anyString(), any(UUID.class), eq(Entity.FIELD_SERVICE), eq(Include.ALL)))
            .thenAnswer(
                inv -> {
                  String type = inv.getArgument(0);
                  UUID id = inv.getArgument(1);
                  EntityReference svc = entityServices.get(id);
                  if (svc == null) {
                    return null;
                  }
                  if (Entity.PIPELINE.equals(type)) {
                    Pipeline p = new Pipeline();
                    p.setService(svc);
                    return p;
                  }
                  Table t = new Table();
                  t.setService(svc);
                  return t;
                });
        ServiceLineagePipelineHopRepairMigration.repairPipelineServiceHopRefcounts(
            store.collectionDAO);
      }
    }

    private CollectionDAO.EntityRelationshipObject childEdge(
        UUID fromTable, UUID toTable, UUID pipeline) {
      LineageDetails details =
          new LineageDetails()
              .withSource(LineageDetails.Source.PIPELINE_LINEAGE)
              .withPipeline(new EntityReference().withId(pipeline).withType(Entity.PIPELINE));
      return CollectionDAO.EntityRelationshipObject.builder()
          .fromId(fromTable.toString())
          .toId(toTable.toString())
          .fromEntity(Entity.TABLE)
          .toEntity(Entity.TABLE)
          .relation(UPSTREAM)
          .relationType("")
          .json(JsonUtils.pojoToJson(details))
          .build();
    }

    private CollectionDAO.EntityRelationshipObject plainChildEdge(UUID fromTable, UUID toTable) {
      LineageDetails details = new LineageDetails().withSource(LineageDetails.Source.MANUAL);
      return CollectionDAO.EntityRelationshipObject.builder()
          .fromId(fromTable.toString())
          .toId(toTable.toString())
          .fromEntity(Entity.TABLE)
          .toEntity(Entity.TABLE)
          .relation(UPSTREAM)
          .relationType("")
          .json(JsonUtils.pojoToJson(details))
          .build();
    }

    private CollectionDAO.EntityRelationshipObject serviceHopRow(
        UUID fromId, String fromType, UUID toId, String toType, int assetEdges) {
      LineageDetails details =
          new LineageDetails()
              .withSource(LineageDetails.Source.CHILD_ASSETS)
              .withPipeline(null)
              .withAssetEdges(assetEdges);
      return CollectionDAO.EntityRelationshipObject.builder()
          .fromId(fromId.toString())
          .toId(toId.toString())
          .fromEntity(fromType)
          .toEntity(toType)
          .relation(UPSTREAM)
          .relationType("")
          .json(JsonUtils.pojoToJson(details))
          .build();
    }

    private static EntityReference serviceRef(UUID id, String type) {
      return new EntityReference().withId(id).withType(type);
    }
  }

  /** An in-memory entity_relationship table that honors the keyset seek and upsert semantics. */
  private static final class InMemoryRelationships {
    private final NavigableMap<RelKey, CollectionDAO.EntityRelationshipObject> rows =
        new TreeMap<>();
    private final CollectionDAO.EntityRelationshipDAO dao;
    private final CollectionDAO collectionDAO;
    private int queries;
    private int upserts;

    InMemoryRelationships() {
      dao = mock(CollectionDAO.EntityRelationshipDAO.class);
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
      when(dao.getRecord(any(UUID.class), any(UUID.class), anyInt()))
          .thenAnswer(
              invocation -> {
                RelKey key =
                    new RelKey(
                        invocation.getArgument(0).toString(),
                        invocation.getArgument(1).toString(),
                        invocation.getArgument(2),
                        "");
                return rows.get(key);
              });
      doAnswer(invocation -> upsert(invocation.getArguments()))
          .when(dao)
          .insert(
              any(UUID.class), any(UUID.class), anyString(), anyString(), anyInt(), anyString());
      collectionDAO = mock(CollectionDAO.class);
      when(collectionDAO.relationshipDAO()).thenReturn(dao);
    }

    void add(CollectionDAO.EntityRelationshipObject row) {
      rows.put(RelKey.of(row), row);
    }

    CollectionDAO.EntityRelationshipObject getRecord(UUID fromId, UUID toId, int relation) {
      return rows.get(new RelKey(fromId.toString(), toId.toString(), relation, ""));
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

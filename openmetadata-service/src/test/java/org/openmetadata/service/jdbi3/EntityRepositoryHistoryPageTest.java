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
package org.openmetadata.service.jdbi3;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Base64;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicLong;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.entity.data.Pipeline;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.schema.utils.ResultList;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.util.EntityUtil.Fields;
import org.openmetadata.service.util.EntityUtil.RelationIncludes;

/**
 * {@link EntityRepository#listEntityHistoryByTimestamp} reads version rows without a lock, so an
 * entity in the page can be hard-deleted by a concurrent request before the page is hydrated.
 * These tests pin the contract for that window: the page is still served, and it lists only
 * entities that still exist.
 */
class EntityRepositoryHistoryPageTest {

  // Distinct windows per test keep the repository's static version-count cache from crossing over.
  private static final AtomicLong WINDOW = new AtomicLong(1_000_000L);

  private CollectionDAO daoCollection;
  private CollectionDAO.EntityExtensionDAO extensionDAO;
  private CollectionDAO.PipelineDAO pipelineDAO;

  /** Hydration stub: batches that contain a vanished id fail like a strict reference lookup. */
  private static class HistoryPipelineRepo extends EntityRepository<Pipeline> {
    final Set<UUID> vanishedDuringHydration = new HashSet<>();
    int bulkHydrations = 0;

    HistoryPipelineRepo(CollectionDAO.PipelineDAO dao) {
      super("pipelines", Entity.PIPELINE, Pipeline.class, dao, "", "");
    }

    @Override
    public void setFieldsInBulk(Fields fields, List<Pipeline> entities) {
      bulkHydrations++;
      for (Pipeline entity : entities) {
        if (vanishedDuringHydration.contains(entity.getId())) {
          throw new EntityNotFoundException(
              "pipeline instance for " + entity.getId() + " not found");
        }
      }
    }

    @Override
    protected void setFields(Pipeline entity, Fields fields, RelationIncludes includes) {}

    @Override
    protected void clearFields(Pipeline entity, Fields fields) {}

    @Override
    protected void prepare(Pipeline entity, boolean update) {}

    @Override
    protected void storeEntity(Pipeline entity, boolean update) {}

    @Override
    protected void storeRelationships(Pipeline entity) {}
  }

  @BeforeEach
  void setUp() {
    daoCollection = mock(CollectionDAO.class);
    extensionDAO = mock(CollectionDAO.EntityExtensionDAO.class);
    pipelineDAO = mock(CollectionDAO.PipelineDAO.class);
    when(daoCollection.entityExtensionDAO()).thenReturn(extensionDAO);
    when(daoCollection.relationshipDAO())
        .thenReturn(mock(CollectionDAO.EntityRelationshipDAO.class));
    when(pipelineDAO.getTableName()).thenReturn("pipeline_entity");
    Entity.setCollectionDAO(daoCollection);
  }

  @AfterEach
  void tearDown() {
    Entity.setCollectionDAO(null);
  }

  @Test
  void historyPage_isServedWhenAnEntityVanishesDuringHydration() {
    HistoryPipelineRepo repo = new HistoryPipelineRepo(pipelineDAO);
    Pipeline survivor = version(30L);
    Pipeline vanished = version(20L);
    Pipeline older = version(10L);
    long startTs = WINDOW.getAndAdd(100L);
    stubVersionRows(startTs, List.of(survivor, vanished, older));
    stubExistingRows(List.of(survivor, older));
    repo.vanishedDuringHydration.add(vanished.getId());

    ResultList<Pipeline> page =
        repo.listEntityHistoryByTimestamp(startTs, startTs + 99L, null, null, 10);

    assertEquals(List.of(survivor.getId(), older.getId()), ids(page));
    assertEquals(4, repo.bulkHydrations, "one failed batch, then one hydration per row");
    assertEquals(3, page.getPaging().getTotal());
    assertNull(page.getPaging().getAfter());
  }

  @Test
  void historyPage_dropsAnEntityWhoseRowVanishedAfterHydration() {
    HistoryPipelineRepo repo = new HistoryPipelineRepo(pipelineDAO);
    Pipeline survivor = version(30L);
    Pipeline vanished = version(20L);
    long startTs = WINDOW.getAndAdd(100L);
    stubVersionRows(startTs, List.of(survivor, vanished));
    stubExistingRows(List.of(survivor));

    ResultList<Pipeline> page =
        repo.listEntityHistoryByTimestamp(startTs, startTs + 99L, null, null, 10);

    assertEquals(List.of(survivor.getId()), ids(page));
    assertEquals(1, repo.bulkHydrations, "a healthy batch is hydrated exactly once");
  }

  @Test
  void historyPage_pagesFromTheLastSurvivingRow() {
    HistoryPipelineRepo repo = new HistoryPipelineRepo(pipelineDAO);
    Pipeline first = version(30L);
    Pipeline last = version(20L);
    Pipeline beyondPage = version(10L);
    long startTs = WINDOW.getAndAdd(100L);
    stubVersionRows(startTs, List.of(first, last, beyondPage));
    stubExistingRows(List.of(first, last));

    ResultList<Pipeline> page =
        repo.listEntityHistoryByTimestamp(startTs, startTs + 99L, null, null, 2);

    assertEquals(List.of(first.getId(), last.getId()), ids(page));
    assertEquals(
        last.getUpdatedAt() + ":" + last.getId(), decodeCursor(page.getPaging().getAfter()));
  }

  private static Pipeline version(long updatedAt) {
    return new Pipeline()
        .withId(UUID.randomUUID())
        .withName("p" + updatedAt)
        .withUpdatedAt(updatedAt)
        .withUpdatedBy("admin")
        .withVersion(0.1);
  }

  private void stubVersionRows(long startTs, List<Pipeline> rows) {
    List<String> jsons = rows.stream().map(JsonUtils::pojoToJson).toList();
    when(extensionDAO.getEntityHistoryByTimestampRange(
            anyString(),
            eq(startTs),
            anyLong(),
            anyString(),
            anyString(),
            anyString(),
            any(),
            any(),
            anyInt()))
        .thenReturn(jsons);
    when(extensionDAO.getEntityHistoryByTimestampRangeCount(
            anyString(), eq(startTs), anyLong(), anyString()))
        .thenReturn(rows.size());
  }

  private void stubExistingRows(List<Pipeline> rows) {
    List<EntityReference> refs =
        rows.stream()
            .map(row -> new EntityReference().withId(row.getId()).withType(Entity.PIPELINE))
            .toList();
    when(pipelineDAO.findReferencesByIds(anyList(), eq(Include.ALL))).thenReturn(refs);
  }

  private static String decodeCursor(String cursor) {
    return new String(Base64.getDecoder().decode(cursor), StandardCharsets.UTF_8);
  }

  private static List<UUID> ids(ResultList<Pipeline> page) {
    List<UUID> ids = new ArrayList<>();
    page.getData().forEach(row -> ids.add(row.getId()));
    return ids;
  }
}

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
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
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
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.schema.utils.ResultList;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.util.EntityUtil.Fields;
import org.openmetadata.service.util.EntityUtil.RelationIncludes;

/**
 * {@link EntityRepository#listEntityHistoryByTimestamp} reads version rows without a lock, so an
 * entity in the window can be hard-deleted before the page is hydrated. These tests pin what the
 * reader gets in that window: the page is still served, and the cursor still describes the rows the
 * query returned so a paged walk neither repeats a page nor stops before its last one.
 */
class EntityRepositoryHistoryPageTest {

  // Distinct windows per test keep the repository's static version-count cache from crossing over.
  private static final AtomicLong WINDOW = new AtomicLong(1_000_000L);

  private CollectionDAO.EntityExtensionDAO extensionDAO;
  private CollectionDAO.PipelineDAO pipelineDAO;

  /** Hydration stub: a batch holding a vanished id fails the way a strict reference lookup does. */
  private static class HistoryPipelineRepo extends EntityRepository<Pipeline> {
    final Set<UUID> vanished = new HashSet<>();
    int hydrationCalls = 0;

    HistoryPipelineRepo(CollectionDAO.PipelineDAO dao) {
      super("pipelines", Entity.PIPELINE, Pipeline.class, dao, "", "");
    }

    @Override
    public void setFieldsInBulk(Fields fields, List<Pipeline> entities) {
      hydrationCalls++;
      for (Pipeline entity : entities) {
        if (vanished.contains(entity.getId())) {
          throw new EntityNotFoundException("Entity not found: pipeline " + entity.getId());
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
    CollectionDAO daoCollection = mock(CollectionDAO.class);
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
    Pipeline newest = version(30L);
    Pipeline gone = version(20L);
    Pipeline oldest = version(10L);
    long startTs = window();
    stubVersionRows(startTs, List.of(newest, gone, oldest));
    repo.vanished.add(gone.getId());

    ResultList<Pipeline> page =
        repo.listEntityHistoryByTimestamp(startTs, startTs + 99L, null, null, 10);

    assertEquals(List.of(newest.getId(), oldest.getId()), ids(page));
    assertEquals(4, repo.hydrationCalls, "one failed batch, then one hydration per row");
  }

  @Test
  void historyPage_hydratesAHealthyPageInOneBatch() {
    HistoryPipelineRepo repo = new HistoryPipelineRepo(pipelineDAO);
    Pipeline newest = version(30L);
    Pipeline oldest = version(20L);
    long startTs = window();
    stubVersionRows(startTs, List.of(newest, oldest));

    ResultList<Pipeline> page =
        repo.listEntityHistoryByTimestamp(startTs, startTs + 99L, null, null, 10);

    assertEquals(List.of(newest.getId(), oldest.getId()), ids(page));
    assertEquals(1, repo.hydrationCalls, "no vanished row means no row-by-row retry");
  }

  /**
   * The cursor has to name the last row the query returned, not the last row that survived: pointing
   * it at a survivor makes the next page re-read everything after that survivor, so the walk repeats
   * rows it has already seen.
   */
  @Test
  void historyPage_cursorNamesTheLastQueriedRow_notTheLastSurvivor() {
    HistoryPipelineRepo repo = new HistoryPipelineRepo(pipelineDAO);
    Pipeline newest = version(30L);
    Pipeline gone = version(20L);
    Pipeline beyondPage = version(10L);
    long startTs = window();
    stubVersionRows(startTs, List.of(newest, gone, beyondPage));
    repo.vanished.add(gone.getId());

    ResultList<Pipeline> page =
        repo.listEntityHistoryByTimestamp(startTs, startTs + 99L, null, null, 2);

    assertEquals(List.of(newest.getId()), ids(page));
    assertEquals(cursorOf(gone), decodeCursor(page.getPaging().getAfter()));
  }

  /** A page whose every row vanished must still hand back a cursor, or the walk ends early. */
  @Test
  void historyPage_keepsPagingWhenEveryRowVanishes() {
    HistoryPipelineRepo repo = new HistoryPipelineRepo(pipelineDAO);
    Pipeline gone = version(30L);
    Pipeline alsoGone = version(20L);
    Pipeline beyondPage = version(10L);
    long startTs = window();
    stubVersionRows(startTs, List.of(gone, alsoGone, beyondPage));
    repo.vanished.add(gone.getId());
    repo.vanished.add(alsoGone.getId());

    ResultList<Pipeline> page =
        repo.listEntityHistoryByTimestamp(startTs, startTs + 99L, null, null, 2);

    assertTrue(page.getData().isEmpty(), "both rows vanished");
    assertEquals(cursorOf(alsoGone), decodeCursor(page.getPaging().getAfter()));
  }

  private static long window() {
    return WINDOW.getAndAdd(1_000L);
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

  private static String cursorOf(Pipeline entity) {
    return entity.getUpdatedAt() + ":" + entity.getId();
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

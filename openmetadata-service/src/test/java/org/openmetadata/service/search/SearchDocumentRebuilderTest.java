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
package org.openmetadata.service.search;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.mockito.MockedStatic;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.tests.TestSuite;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.search.IndexMapping;
import org.openmetadata.service.Entity;
import org.openmetadata.service.apps.bundles.searchIndex.BulkSink;
import org.openmetadata.service.jdbi3.EntityDAO;
import org.openmetadata.service.jdbi3.EntityRepository;
import org.openmetadata.service.workflows.searchIndex.ReindexingUtil;

class SearchDocumentRebuilderTest {
  private static final long READ_AT = 1_700_000_000_000L;

  @Test
  void staleDeleteReachesCurrentAndStagedIndexes() throws Exception {
    SearchRepository searchRepository = mock(SearchRepository.class);
    SearchClient searchClient = mock(SearchClient.class);
    IndexMapping indexMapping = mock(IndexMapping.class);
    SearchDocumentRebuilder rebuilder = new SearchDocumentRebuilder(searchRepository);
    String entityId = UUID.randomUUID().toString();
    when(searchRepository.getIndexMapping(Entity.TOPIC)).thenReturn(indexMapping);
    when(searchRepository.getClusterAlias()).thenReturn("openmetadata");
    when(indexMapping.getIndexName("openmetadata")).thenReturn("openmetadata_topic_search_index");
    when(searchRepository.getWriteFanoutTargets("openmetadata_topic_search_index"))
        .thenReturn(List.of("openmetadata_topic_search_index", "topic_search_index_staged"));
    when(searchRepository.getSearchClient()).thenReturn(searchClient);

    rebuilder.removeDocument(entityId, Entity.TOPIC);

    verify(searchClient).deleteEntity("openmetadata_topic_search_index", entityId);
    verify(searchClient).deleteEntity("topic_search_index_staged", entityId);
  }

  @Test
  void aRowDeletedAfterTheRetryReadItLosesTheDocumentTheRetryWrote() throws Exception {
    final SearchRepository searchRepository = mock(SearchRepository.class);
    final SearchClient searchClient = mock(SearchClient.class);
    final IndexMapping indexMapping = mock(IndexMapping.class);
    @SuppressWarnings("unchecked")
    final EntityRepository<EntityInterface<?>> topics = mock(EntityRepository.class);
    @SuppressWarnings("unchecked")
    final EntityDAO<EntityInterface<?>> topicRows = mock(EntityDAO.class);
    final EntityInterface<?> kept = topic();
    final EntityInterface<?> deleted = topic();
    final String keptId = kept.getId().toString();
    when(searchRepository.getIndexMapping(Entity.TOPIC)).thenReturn(indexMapping);
    when(searchRepository.getClusterAlias()).thenReturn("openmetadata");
    when(indexMapping.getIndexName("openmetadata")).thenReturn("openmetadata_topic_search_index");
    when(searchRepository.getWriteFanoutTargets("openmetadata_topic_search_index"))
        .thenReturn(List.of("openmetadata_topic_search_index"));
    when(searchRepository.getSearchClient()).thenReturn(searchClient);
    when(topics.getDao()).thenReturn(topicRows);
    when(topicRows.getTableName()).thenReturn("topic_entity");
    when(topicRows.findExistingIds(eq("topic_entity"), anyList())).thenReturn(List.of(keptId));
    final SearchDocumentRebuilder rebuilder = new SearchDocumentRebuilder(searchRepository);

    try (MockedStatic<Entity> entityMock = mockStatic(Entity.class)) {
      entityMock.when(() -> Entity.getEntityRepository(Entity.TOPIC)).thenReturn(topics);

      rebuilder.removeDocumentsOfRowsDeletedSinceRead(Map.of(Entity.TOPIC, List.of(kept, deleted)));
    }

    verify(searchClient)
        .deleteEntity("openmetadata_topic_search_index", deleted.getId().toString());
    verify(searchClient, never()).deleteEntity("openmetadata_topic_search_index", keptId);
  }

  @SuppressWarnings("unchecked")
  private static MockedStatic<Entity> rowsExist(final String entityType, final UUID entityId) {
    final EntityRepository<EntityInterface<?>> repository = mock(EntityRepository.class);
    final EntityDAO<EntityInterface<?>> rows = mock(EntityDAO.class);
    when(repository.getDao()).thenReturn(rows);
    when(rows.getTableName()).thenReturn(entityType + "_entity");
    when(rows.findExistingIds(anyString(), anyList())).thenReturn(List.of(entityId.toString()));
    final MockedStatic<Entity> entity = mockStatic(Entity.class);
    entity.when(() -> Entity.getEntityRepository(entityType)).thenReturn(repository);
    return entity;
  }

  private static EntityInterface<?> topic() {
    final EntityInterface<?> entity = mock(EntityInterface.class);
    when(entity.getId()).thenReturn(UUID.randomUUID());
    return entity;
  }

  @Test
  void testCaseRetryPreservesThenFencesRelationshipFields() throws Exception {
    SearchRepository searchRepository = mock(SearchRepository.class);
    BulkSink bulkSink = mock(BulkSink.class);
    when(searchRepository.createBulkSink(
            200, 5, SearchClusterMetrics.DEFAULT_BULK_PAYLOAD_SIZE_BYTES))
        .thenReturn(bulkSink);
    when(bulkSink.flushAndAwait(60)).thenReturn(true);
    SearchDocumentRebuilder rebuilder = new SearchDocumentRebuilder(searchRepository);
    UUID testCaseId = UUID.randomUUID();
    EntityInterface<?> testCase = mock(EntityInterface.class);
    when(testCase.getId()).thenReturn(testCaseId);
    when(testCase.getEntityReference())
        .thenReturn(
            new EntityReference().withId(testCaseId).withType(Entity.TEST_CASE).withName("test"));

    try (MockedStatic<ReindexingUtil> reindexingUtil = mockStatic(ReindexingUtil.class);
        MockedStatic<Entity> rows = rowsExist(Entity.TEST_CASE, testCaseId)) {
      rebuilder.write(List.of(testCase), Map.of(testCaseId, 17L), READ_AT);
    }

    @SuppressWarnings("unchecked")
    ArgumentCaptor<Map<String, Object>> contextCaptor = ArgumentCaptor.forClass(Map.class);
    verify(bulkSink, times(2)).write(eq(List.of(testCase)), contextCaptor.capture());
    Map<String, Object> documentContext = contextCaptor.getAllValues().get(0);
    Map<String, Object> relationshipContext = contextCaptor.getAllValues().get(1);
    assertEquals(
        Map.of(testCaseId, 17L), documentContext.get(BulkSink.RELATIONSHIP_REVISIONS_CONTEXT_KEY));
    assertFalse(documentContext.containsKey(BulkSink.SCRIPTED_PARTIAL_UPDATES_CONTEXT_KEY));
    assertTrue((Boolean) relationshipContext.get(BulkSink.FENCED_RELATIONSHIPS_CONTEXT_KEY));
    assertEquals(
        Map.of(testCaseId, 17L),
        relationshipContext.get(BulkSink.RELATIONSHIP_REVISIONS_CONTEXT_KEY));
    assertEquals(READ_AT, documentContext.get(BulkSink.SOURCE_READ_AT_CONTEXT_KEY));
    assertEquals(READ_AT, relationshipContext.get(BulkSink.SOURCE_READ_AT_CONTEXT_KEY));
    verify(bulkSink).flushAndAwait(60);
    verify(bulkSink).close();
  }

  @Test
  void logicalTestSuiteRetryPreservesThenFencesRelationshipFields() throws Exception {
    SearchRepository searchRepository = mock(SearchRepository.class);
    BulkSink bulkSink = mock(BulkSink.class);
    when(searchRepository.createBulkSink(
            200, 5, SearchClusterMetrics.DEFAULT_BULK_PAYLOAD_SIZE_BYTES))
        .thenReturn(bulkSink);
    when(bulkSink.flushAndAwait(60)).thenReturn(true);
    SearchDocumentRebuilder rebuilder = new SearchDocumentRebuilder(searchRepository);
    UUID testSuiteId = UUID.randomUUID();
    TestSuite testSuite = mock(TestSuite.class);
    when(testSuite.getId()).thenReturn(testSuiteId);
    when(testSuite.getBasic()).thenReturn(false);
    when(testSuite.getEntityReference())
        .thenReturn(
            new EntityReference()
                .withId(testSuiteId)
                .withType(Entity.TEST_SUITE)
                .withName("logicalSuite"));

    try (MockedStatic<ReindexingUtil> reindexingUtil = mockStatic(ReindexingUtil.class);
        MockedStatic<Entity> rows = rowsExist(Entity.TEST_SUITE, testSuiteId)) {
      rebuilder.write(List.of(testSuite), Map.of(testSuiteId, 23L), READ_AT);
    }

    @SuppressWarnings("unchecked")
    ArgumentCaptor<Map<String, Object>> contextCaptor = ArgumentCaptor.forClass(Map.class);
    verify(bulkSink, times(2)).write(eq(List.of(testSuite)), contextCaptor.capture());
    Map<String, Object> documentContext = contextCaptor.getAllValues().get(0);
    Map<String, Object> relationshipContext = contextCaptor.getAllValues().get(1);
    assertEquals(Entity.TEST_SUITE, documentContext.get(ReindexingUtil.ENTITY_TYPE_KEY));
    assertEquals(
        Map.of(testSuiteId, 23L), documentContext.get(BulkSink.RELATIONSHIP_REVISIONS_CONTEXT_KEY));
    assertFalse(documentContext.containsKey(BulkSink.SCRIPTED_PARTIAL_UPDATES_CONTEXT_KEY));
    assertTrue((Boolean) relationshipContext.get(BulkSink.FENCED_RELATIONSHIPS_CONTEXT_KEY));
    assertEquals(
        Map.of(testSuiteId, 23L),
        relationshipContext.get(BulkSink.RELATIONSHIP_REVISIONS_CONTEXT_KEY));
    verify(bulkSink).flushAndAwait(60);
    verify(bulkSink).close();
  }
}

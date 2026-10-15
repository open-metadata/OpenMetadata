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

import es.co.elastic.clients.elasticsearch._types.ElasticsearchException;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicReference;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.tests.TestSuite;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.search.IndexMapping;
import org.openmetadata.service.Entity;
import org.openmetadata.service.apps.bundles.searchIndex.BulkSink;
import org.openmetadata.service.cache.CacheBundle;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.jdbi3.EntityDAO;
import org.openmetadata.service.jdbi3.TestCaseRepository;
import org.openmetadata.service.jdbi3.TestSuiteRepository;
import org.openmetadata.service.workflows.searchIndex.ReindexingUtil;
import os.org.opensearch.client.opensearch._types.OpenSearchException;

/**
 * Rewrites search documents from the database: the writes the retry worker, recorded repairs and
 * the scheduled repair share. Writes are version-guarded like an in-place rebuild's, so a live
 * write that read its row later keeps its newer content.
 */
@Slf4j
public class SearchDocumentRebuilder {
  static final int BATCH_SIZE = 200;
  private static final int SNAPSHOT_ATTEMPTS = 3;

  /** An entity and, for test cases and logical suites, the relationship revision it was read at. */
  public record StableEntitySnapshot(EntityInterface<?> entity, Long relationshipRevision) {}

  private final SearchRepository searchRepository;

  public SearchDocumentRebuilder(final SearchRepository searchRepository) {
    this.searchRepository = searchRepository;
  }

  /**
   * Rebuilds the documents of {@code references} from their rows, in batches. A document whose row
   * is gone is removed.
   */
  public void rebuild(final List<EntityReference> references) throws Exception {
    for (int start = 0; start < references.size(); start += BATCH_SIZE) {
      rebuildBatch(references.subList(start, Math.min(start + BATCH_SIZE, references.size())));
    }
  }

  private void rebuildBatch(final List<EntityReference> batch) throws Exception {
    final long readAt = System.currentTimeMillis();
    final List<EntityInterface<?>> entities = new ArrayList<>();
    final Map<UUID, Long> relationshipRevisions = new HashMap<>();
    for (final EntityReference reference : batch) {
      try {
        final StableEntitySnapshot snapshot = load(reference);
        entities.add(snapshot.entity());
        if (snapshot.relationshipRevision() != null) {
          relationshipRevisions.put(reference.getId(), snapshot.relationshipRevision());
        }
      } catch (EntityNotFoundException gone) {
        removeDocument(reference.getId().toString(), reference.getType());
      }
    }
    write(entities, relationshipRevisions, readAt);
  }

  /** Loads the entity with every field its document needs, deleted or not. */
  public StableEntitySnapshot load(final EntityReference reference) {
    final String fields =
        String.join(",", ReindexingUtil.getSearchIndexFields(reference.getType()));
    if (!isRelationshipRevisionEntityType(reference.getType())) {
      return new StableEntitySnapshot(Entity.getEntity(reference, fields, Include.ALL), null);
    }
    for (int attempt = 0; attempt < SNAPSHOT_ATTEMPTS; attempt++) {
      final long revisionBefore = getRelationshipRevision(reference);
      final var cachedReadBundle = CacheBundle.getCachedReadBundle();
      if (cachedReadBundle != null) {
        cachedReadBundle.invalidate(reference.getType(), reference.getId());
      }
      final EntityInterface<?> entity = Entity.getEntity(reference, fields, Include.ALL);
      if (entity instanceof TestSuite testSuite && !Boolean.FALSE.equals(testSuite.getBasic())) {
        return new StableEntitySnapshot(entity, null);
      }
      final long revisionAfter = getRelationshipRevision(reference);
      if (revisionBefore == revisionAfter) {
        return new StableEntitySnapshot(entity, revisionAfter);
      }
    }
    throw new IllegalStateException(
        "Relationships kept changing while preparing search retry for " + reference.getId());
  }

  private static boolean isRelationshipRevisionEntityType(final String entityType) {
    return Entity.TEST_CASE.equals(entityType) || Entity.TEST_SUITE.equals(entityType);
  }

  private static long getRelationshipRevision(final EntityReference reference) {
    final Map<UUID, Long> revisions =
        Entity.TEST_CASE.equals(reference.getType())
            ? TestCaseRepository.getTestSuiteRelationshipRevisions(List.of(reference.getId()))
            : TestSuiteRepository.getTestsRelationshipRevisions(List.of(reference.getId()));
    return revisions.getOrDefault(reference.getId(), 0L);
  }

  /**
   * Rewrites the documents from the rows read at {@code readAt}. Writes are version-guarded like an
   * in-place rebuild's, so a live write that read its row later keeps its newer content, and a row
   * deleted after the read loses the document this write made.
   */
  public void write(
      final List<EntityInterface<?>> entities,
      final Map<UUID, Long> relationshipRevisions,
      final long readAt)
      throws Exception {
    final Map<String, List<EntityInterface<?>>> entitiesByType = byType(entities);
    if (entitiesByType.isEmpty()) {
      return;
    }
    final Set<String> failedEntityIds = ConcurrentHashMap.newKeySet();
    final AtomicReference<String> firstFailureDetail = new AtomicReference<>();
    final BulkSink bulkSink =
        searchRepository.createBulkSink(
            BATCH_SIZE, 5, SearchClusterMetrics.DEFAULT_BULK_PAYLOAD_SIZE_BYTES);
    bulkSink.setFailureCallback(
        (entityType, entityId, entityFqn, errorMessage, stage) -> {
          if (entityId != null && !entityId.isEmpty()) {
            failedEntityIds.add(entityId);
          }
          firstFailureDetail.compareAndSet(null, errorMessage);
        });
    try {
      writeDocuments(bulkSink, entitiesByType, relationshipRevisions, readAt);
      writeRelationshipFields(bulkSink, entitiesByType, relationshipRevisions, readAt);
      if (!bulkSink.flushAndAwait(60)) {
        throw new IllegalStateException("Search rebuild bulk flush timed out");
      }
    } finally {
      closeQuietly(bulkSink);
    }
    if (!failedEntityIds.isEmpty()) {
      final String detail = firstFailureDetail.get();
      throw new IllegalStateException(
          "Search rebuild failed for "
              + failedEntityIds.size()
              + " entities"
              + (detail != null ? ": " + detail : ""));
    }
    removeDocumentsOfRowsDeletedSinceRead(entitiesByType);
  }

  private static Map<String, List<EntityInterface<?>>> byType(
      final List<EntityInterface<?>> entities) {
    final Map<String, List<EntityInterface<?>>> entitiesByType = new HashMap<>();
    for (final EntityInterface<?> entity : entities) {
      final String entityType =
          entity == null || entity.getEntityReference() == null
              ? ""
              : SearchIndexRetryQueue.normalize(entity.getEntityReference().getType());
      if (!entityType.isEmpty()) {
        entitiesByType.computeIfAbsent(entityType, ignored -> new ArrayList<>()).add(entity);
      }
    }
    return entitiesByType;
  }

  private static void writeDocuments(
      final BulkSink bulkSink,
      final Map<String, List<EntityInterface<?>>> entitiesByType,
      final Map<UUID, Long> relationshipRevisions,
      final long readAt)
      throws Exception {
    for (final Map.Entry<String, List<EntityInterface<?>>> entry : entitiesByType.entrySet()) {
      final Map<String, Object> context = writeContext(entry.getKey(), readAt);
      final Map<UUID, Long> typeRevisions =
          relationshipRevisionsFor(entry.getValue(), relationshipRevisions);
      if (!typeRevisions.isEmpty()) {
        context.put(BulkSink.RELATIONSHIP_REVISIONS_CONTEXT_KEY, typeRevisions);
      }
      ReindexingUtil.populateDocBuildContext(context, entry.getKey(), entry.getValue());
      bulkSink.write(entry.getValue(), context);
    }
  }

  /** Fences the relationship fields of test cases and logical suites at the revision read. */
  private static void writeRelationshipFields(
      final BulkSink bulkSink,
      final Map<String, List<EntityInterface<?>>> entitiesByType,
      final Map<UUID, Long> relationshipRevisions,
      final long readAt)
      throws Exception {
    if (relationshipRevisions.isEmpty()) {
      return;
    }
    for (final Map.Entry<String, List<EntityInterface<?>>> entry : entitiesByType.entrySet()) {
      final List<EntityInterface<?>> fenced =
          entry.getValue().stream()
              .filter(entity -> relationshipRevisions.containsKey(entity.getId()))
              .toList();
      if (!fenced.isEmpty()) {
        final Map<String, Object> context = writeContext(entry.getKey(), readAt);
        context.put(BulkSink.FENCED_RELATIONSHIPS_CONTEXT_KEY, true);
        context.put(
            BulkSink.RELATIONSHIP_REVISIONS_CONTEXT_KEY,
            relationshipRevisionsFor(fenced, relationshipRevisions));
        ReindexingUtil.populateDocBuildContext(context, entry.getKey(), fenced);
        bulkSink.write(fenced, context);
      }
    }
  }

  private static Map<String, Object> writeContext(final String entityType, final long readAt) {
    final Map<String, Object> context = new HashMap<>();
    context.put(ReindexingUtil.ENTITY_TYPE_KEY, entityType);
    context.put(BulkSink.SOURCE_READ_AT_CONTEXT_KEY, readAt);
    return context;
  }

  private static Map<UUID, Long> relationshipRevisionsFor(
      final List<EntityInterface<?>> entities, final Map<UUID, Long> relationshipRevisions) {
    final Map<UUID, Long> revisions = new HashMap<>();
    for (final EntityInterface<?> entity : entities) {
      final Long revision = relationshipRevisions.get(entity.getId());
      if (revision != null) {
        revisions.put(entity.getId(), revision);
      }
    }
    return revisions;
  }

  private static void closeQuietly(final BulkSink bulkSink) {
    try {
      bulkSink.close();
    } catch (RuntimeException e) {
      LOG.warn("Failed to close search rebuild bulk sink cleanly", e);
    }
  }

  /** A hard delete between the read and the write must not leave the document behind. */
  void removeDocumentsOfRowsDeletedSinceRead(
      final Map<String, List<EntityInterface<?>>> entitiesByType) throws Exception {
    for (final Map.Entry<String, List<EntityInterface<?>>> entry : entitiesByType.entrySet()) {
      final EntityDAO<?> dao = Entity.getEntityRepository(entry.getKey()).getDao();
      final List<String> written =
          entry.getValue().stream().map(entity -> entity.getId().toString()).toList();
      final Set<String> existing = Set.copyOf(dao.findExistingIds(dao.getTableName(), written));
      for (final String entityId : written) {
        if (!existing.contains(entityId)) {
          removeDocument(entityId, entry.getKey());
        }
      }
    }
  }

  /**
   * Deletes the document of an entity whose row is gone, from the serving index and any staged
   * one. Without a known type, every entity index is tried.
   */
  public void removeDocument(final String entityId, final String entityTypeHint) throws Exception {
    final String normalizedEntityType = SearchIndexRetryQueue.normalize(entityTypeHint);
    final Set<String> entityTypes =
        normalizedEntityType.isEmpty()
                || searchRepository.getIndexMapping(normalizedEntityType) == null
            ? searchRepository.getSearchEntities()
            : Set.of(normalizedEntityType);
    for (final String entityType : entityTypes) {
      final IndexMapping indexMapping = searchRepository.getIndexMapping(entityType);
      if (indexMapping != null) {
        deleteFromWriteTargets(indexMapping, entityId);
      }
    }
  }

  private void deleteFromWriteTargets(final IndexMapping indexMapping, final String entityId)
      throws Exception {
    final String canonicalIndex = indexMapping.getIndexName(searchRepository.getClusterAlias());
    for (final String targetIndex : searchRepository.getWriteFanoutTargets(canonicalIndex)) {
      try {
        searchRepository.getSearchClient().deleteEntity(targetIndex, entityId);
      } catch (ElasticsearchException e) {
        if (e.status() != 404) {
          throw e;
        }
      } catch (OpenSearchException e) {
        if (e.status() != 404) {
          throw e;
        }
      }
    }
  }
}

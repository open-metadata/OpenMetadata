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

package org.openmetadata.service.apps.bundles.searchIndex;

import static org.openmetadata.service.apps.bundles.searchIndex.BulkSink.FENCED_RELATIONSHIPS_CONTEXT_KEY;
import static org.openmetadata.service.apps.bundles.searchIndex.BulkSink.RELATIONSHIP_REVISIONS_CONTEXT_KEY;
import static org.openmetadata.service.apps.bundles.searchIndex.BulkSink.SCRIPTED_PARTIAL_UPDATES_CONTEXT_KEY;
import static org.openmetadata.service.apps.bundles.searchIndex.BulkSink.SOURCE_READ_AT_CONTEXT_KEY;

import java.util.Map;
import java.util.UUID;
import java.util.function.Supplier;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.service.search.SearchDocumentUpdate;
import org.openmetadata.service.search.SearchDocumentUpdates;
import org.openmetadata.service.search.SearchVersionGuard;

/**
 * How a bulk sink writes one batch of entity documents.
 *
 * @param inPlaceReadAt when the batch was read, for a rebuild that rewrites the live index; null
 *     when the batch goes to a staged index that nothing else reads yet
 * @param fencedRelationships replace each entity's relationship field at its revision, whatever
 *     its last change was ({@link BulkSink#FENCED_RELATIONSHIPS_CONTEXT_KEY})
 */
record BulkWriteOptions(
    boolean scriptedPartialUpdates,
    Map<UUID, Long> relationshipRevisions,
    Long inPlaceReadAt,
    boolean fencedRelationships) {

  BulkWriteOptions(
      final boolean scriptedPartialUpdates,
      final Map<UUID, Long> relationshipRevisions,
      final Long inPlaceReadAt) {
    this(scriptedPartialUpdates, relationshipRevisions, inPlaceReadAt, false);
  }

  @SuppressWarnings("unchecked")
  static BulkWriteOptions from(final Map<String, Object> contextData) {
    return new BulkWriteOptions(
        Boolean.TRUE.equals(contextData.get(SCRIPTED_PARTIAL_UPDATES_CONTEXT_KEY)),
        (Map<UUID, Long>) contextData.getOrDefault(RELATIONSHIP_REVISIONS_CONTEXT_KEY, Map.of()),
        (Long) contextData.get(SOURCE_READ_AT_CONTEXT_KEY),
        Boolean.TRUE.equals(contextData.get(FENCED_RELATIONSHIPS_CONTEXT_KEY)));
  }

  Long relationshipRevision(final EntityInterface<?> entity) {
    return relationshipRevisions.get(entity.getId());
  }

  /** The scripted update that writes {@code entity}, or null for a plain index operation. */
  SearchDocumentUpdate scriptedUpdate(
      final EntityInterface<?> entity, final Supplier<Map<String, Object>> document) {
    final SearchDocumentUpdate relationshipUpdate =
        fencedRelationships
            ? SearchDocumentUpdates.relationshipFieldsAt(entity, requiredRevision(entity))
            : SearchDocumentUpdates.forBulkWrite(
                entity, scriptedPartialUpdates, relationshipRevision(entity), document);
    return inPlaceReadAt == null
        ? relationshipUpdate
        : SearchDocumentUpdates.forInPlaceWrite(
            entity, relationshipUpdate, document, inPlaceReadAt);
  }

  private long requiredRevision(final EntityInterface<?> entity) {
    final Long revision = relationshipRevision(entity);
    if (revision == null) {
      throw new IllegalStateException(
          "No relationship revision to fence " + entity.getEntityReference());
    }
    return revision;
  }

  /**
   * Marks a time-series document rewritten in place, so the cleanup after the run skips it. The
   * write itself stays a plain index operation; a rebuild is rare, and a record a live write
   * changed during the batch is rewritten by that record's next change.
   */
  void stampTimeSeriesDocument(final Map<String, Object> document) {
    if (inPlaceReadAt != null) {
      document.put(SearchVersionGuard.SOURCE_READ_AT, inPlaceReadAt);
    }
  }
}

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

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.io.IOException;
import java.time.Duration;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.apps.bundles.searchIndex.SearchIndexEntityTypes;
import org.openmetadata.service.jdbi3.EntityDAO;
import org.openmetadata.service.jdbi3.EntityDAO.ChangedRow;
import org.openmetadata.service.jobs.RepairByEntityType;
import org.openmetadata.service.search.SearchClient.RawSearchResponse;

/**
 * The scheduled repair's look at recent changes. For every entity type it pages through the rows
 * changed in a window, oldest first, on the {@code (updatedAt, id)} index, and asks search when
 * each one's document was read. A row whose document is missing, or was read before the row last
 * changed, is rebuilt from the database: a write lost to a crash, a write a server applied out of
 * order, a failure nothing recorded.
 *
 * <p>A changed row that other documents inherit from (a service, a schema, a domain) also gets the
 * documents that inherit from it and were read in the {@link #INHERITANCE_WINDOW} before it
 * changed recorded for repair. A child created on one server while its parent changed on another
 * can miss the parent's propagation; nothing else would notice.
 */
@Slf4j
public class ChangedDocumentsRepair {
  static final int PAGE_SIZE = 500;
  static final Duration INHERITANCE_WINDOW = Duration.ofMinutes(10);
  private static final long NOT_STAMPED = Long.MIN_VALUE;
  private static final String REPAIR_OPERATION = "searchRepair";

  private final SearchRepository searchRepository;
  private final SearchDocumentRebuilder rebuilder;
  private final SearchScopeRepair scopeRepair;
  private final RepairByEntityType byType = new RepairByEntityType("Search repair");

  public ChangedDocumentsRepair(
      final SearchRepository searchRepository,
      final SearchDocumentRebuilder rebuilder,
      final SearchScopeRepair scopeRepair) {
    this.searchRepository = searchRepository;
    this.rebuilder = rebuilder;
    this.scopeRepair = scopeRepair;
  }

  /**
   * Repairs the documents of rows changed after {@code since} and no later than {@code until}.
   *
   * @param heartbeat run after each page, to keep the pass's lock
   * @return how many documents were rebuilt
   */
  public int repair(final long since, final long until, final Runnable heartbeat) throws Exception {
    return byType.run(
        repairableTypes(), entityType -> repairType(entityType, since, until, heartbeat));
  }

  /** Entity types whose rows carry {@code updatedAt}; time series and columns are not rows. */
  List<String> repairableTypes() {
    return searchRepository.getIndexedEntityTypes().stream()
        .filter(entityType -> !Entity.TABLE_COLUMN.equals(entityType))
        .filter(entityType -> !Entity.isTimeSeriesEntity(entityType))
        .filter(entityType -> !SearchIndexEntityTypes.isTimeSeriesEntity(entityType))
        .filter(entityType -> !SearchIndexEntityTypes.isDataInsightEntity(entityType))
        .filter(Entity::hasEntityRepository)
        .toList();
  }

  private int repairType(
      final String entityType, final long since, final long until, final Runnable heartbeat)
      throws Exception {
    final EntityDAO<?> rows = Entity.getEntityRepository(entityType).getDao();
    final String index =
        searchRepository
            .getIndexMapping(entityType)
            .getIndexName(searchRepository.getClusterAlias());
    int rebuilt = 0;
    List<ChangedRow> page = changedPage(rows, until, since, "");
    while (!page.isEmpty()) {
      rebuilt += rebuildStale(entityType, index, page);
      repairInheritingDocuments(entityType, page);
      heartbeat.run();
      final ChangedRow last = page.getLast();
      page = changedPage(rows, until, last.updatedAt(), last.id());
    }
    return rebuilt;
  }

  private static List<ChangedRow> changedPage(
      final EntityDAO<?> rows, final long until, final long afterUpdatedAt, final String afterId) {
    return rows.listChangedAfter(rows.getTableName(), until, afterUpdatedAt, afterId, PAGE_SIZE);
  }

  private int rebuildStale(final String entityType, final String index, final List<ChangedRow> page)
      throws IOException {
    final Map<String, Long> readTimes =
        documentReadTimes(index, page.stream().map(ChangedRow::id).toList());
    final List<EntityReference> stale =
        page.stream()
            .filter(row -> isStale(row, readTimes))
            .map(
                row -> new EntityReference().withId(UUID.fromString(row.id())).withType(entityType))
            .toList();
    if (!stale.isEmpty()) {
      LOG.info(
          "Search repair rebuilds {} {} documents missing or older than their rows",
          stale.size(),
          entityType);
      rebuildOrQueue(stale);
    }
    return stale.size();
  }

  /**
   * Rebuilds {@code stale}, or hands it to the retry worker when a document fails to rebuild, so
   * one row that cannot be indexed does not hold back every later pass.
   */
  private void rebuildOrQueue(final List<EntityReference> stale) {
    try {
      rebuilder.rebuild(stale);
    } catch (Exception e) {
      LOG.warn("Search repair could not rebuild {} documents; queued for retry", stale.size(), e);
      final String reason = SearchIndexRetryQueue.failureReason(REPAIR_OPERATION, e);
      stale.forEach(
          reference ->
              SearchIndexRetryQueue.enqueue(
                  reference.getId().toString(), null, reference.getType(), reason));
    }
  }

  /** A document missing, never stamped, or read before its row last changed. */
  static boolean isStale(final ChangedRow row, final Map<String, Long> readTimes) {
    final Long readAt = readTimes.get(row.id());
    return readAt == null || readAt < row.updatedAt();
  }

  /** When each found document was read; a document without a read time maps to the minimum. */
  Map<String, Long> documentReadTimes(final String index, final List<String> ids)
      throws IOException {
    final ObjectNode body = JsonUtils.getObjectNode();
    ids.forEach(body.putArray("ids")::add);
    final RawSearchResponse response =
        searchRepository
            .getSearchClient()
            .rawSearchRequest(
                "POST",
                "/" + index + "/_mget?_source_includes=" + SearchVersionGuard.SOURCE_READ_AT,
                body.toString());
    if (response.statusCode() >= 300) {
      throw new IOException("Reading search documents failed: " + response.body());
    }
    final Map<String, Long> readTimes = new HashMap<>();
    for (final JsonNode document : JsonUtils.readTree(response.body()).path("docs")) {
      if (document.path("found").asBoolean()) {
        final JsonNode readAt = document.path("_source").path(SearchVersionGuard.SOURCE_READ_AT);
        readTimes.put(
            document.path("_id").asText(), readAt.isNumber() ? readAt.asLong() : NOT_STAMPED);
      }
    }
    return readTimes;
  }

  /**
   * Rebuilds the documents that inherit from this page's rows and were read just before they
   * changed. A scope too large for one pass is handed to the retry worker to finish.
   */
  private void repairInheritingDocuments(final String entityType, final List<ChangedRow> parents) {
    final long oldestChange = parents.getFirst().updatedAt();
    final long newestChange = parents.getLast().updatedAt();
    final var scope =
        searchRepository
            .inheritingDocuments(
                entityType, parents.stream().map(ChangedRow::id).toList(), newestChange)
            .map(
                inheriting ->
                    inheriting.narrowedBy(readSince(oldestChange - INHERITANCE_WINDOW.toMillis())));
    if (scope.isPresent()) {
      repairOrRecord(scope.get());
    }
  }

  /** Repairs {@code scope} now, or records it for the retry worker if it is too large or fails. */
  private void repairOrRecord(final SearchRepairScope scope) {
    boolean settled = false;
    try {
      settled = scopeRepair.repair(scope);
    } catch (Exception e) {
      LOG.warn("Search repair could not rebuild inheriting documents; recorded for retry", e);
    }
    if (!settled) {
      SearchIndexRetryQueue.enqueueRepair(
          scope, "Search repair: documents read just before their parent changed");
    }
  }

  private static JsonNode readSince(final long readAt) {
    final ObjectNode range = JsonUtils.getObjectNode();
    range.putObject("range").putObject(SearchVersionGuard.SOURCE_READ_AT).put("gte", readAt);
    return range;
  }
}

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
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.EntityTimeSeriesInterface;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.search.IndexMapping;
import org.openmetadata.service.Entity;
import org.openmetadata.service.apps.bundles.searchIndex.SearchIndexEntityTypes;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.jdbi3.EntityTimeSeriesRepository;
import org.openmetadata.service.search.SearchClient.RawSearchResponse;
import org.openmetadata.service.search.indexes.ColumnSearchIndex;

/**
 * Rebuilds, from the database, the documents a {@link SearchRepairScope} still matches: those no
 * rebuild has rewritten since the scope was recorded. Entity documents are rebuilt from their
 * rows, column documents from their table, and time-series documents from their records; a
 * document whose source is gone is deleted. Other documents, such as data insight reports, cannot
 * be rebuilt and are left alone.
 *
 * <p>A pass reads a snapshot of the matches and stops after {@link #MAX_DOCUMENTS_PER_PASS}; the
 * next pass skips what this one rewrote, so a large scope is repaired over several passes.
 */
@Slf4j
public class SearchScopeRepair {
  static final int PAGE_SIZE = 500;
  static final int MAX_DOCUMENTS_PER_PASS = 10_000;
  private static final String SCROLL_KEEP_ALIVE = "2m";
  private static final String SCROLL_ID = "scroll_id";
  private static final String ENTITY_TYPE = "entityType";
  private static final String TABLE_ID = "table.id";
  private static final String SCOPE_REPAIR = "searchScopeRepair";

  /** One matched document: where it lives and the fields that say what it was built from. */
  record MatchedDocument(String index, String id, JsonNode source) {
    String entityType() {
      return source.path(ENTITY_TYPE).asText("");
    }

    String tableId() {
      return source.path("table").path("id").asText("");
    }
  }

  private final SearchRepository searchRepository;
  private final SearchDocumentRebuilder rebuilder;

  public SearchScopeRepair(
      final SearchRepository searchRepository, final SearchDocumentRebuilder rebuilder) {
    this.searchRepository = searchRepository;
    this.rebuilder = rebuilder;
  }

  /**
   * Repairs up to {@link #MAX_DOCUMENTS_PER_PASS} matched documents.
   *
   * @return whether the scope is settled; false when matched documents remain for another pass
   */
  public boolean repair(final SearchRepairScope scope) throws Exception {
    int handled = 0;
    boolean exhausted = false;
    JsonNode response = startScroll(scope);
    String scrollId = response.path("_scroll_id").asText(null);
    try {
      List<MatchedDocument> page = matches(response);
      while (!page.isEmpty() && handled < MAX_DOCUMENTS_PER_PASS) {
        handled += repairPage(page);
        response = continueScroll(scrollId);
        scrollId = response.path("_scroll_id").asText(scrollId);
        page = matches(response);
      }
      exhausted = page.isEmpty();
    } finally {
      clearScroll(scrollId);
    }
    // A pass that could rebuild nothing it matched would match the same documents forever.
    return exhausted || handled == 0;
  }

  /** Rebuilds what it can of one page; returns how many documents it rebuilt or deleted. */
  int repairPage(final List<MatchedDocument> page) throws Exception {
    final Map<String, List<MatchedDocument>> byKind =
        page.stream().collect(Collectors.groupingBy(this::kindOf));
    int handled = 0;
    handled += rebuildEntities(byKind.getOrDefault(Kind.ENTITY.name(), List.of()));
    handled += rebuildColumns(byKind.getOrDefault(Kind.COLUMN.name(), List.of()));
    handled += rebuildRecords(byKind.getOrDefault(Kind.RECORD.name(), List.of()));
    final int skipped = byKind.getOrDefault(Kind.OTHER.name(), List.of()).size();
    if (skipped > 0) {
      LOG.debug("Search repair skipped {} documents it cannot rebuild from the database", skipped);
    }
    return handled;
  }

  private enum Kind {
    ENTITY,
    COLUMN,
    RECORD,
    OTHER
  }

  private String kindOf(final MatchedDocument document) {
    final String entityType = typeOf(document);
    final Kind kind;
    if (Entity.TABLE_COLUMN.equals(entityType)) {
      kind = Kind.COLUMN;
    } else if (SearchIndexEntityTypes.isDataInsightEntity(entityType)
        || !SearchIndexRetryQueue.isUuid(document.id())) {
      kind = Kind.OTHER;
    } else if (isTimeSeries(entityType)) {
      kind = Kind.RECORD;
    } else if (Entity.hasEntityRepository(entityType)) {
      kind = Kind.ENTITY;
    } else {
      kind = Kind.OTHER;
    }
    return kind.name();
  }

  private static boolean isTimeSeries(final String entityType) {
    return !entityType.isEmpty()
        && (Entity.isTimeSeriesEntity(entityType)
            || SearchIndexEntityTypes.isTimeSeriesEntity(entityType));
  }

  /** The document's type, from its source, or else from the index that holds it. */
  String typeOf(final MatchedDocument document) {
    final String declared = document.entityType();
    return declared.isEmpty() ? entityTypeOfIndex(document.index()).orElse("") : declared;
  }

  /** The entity type whose index (or a staged rebuild of it) {@code concreteIndex} is. */
  Optional<String> entityTypeOfIndex(final String concreteIndex) {
    String bestMatch = null;
    int bestLength = -1;
    for (final Map.Entry<String, IndexMapping> entry :
        searchRepository.getEntityIndexMap().entrySet()) {
      final String canonical = entry.getValue().getIndexName(searchRepository.getClusterAlias());
      if (concreteIndex.startsWith(canonical) && canonical.length() > bestLength) {
        bestMatch = entry.getKey();
        bestLength = canonical.length();
      }
    }
    return Optional.ofNullable(bestMatch);
  }

  private int rebuildEntities(final List<MatchedDocument> documents) throws Exception {
    final List<EntityReference> references =
        documents.stream()
            .map(
                document ->
                    new EntityReference()
                        .withId(UUID.fromString(document.id()))
                        .withType(typeOf(document)))
            .distinct()
            .toList();
    if (!references.isEmpty()) {
      rebuildEachIfBatchFails(references);
    }
    return references.size();
  }

  /**
   * Rebuilds the batch, or each document alone when the batch fails: a document that cannot be
   * rebuilt goes to the retry queue on its own, so one broken row cannot keep the scope from
   * settling. While search is unavailable the batch's failure is thrown instead.
   */
  private void rebuildEachIfBatchFails(final List<EntityReference> references) throws Exception {
    try {
      rebuilder.rebuild(references);
    } catch (Exception batchFailure) {
      if (!searchRepository.getSearchClient().isClientAvailable()) {
        throw batchFailure;
      }
      references.forEach(this::rebuildOrQueue);
    }
  }

  private void rebuildOrQueue(final EntityReference reference) {
    try {
      rebuilder.rebuild(List.of(reference));
    } catch (Exception e) {
      LOG.warn(
          "Search repair could not rebuild {} {}; queued for retry",
          reference.getType(),
          reference.getId(),
          e);
      SearchIndexRetryQueue.enqueue(
          reference.getId().toString(),
          null,
          reference.getType(),
          SearchIndexRetryQueue.failureReason(SCOPE_REPAIR, e));
    }
  }

  /**
   * A column document is rebuilt with its table; one whose table, or whose column, is gone is
   * deleted.
   */
  private int rebuildColumns(final List<MatchedDocument> documents) throws Exception {
    final Map<String, List<MatchedDocument>> byTable =
        documents.stream().collect(Collectors.groupingBy(MatchedDocument::tableId));
    int handled = 0;
    for (final Map.Entry<String, List<MatchedDocument>> entry : byTable.entrySet()) {
      if (SearchIndexRetryQueue.isUuid(entry.getKey())) {
        rebuildColumnsOfTable(entry.getKey(), entry.getValue());
        handled += entry.getValue().size();
      }
    }
    return handled;
  }

  private void rebuildColumnsOfTable(final String tableId, final List<MatchedDocument> columns)
      throws Exception {
    final Set<String> current = currentColumnDocumentIds(tableId);
    for (final MatchedDocument column : columns) {
      if (!current.contains(column.id())) {
        deleteDocument(column.index(), column.id());
      }
    }
    if (!current.isEmpty()) {
      rebuilder.rebuild(
          List.of(new EntityReference().withId(UUID.fromString(tableId)).withType(Entity.TABLE)));
    }
  }

  /** The ids of the table's current column documents; none when the table is gone. */
  private Set<String> currentColumnDocumentIds(final String tableId) {
    Set<String> ids = Set.of();
    try {
      final Table table =
          (Table)
              rebuilder
                  .load(
                      new EntityReference().withId(UUID.fromString(tableId)).withType(Entity.TABLE))
                  .entity();
      ids =
          ColumnSearchIndex.flattenColumns(table.getColumns()).stream()
              .map(column -> ColumnSearchIndex.generateColumnId(column.getFullyQualifiedName()))
              .collect(Collectors.toUnmodifiableSet());
    } catch (EntityNotFoundException gone) {
      LOG.debug("Table {} is gone; its column documents are deleted", tableId);
    }
    return ids;
  }

  /** A time-series document is rewritten from its record, or deleted when the record is gone. */
  private int rebuildRecords(final List<MatchedDocument> documents) throws IOException {
    int handled = 0;
    for (final MatchedDocument document : documents) {
      final Optional<EntityTimeSeriesRepository<? extends EntityTimeSeriesInterface>> records =
          recordsOf(typeOf(document));
      if (records.isPresent()) {
        rebuildRecord(records.get(), document);
        handled++;
      }
    }
    return handled;
  }

  private void rebuildRecord(
      final EntityTimeSeriesRepository<? extends EntityTimeSeriesInterface> records,
      final MatchedDocument document)
      throws IOException {
    final EntityTimeSeriesInterface record = records.getById(UUID.fromString(document.id()));
    if (record == null) {
      deleteDocument(document.index(), document.id());
    } else {
      searchRepository.updateTimeSeriesEntity(record);
    }
  }

  /** A time-series type indexed without a repository of records has nothing to rebuild from. */
  private static Optional<EntityTimeSeriesRepository<? extends EntityTimeSeriesInterface>>
      recordsOf(final String entityType) {
    Optional<EntityTimeSeriesRepository<? extends EntityTimeSeriesInterface>> records;
    try {
      records = Optional.of(Entity.getEntityTimeSeriesRepository(entityType));
    } catch (EntityNotFoundException noRepository) {
      records = Optional.empty();
    }
    return records;
  }

  private void deleteDocument(final String index, final String id) throws IOException {
    searchRepository.getSearchClient().deleteEntity(index, id);
  }

  private JsonNode startScroll(final SearchRepairScope scope) throws IOException {
    final ObjectNode body = JsonUtils.getObjectNode();
    body.put("size", PAGE_SIZE);
    body.putArray("_source").add(ENTITY_TYPE).add(TABLE_ID);
    body.putArray("sort").add("_doc");
    body.set("query", scope.staleDocumentsQuery());
    final String indexes = String.join(",", scope.indexes());
    return send(
        "POST",
        "/"
            + indexes
            + "/_search?scroll="
            + SCROLL_KEEP_ALIVE
            + "&ignore_unavailable=true&allow_no_indices=true",
        body.toString());
  }

  private JsonNode continueScroll(final String scrollId) throws IOException {
    final ObjectNode body = JsonUtils.getObjectNode();
    body.put("scroll", SCROLL_KEEP_ALIVE);
    body.put(SCROLL_ID, scrollId);
    return send("POST", "/_search/scroll", body.toString());
  }

  private void clearScroll(final String scrollId) {
    if (scrollId != null) {
      final ObjectNode body = JsonUtils.getObjectNode();
      body.putArray(SCROLL_ID).add(scrollId);
      try {
        send("DELETE", "/_search/scroll", body.toString());
      } catch (IOException e) {
        LOG.debug("Could not clear the repair scroll; it expires after {}", SCROLL_KEEP_ALIVE, e);
      }
    }
  }

  private JsonNode send(final String method, final String endpoint, final String body)
      throws IOException {
    final RawSearchResponse response =
        searchRepository.getSearchClient().rawSearchRequest(method, endpoint, body);
    if (response.statusCode() >= 300) {
      throw new IOException(
          String.format(
              "%s %s failed with status %d: %s",
              method, endpoint, response.statusCode(), response.body()));
    }
    return JsonUtils.readTree(response.body());
  }

  static List<MatchedDocument> matches(final JsonNode response) {
    final List<MatchedDocument> documents = new ArrayList<>();
    response
        .path("hits")
        .path("hits")
        .forEach(
            hit ->
                documents.add(
                    new MatchedDocument(
                        hit.path("_index").asText(),
                        hit.path("_id").asText(),
                        hit.path("_source"))));
    return documents;
  }
}

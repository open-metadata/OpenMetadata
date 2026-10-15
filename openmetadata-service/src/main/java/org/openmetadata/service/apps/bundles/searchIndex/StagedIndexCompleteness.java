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

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.io.IOException;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.EntityTimeSeriesInterface;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.EntityDAO;
import org.openmetadata.service.jdbi3.EntityTimeSeriesDAO;
import org.openmetadata.service.jdbi3.EntityTimeSeriesRepository;
import org.openmetadata.service.search.SearchClient.RawSearchResponse;
import org.openmetadata.service.search.SearchDocumentRebuilder;
import org.openmetadata.service.search.SearchRepository;

/**
 * Writes into a new index, before it is promoted, every row of its type the run did not write.
 * Partitions end after a row count and time series page by offset, so a row inserted during the run
 * can push older rows past a partition's end, out of every partition's reach; promoting the index
 * would lose their documents. The missing rows are found by id and rebuilt from the database.
 */
@Slf4j
final class StagedIndexCompleteness {
  static final int PAGE_SIZE = 500;

  private final SearchRepository searchRepository;
  private final SearchDocumentRebuilder rebuilder;

  StagedIndexCompleteness(
      final SearchRepository searchRepository, final SearchDocumentRebuilder rebuilder) {
    this.searchRepository = searchRepository;
    this.rebuilder = rebuilder;
  }

  /**
   * Writes the rows of {@code entityType} missing from {@code stagedIndex}.
   *
   * @param timeSeriesStartTs for a time series, the oldest record the run indexed; 0 for all
   * @return how many rows were missing
   */
  long fillMissing(final String entityType, final String stagedIndex, final long timeSeriesStartTs)
      throws Exception {
    final boolean timeSeries = SearchIndexEntityTypes.isTimeSeriesEntity(entityType);
    long missing = 0;
    String afterId = "";
    List<String> page = rowIds(entityType, timeSeries, afterId, timeSeriesStartTs);
    while (!page.isEmpty()) {
      final List<String> absent = absentFrom(stagedIndex, page);
      missing += absent.size();
      if (timeSeries) {
        rebuildRecords(entityType, absent);
      } else {
        rebuildEntities(entityType, absent);
      }
      afterId = page.getLast();
      page = rowIds(entityType, timeSeries, afterId, timeSeriesStartTs);
    }
    if (missing > 0) {
      LOG.info("Wrote {} {} rows the run had not written to {}", missing, entityType, stagedIndex);
    }
    return missing;
  }

  private static List<String> rowIds(
      final String entityType,
      final boolean timeSeries,
      final String afterId,
      final long timeSeriesStartTs) {
    final List<String> ids;
    if (timeSeries) {
      final EntityTimeSeriesDAO records =
          Entity.getEntityTimeSeriesRepository(entityType).getTimeSeriesDao();
      ids =
          records.listIdsAfter(
              records.getTimeSeriesTableName(), afterId, timeSeriesStartTs, PAGE_SIZE);
    } else {
      final EntityDAO<?> rows = Entity.getEntityRepository(entityType).getDao();
      ids = rows.listIdsAfter(rows.getTableName(), afterId, PAGE_SIZE);
    }
    return ids;
  }

  /** The ids with no document in {@code index}. */
  List<String> absentFrom(final String index, final List<String> ids) throws IOException {
    final ObjectNode body = JsonUtils.getObjectNode();
    ids.forEach(body.putArray("ids")::add);
    final RawSearchResponse response =
        searchRepository
            .getSearchClient()
            .rawSearchRequest("POST", "/" + index + "/_mget?_source=false", body.toString());
    if (response.statusCode() >= 300) {
      throw new IOException("Reading documents from " + index + " failed: " + response.body());
    }
    final Set<String> found = new HashSet<>();
    for (final JsonNode document : JsonUtils.readTree(response.body()).path("docs")) {
      if (document.path("found").asBoolean()) {
        found.add(document.path("_id").asText());
      }
    }
    return ids.stream().filter(id -> !found.contains(id)).toList();
  }

  private void rebuildEntities(final String entityType, final List<String> ids) throws Exception {
    if (!ids.isEmpty()) {
      rebuilder.rebuild(
          ids.stream()
              .map(id -> new EntityReference().withId(UUID.fromString(id)).withType(entityType))
              .toList());
    }
  }

  private void rebuildRecords(final String entityType, final List<String> ids) {
    final EntityTimeSeriesRepository<? extends EntityTimeSeriesInterface> records =
        Entity.getEntityTimeSeriesRepository(entityType);
    for (final String id : ids) {
      final EntityTimeSeriesInterface record = records.getById(UUID.fromString(id));
      if (record != null) {
        searchRepository.createTimeSeriesEntity(record);
      }
    }
  }
}

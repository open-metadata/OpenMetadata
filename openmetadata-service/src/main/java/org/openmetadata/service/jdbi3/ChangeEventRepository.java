/*
 *  Copyright 2021 Collate
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

import static org.openmetadata.schema.type.EventType.ENTITY_CREATED;
import static org.openmetadata.schema.type.EventType.ENTITY_DELETED;
import static org.openmetadata.schema.type.EventType.ENTITY_RESTORED;
import static org.openmetadata.schema.type.EventType.ENTITY_SOFT_DELETED;
import static org.openmetadata.schema.type.EventType.ENTITY_UPDATED;

import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.List;
import org.jdbi.v3.sqlobject.transaction.Transaction;
import org.openmetadata.schema.type.ChangeEvent;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.schema.utils.ResultList;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.CollectionDAO.ChangeEventDAO.ChangeEventRecord;

@Repository
public class ChangeEventRepository {
  private final CollectionDAO.ChangeEventDAO dao;

  public ChangeEventRepository() {
    this.dao = Entity.getCollectionDAO().changeEventDAO();
    Entity.setChangeEventRepository(this);
  }

  public ResultList<ChangeEvent> list(
      long timestamp,
      List<String> entityCreatedList,
      List<String> entityUpdatedList,
      List<String> entityRestoredList,
      List<String> entityDeletedList,
      long afterOffset,
      int from,
      int limit) {
    long total =
        count(
            timestamp, entityCreatedList, entityUpdatedList, entityRestoredList, entityDeletedList);
    Long windowStartOffset = afterOffset;
    if (from > 0) {
      windowStartOffset =
          resolvePositionOffset(
              from,
              timestamp,
              entityCreatedList,
              entityUpdatedList,
              entityRestoredList,
              entityDeletedList);
    }

    List<ChangeEvent> events = new ArrayList<>();
    String afterCursor = null;
    if (windowStartOffset != null) {
      Page page =
          fetchWindow(
              timestamp,
              entityCreatedList,
              entityUpdatedList,
              entityRestoredList,
              entityDeletedList,
              windowStartOffset,
              limit);
      for (ChangeEventRecord record : page.records()) {
        events.add(JsonUtils.readValue(record.json(), ChangeEvent.class));
      }
      afterCursor = page.afterCursor();
    }
    return new ResultList<>(events, null, afterCursor, (int) Math.min(total, Integer.MAX_VALUE));
  }

  private Page fetchWindow(
      long timestamp,
      List<String> entityCreatedList,
      List<String> entityUpdatedList,
      List<String> entityRestoredList,
      List<String> entityDeletedList,
      long afterOffset,
      int limit) {
    int fetchLimit = limit + 1;
    List<ChangeEventRecord> records = new ArrayList<>();
    records.addAll(
        dao.listAfter(ENTITY_CREATED, entityCreatedList, timestamp, afterOffset, fetchLimit));
    records.addAll(
        dao.listAfter(ENTITY_UPDATED, entityUpdatedList, timestamp, afterOffset, fetchLimit));
    records.addAll(
        dao.listAfter(ENTITY_RESTORED, entityRestoredList, timestamp, afterOffset, fetchLimit));
    records.addAll(
        dao.listAfter(ENTITY_DELETED, entityDeletedList, timestamp, afterOffset, fetchLimit));
    records.addAll(
        dao.listAfter(ENTITY_SOFT_DELETED, entityDeletedList, timestamp, afterOffset, fetchLimit));
    return mergePage(records, limit);
  }

  /**
   * Resolves a positional {@code from} into the keyset offset the window starts after, fetching
   * only the {@code offset} column (no event JSON) so a deep skip never materializes the skipped
   * rows' payloads. Returns {@code null} when fewer than {@code from} events match.
   */
  private Long resolvePositionOffset(
      int from,
      long timestamp,
      List<String> entityCreatedList,
      List<String> entityUpdatedList,
      List<String> entityRestoredList,
      List<String> entityDeletedList) {
    List<Long> offsets = new ArrayList<>();
    offsets.addAll(dao.listOffsetsAfter(ENTITY_CREATED, entityCreatedList, timestamp, 0, from));
    offsets.addAll(dao.listOffsetsAfter(ENTITY_UPDATED, entityUpdatedList, timestamp, 0, from));
    offsets.addAll(dao.listOffsetsAfter(ENTITY_RESTORED, entityRestoredList, timestamp, 0, from));
    offsets.addAll(dao.listOffsetsAfter(ENTITY_DELETED, entityDeletedList, timestamp, 0, from));
    offsets.addAll(
        dao.listOffsetsAfter(ENTITY_SOFT_DELETED, entityDeletedList, timestamp, 0, from));
    return boundaryOffset(offsets, from);
  }

  /**
   * Given the smallest matching offsets, returns the offset at position {@code from} (1-based) so
   * the window is fetched with {@code offset > boundary}. Returns {@code null} when fewer than
   * {@code from} offsets exist, i.e. the position is past the end.
   */
  static Long boundaryOffset(List<Long> offsets, int from) {
    Collections.sort(offsets);
    return offsets.size() >= from ? offsets.get(from - 1) : null;
  }

  record Page(List<ChangeEventRecord> records, String afterCursor) {}

  /**
   * Keyset-merges the bounded per-event-type result sets: sorts by monotonic {@code offset}, keeps
   * the first {@code limit}, and derives the forward cursor from the last kept offset. The cursor is
   * the raw offset value; {@link ResultList} base64 encodes it into {@code paging.after}.
   */
  static Page mergePage(List<ChangeEventRecord> records, int limit) {
    records.sort(Comparator.comparingLong(ChangeEventRecord::offset));
    boolean hasMore = records.size() > limit;
    List<ChangeEventRecord> page = hasMore ? new ArrayList<>(records.subList(0, limit)) : records;
    String afterCursor =
        hasMore && !page.isEmpty() ? String.valueOf(page.getLast().offset()) : null;
    return new Page(page, afterCursor);
  }

  private long count(
      long timestamp,
      List<String> entityCreatedList,
      List<String> entityUpdatedList,
      List<String> entityRestoredList,
      List<String> entityDeletedList) {
    return dao.count(ENTITY_CREATED, entityCreatedList, timestamp)
        + dao.count(ENTITY_UPDATED, entityUpdatedList, timestamp)
        + dao.count(ENTITY_RESTORED, entityRestoredList, timestamp)
        + dao.count(ENTITY_DELETED, entityDeletedList, timestamp)
        + dao.count(ENTITY_SOFT_DELETED, entityDeletedList, timestamp);
  }

  @Transaction
  public void insert(ChangeEvent event) {
    dao.insert(JsonUtils.pojoToJson(event));
  }

  @Transaction
  public void deleteAll(String entityType) {
    dao.deleteAll(entityType);
  }
}

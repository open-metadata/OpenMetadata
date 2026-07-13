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
    int fetchLimit = from + limit + 1;
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

    Page page = mergePage(records, from, limit);
    List<ChangeEvent> events = new ArrayList<>();
    for (ChangeEventRecord record : page.records()) {
      events.add(JsonUtils.readValue(record.json(), ChangeEvent.class));
    }
    long total =
        count(
            timestamp, entityCreatedList, entityUpdatedList, entityRestoredList, entityDeletedList);
    return new ResultList<>(
        events, null, page.afterCursor(), (int) Math.min(total, Integer.MAX_VALUE));
  }

  record Page(List<ChangeEventRecord> records, String afterCursor) {}

  /**
   * Keyset-merges the bounded per-event-type result sets: sorts by monotonic {@code offset}, skips
   * {@code from} records, keeps the next {@code limit}, and derives the forward cursor from the last
   * kept offset. The cursor path (offset &gt; afterOffset) uses {@code from = 0}; positional paging
   * uses {@code afterOffset = 0}. The cursor is the raw offset value; {@link ResultList} base64
   * encodes it into {@code paging.after}.
   */
  static Page mergePage(List<ChangeEventRecord> records, int from, int limit) {
    records.sort(Comparator.comparingLong(ChangeEventRecord::offset));
    int windowStart = Math.min(from, records.size());
    int windowEnd = Math.min(from + limit, records.size());
    List<ChangeEventRecord> page = new ArrayList<>(records.subList(windowStart, windowEnd));
    boolean hasMore = records.size() > from + limit;
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

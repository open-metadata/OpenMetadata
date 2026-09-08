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
import org.openmetadata.service.jdbi3.AccessControlDAOs.ChangeEventDAO.ChangeEventRecord;

@Repository
public class ChangeEventRepository {
  private final CollectionDAO.ChangeEventDAO dao;

  public ChangeEventRepository() {
    this.dao = Entity.getCollectionDAO().changeEventDAO();
    Entity.setChangeEventRepository(this);
  }

  public ResultList<ChangeEvent> list(
      long timestamp,
      long endTs,
      List<String> entityCreatedList,
      List<String> entityUpdatedList,
      List<String> entityRestoredList,
      List<String> entityDeletedList,
      long afterOffset,
      int limit) {
    int fetchLimit = limit + 1;
    List<ChangeEventRecord> records = new ArrayList<>();
    records.addAll(
        dao.listAfter(
            ENTITY_CREATED, entityCreatedList, timestamp, endTs, afterOffset, fetchLimit));
    records.addAll(
        dao.listAfter(
            ENTITY_UPDATED, entityUpdatedList, timestamp, endTs, afterOffset, fetchLimit));
    records.addAll(
        dao.listAfter(
            ENTITY_RESTORED, entityRestoredList, timestamp, endTs, afterOffset, fetchLimit));
    records.addAll(
        dao.listAfter(
            ENTITY_DELETED, entityDeletedList, timestamp, endTs, afterOffset, fetchLimit));
    records.addAll(
        dao.listAfter(
            ENTITY_SOFT_DELETED, entityDeletedList, timestamp, endTs, afterOffset, fetchLimit));

    Page page = mergePage(records, limit);
    List<ChangeEvent> events = new ArrayList<>();
    for (ChangeEventRecord record : page.records()) {
      events.add(JsonUtils.readValue(record.json(), ChangeEvent.class));
    }
    return new ResultList<>(events, null, page.afterCursor(), events.size());
  }

  record Page(List<ChangeEventRecord> records, String afterCursor) {}

  // Sort merged pages by offset, keep the first `limit`, cursor = last kept offset (raw; ResultList
  // base64-encodes it into paging.after).
  static Page mergePage(List<ChangeEventRecord> records, int limit) {
    records.sort(Comparator.comparingLong(ChangeEventRecord::offset));
    boolean hasMore = records.size() > limit;
    List<ChangeEventRecord> page = hasMore ? new ArrayList<>(records.subList(0, limit)) : records;
    String afterCursor =
        hasMore && !page.isEmpty() ? String.valueOf(page.getLast().offset()) : null;
    return new Page(page, afterCursor);
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

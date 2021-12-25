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

package org.openmetadata.catalog.jdbi3;

import org.jdbi.v3.sqlobject.transaction.Transaction;
import org.openmetadata.catalog.resources.events.EventResource.ChangeEventList;
import org.openmetadata.catalog.type.ChangeEvent;
import org.openmetadata.catalog.util.JsonUtils;
import org.openmetadata.catalog.util.RestUtil;
import org.openmetadata.catalog.util.ResultList;

import java.io.IOException;
import java.security.GeneralSecurityException;
import java.util.ArrayList;
import java.util.Date;
import java.util.List;

import static org.openmetadata.catalog.type.EventType.ENTITY_CREATED;
import static org.openmetadata.catalog.type.EventType.ENTITY_DELETED;
import static org.openmetadata.catalog.type.EventType.ENTITY_UPDATED;

public class ChangeEventRepository {
  private final CollectionDAO dao;

  public ChangeEventRepository(CollectionDAO dao) {
    this.dao = dao;
  }

  @Transaction
  public ResultList<ChangeEvent> list(
      Date date, List<String> entityCreatedList, List<String> entityUpdatedList, List<String> entityDeletedList)
      throws IOException, GeneralSecurityException {
    List<String> jsons = new ArrayList<>();
    String dateParam = RestUtil.DATE_TIME_FORMAT.format(date);
    jsons.addAll(dao.changeEventDAO().list(ENTITY_CREATED.value(), entityCreatedList, dateParam));
    jsons.addAll(dao.changeEventDAO().list(ENTITY_UPDATED.value(), entityUpdatedList, dateParam));
    jsons.addAll(dao.changeEventDAO().list(ENTITY_DELETED.value(), entityDeletedList, dateParam));

    List<ChangeEvent> changeEvents = new ArrayList<>();
    for (String json : jsons) {
      changeEvents.add(JsonUtils.readValue(json, ChangeEvent.class));
    }
    return new ChangeEventList(changeEvents, null, null, changeEvents.size()); // TODO
  }
}

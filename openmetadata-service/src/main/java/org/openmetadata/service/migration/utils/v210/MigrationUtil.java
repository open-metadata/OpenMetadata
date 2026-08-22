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
package org.openmetadata.service.migration.utils.v210;

import lombok.extern.slf4j.Slf4j;
import org.jdbi.v3.core.Handle;
import org.openmetadata.service.jdbi3.locator.ConnectionType;

@Slf4j
public class MigrationUtil {

  private static final String FLOWABLE_EVENT_SUBSCRIPTION_TABLE = "ACT_RU_EVENT_SUBSCR";
  private static final String ACTIVITY_ID_COLUMN = "ACTIVITY_ID_";
  private static final int REQUIRED_ACTIVITY_ID_LENGTH = 255;

  private static final String WIDEN_ACTIVITY_ID_MYSQL =
      "ALTER TABLE ACT_RU_EVENT_SUBSCR MODIFY COLUMN ACTIVITY_ID_ varchar(255)";
  private static final String WIDEN_ACTIVITY_ID_POSTGRES =
      "ALTER TABLE ACT_RU_EVENT_SUBSCR ALTER COLUMN ACTIVITY_ID_ TYPE varchar(255)";

  private static final String COLUMN_LENGTH_MYSQL =
      "SELECT character_maximum_length FROM information_schema.columns"
          + " WHERE table_schema = DATABASE() AND UPPER(table_name) = :tableName"
          + " AND UPPER(column_name) = :columnName";
  private static final String COLUMN_LENGTH_POSTGRES =
      "SELECT character_maximum_length FROM information_schema.columns"
          + " WHERE table_schema = current_schema() AND UPPER(table_name) = :tableName"
          + " AND UPPER(column_name) = :columnName";

  private MigrationUtil() {}

  /**
   * Restore the activity-id width OpenMetadata's governance workflows need.
   *
   * <p>Flowable declares {@code ACT_RU_EVENT_SUBSCR.ACTIVITY_ID_} as {@code varchar(64)}. Workflow
   * activity ids generated here are longer than that, so migration 1.6.0 — which used to create
   * Flowable's schema by hand — declared the column at {@code varchar(255)}. Flowable now creates
   * and versions that schema itself, so the widening has to be re-applied or the first workflow
   * signal fails with a data-truncation error.
   *
   * <p>Deliberately Java rather than SQL: the table only exists once Flowable has initialized, and
   * that initialization is allowed to fail without aborting a migration. A plain {@code ALTER} in a
   * SQL file would turn that tolerated failure into a hard stop, so the column is inspected first
   * and left alone when Flowable has not created its schema (yet) or the width is already correct.
   */
  public static void widenFlowableActivityId(Handle handle, ConnectionType connectionType) {
    Integer currentLength = currentActivityIdLength(handle, connectionType);
    if (currentLength == null) {
      LOG.info(
          "{} not present — Flowable has not created its schema; skipping activity id widening",
          FLOWABLE_EVENT_SUBSCRIPTION_TABLE);
    } else if (currentLength >= REQUIRED_ACTIVITY_ID_LENGTH) {
      LOG.debug("{} already at {} characters", ACTIVITY_ID_COLUMN, currentLength);
    } else {
      LOG.info(
          "Widening {}.{} from {} to {} characters",
          FLOWABLE_EVENT_SUBSCRIPTION_TABLE,
          ACTIVITY_ID_COLUMN,
          currentLength,
          REQUIRED_ACTIVITY_ID_LENGTH);
      handle.execute(
          connectionType == ConnectionType.MYSQL
              ? WIDEN_ACTIVITY_ID_MYSQL
              : WIDEN_ACTIVITY_ID_POSTGRES);
    }
  }

  private static Integer currentActivityIdLength(Handle handle, ConnectionType connectionType) {
    String query =
        connectionType == ConnectionType.MYSQL ? COLUMN_LENGTH_MYSQL : COLUMN_LENGTH_POSTGRES;
    return handle
        .createQuery(query)
        .bind("tableName", FLOWABLE_EVENT_SUBSCRIPTION_TABLE)
        .bind("columnName", ACTIVITY_ID_COLUMN)
        .mapTo(Integer.class)
        .findOne()
        .orElse(null);
  }
}

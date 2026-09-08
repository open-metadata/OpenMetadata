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
package org.openmetadata.it.tests.migration;

import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.openmetadata.it.bootstrap.TestSuiteBootstrap;
import org.openmetadata.service.jdbi3.locator.ConnectionType;

/**
 * OpenMetadata widens one Flowable column beyond what Flowable itself creates, and the session
 * database here is built the way a real installation is — baseline, then migrations, with Flowable
 * creating its own schema along the way.
 *
 * <p>Before the pre-2.0 migrations were consolidated, migration 1.6.0 declared Flowable's schema by
 * hand and the width came for free. It no longer does, and the only symptom of losing it is a
 * data-truncation error on the first workflow signal — far from the cause. This asserts the
 * customization directly so the next person to touch baseline or Flowable ownership finds out here.
 */
class FlowableSchemaCustomizationIT {

  private static final String EVENT_SUBSCRIPTION_TABLE = "ACT_RU_EVENT_SUBSCR";
  private static final String ACTIVITY_ID_COLUMN = "ACTIVITY_ID_";

  /** Governance workflow activity ids exceed Flowable's stock varchar(64). */
  private static final int REQUIRED_LENGTH = 255;

  @Test
  void flowableActivityIdIsWideEnoughForGovernanceWorkflows() {
    Optional<Integer> length = activityIdLength();
    assertTrue(
        length.isPresent(),
        EVENT_SUBSCRIPTION_TABLE
            + " is missing — Flowable never initialized, so workflow signals cannot be stored");
    assertTrue(
        length.get() >= REQUIRED_LENGTH,
        () ->
            String.format(
                "%s.%s is varchar(%d); governance workflows need at least %d or signals fail with"
                    + " a data-truncation error. The v210 migration applies this widening.",
                EVENT_SUBSCRIPTION_TABLE, ACTIVITY_ID_COLUMN, length.get(), REQUIRED_LENGTH));
  }

  private Optional<Integer> activityIdLength() {
    boolean mysql =
        ConnectionType.from(TestSuiteBootstrap.getDatabaseContainer().getDriverClassName())
            == ConnectionType.MYSQL;
    String query =
        mysql
            ? "SELECT character_maximum_length FROM information_schema.columns"
                + " WHERE table_schema = DATABASE() AND UPPER(table_name) = :tableName"
                + " AND UPPER(column_name) = :columnName"
            : "SELECT character_maximum_length FROM information_schema.columns"
                + " WHERE table_schema = current_schema() AND UPPER(table_name) = :tableName"
                + " AND UPPER(column_name) = :columnName";
    return TestSuiteBootstrap.getJdbi()
        .withHandle(
            handle ->
                handle
                    .createQuery(query)
                    .bind("tableName", EVENT_SUBSCRIPTION_TABLE)
                    .bind("columnName", ACTIVITY_ID_COLUMN)
                    .mapTo(Integer.class)
                    .findOne());
  }
}

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

package org.openmetadata.service.migration.utils.v210;

import lombok.extern.slf4j.Slf4j;
import org.jdbi.v3.core.Handle;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.DataQualityDimensionRepository;
import org.openmetadata.service.jdbi3.locator.ConnectionType;

/**
 * Gives every pre-existing test case the data quality dimension of its test definition (issue
 * #30362).
 *
 * <p>Dimensions became entities in 2.1.0 and a test case now holds its dimension as a `relatedTo`
 * relationship written at create time. Test cases that already existed have no such row and nothing
 * else creates one, so without this the REST API reports no dimension for every pre-upgrade test
 * case, the Data Quality dashboards bucket them all under "No Dimension", and the settings page
 * counts them as zero — including in the delete confirmation.
 */
@Slf4j
public final class DataQualityDimensionMigration {

  private DataQualityDimensionMigration() {}

  /**
   * Seeds the system dimensions, then points every test case without a dimension of its own at the
   * one its test definition names.
   *
   * <p>The seeding is not redundant with the seeding the server does on startup, and the order
   * matters: migrations run to completion before the server boots, so at this point
   * {@code data_quality_dimension} is still empty on an upgrading deployment. Backfilling first
   * would join against an empty table and insert nothing — silently, and for good, since the
   * statement is checksummed as applied and never runs again. Seeding from the same JSON resources
   * the server uses keeps the two in step; the startup pass then finds the rows by name and skips
   * them.
   */
  public static void backfillTestCaseDimensions(
      final Handle handle, final ConnectionType connectionType) {
    try {
      seedSystemDimensions();
      final int backfilled = backfill(handle, connectionType);
      LOG.info("Backfilled the inherited data quality dimension of {} test cases", backfilled);
    } catch (Exception e) {
      // Test cases left without a dimension degrade the dashboards but are not worth failing the
      // upgrade over — every other 2.1.0 migration step has already run by this point.
      LOG.error("Failed to backfill data quality dimensions onto existing test cases", e);
    }
  }

  private static void seedSystemDimensions() throws Exception {
    final DataQualityDimensionRepository repository =
        (DataQualityDimensionRepository) Entity.getEntityRepository(Entity.DATA_QUALITY_DIMENSION);
    repository.initSeedDataFromResources();
  }

  /**
   * Mirrors what TestCaseRepository does for a new test case: inherit whatever dimension the test
   * definition carries right now and mark the row inherited, so that later reclassifying the test
   * definition moves these test cases with it.
   *
   * <p>Test definitions set to `NoDimension`, or naming a dimension that does not exist, drop out
   * of the join and are left with no relationship — the same result as creating a test case against
   * them today. The anti-join makes the statement idempotent and leaves alone any test case that
   * already carries a dimension of its own.
   */
  private static int backfill(final Handle handle, final ConnectionType connectionType) {
    final boolean mysql = connectionType == ConnectionType.MYSQL;
    // relation 15 = relatedTo, relation 0 = contains (type/entityRelationship.json ordinals).
    final String sql =
        "INSERT INTO entity_relationship "
            + "(fromId, toId, fromEntity, toEntity, relation, relationType, deleted, json) "
            + "SELECT dqd.id, tc.id, 'dataQualityDimension', 'testCase', 15, '', "
            + (mysql
                ? "0, JSON_OBJECT('inherited', TRUE) "
                : "FALSE, '{\"inherited\": true}'::jsonb ")
            + "FROM test_case tc "
            + "JOIN entity_relationship td_rel ON td_rel.toId = tc.id "
            + "AND td_rel.toEntity = 'testCase' AND td_rel.fromEntity = 'testDefinition' "
            + "AND td_rel.relation = 0 "
            + "JOIN test_definition td ON td.id = td_rel.fromId "
            + "JOIN data_quality_dimension dqd ON dqd.name = "
            + (mysql
                ? "JSON_UNQUOTE(JSON_EXTRACT(td.json, '$.dataQualityDimension')) "
                : "td.json ->> 'dataQualityDimension' ")
            + "LEFT JOIN entity_relationship existing ON existing.toId = tc.id "
            + "AND existing.toEntity = 'testCase' AND existing.fromEntity = 'dataQualityDimension' "
            + "AND existing.relation = 15 "
            + "WHERE existing.toId IS NULL";
    return handle.createUpdate(sql).execute();
  }
}

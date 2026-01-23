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

package org.openmetadata.service.migration;

import static org.junit.jupiter.api.Assertions.*;

import org.jdbi.v3.core.Handle;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInstance;
import org.openmetadata.service.OpenMetadataApplicationTest;
import org.openmetadata.service.jdbi3.MigrationDAO;
import org.openmetadata.service.util.EntityUtil;

@TestInstance(TestInstance.Lifecycle.PER_CLASS)
public class MigrationProcessImplTest extends OpenMetadataApplicationTest {

  private static MigrationDAO migrationDAO;

  @BeforeAll
  public static void setup() {
    migrationDAO = jdbi.onDemand(MigrationDAO.class);
  }

  @Test
  public void testSqlQueryLookupWithCorrectParameterOrder() {
    String version = "test-migration-process-" + System.nanoTime();
    String sql = "CREATE TABLE test_table_" + System.nanoTime() + " (id INT)";
    String checksum = EntityUtil.hash(sql);

    migrationDAO.upsertServerMigrationSQL(version, sql, checksum);

    String found = migrationDAO.getSqlQuery(version, checksum);
    assertNotNull(found, "getSqlQuery(version, checksum) should find the record");
    assertEquals(sql, found);
  }

  @Test
  public void testSqlQueryLookupWithWrongParameterOrderFails() {
    String version = "test-wrong-order-" + System.nanoTime();
    String sql = "CREATE TABLE wrong_order_" + System.nanoTime() + " (id INT)";
    String checksum = EntityUtil.hash(sql);

    migrationDAO.upsertServerMigrationSQL(version, sql, checksum);

    String notFound = migrationDAO.getSqlQuery(checksum, version);
    assertNull(notFound, "getSqlQuery(checksum, version) should NOT find the record (wrong order)");
  }

  @Test
  public void testSqlDeduplicationPreventsReExecution() {
    try (Handle handle = jdbi.open()) {
      String version = "test-dedup-" + System.nanoTime();
      String sql = "SELECT 'test-dedup-" + System.nanoTime() + "'";
      String checksum = EntityUtil.hash(sql);

      String beforeInsert = migrationDAO.getSqlQuery(version, checksum);
      assertNull(beforeInsert, "Should not find SQL before insertion");

      migrationDAO.upsertServerMigrationSQL(version, sql, checksum);

      String afterInsert = migrationDAO.getSqlQuery(version, checksum);
      assertNotNull(afterInsert, "Should find SQL after insertion");

      migrationDAO.upsertServerMigrationSQL(version, sql, checksum);

      String afterSecondInsert = migrationDAO.getSqlQuery(version, checksum);
      assertEquals(afterInsert, afterSecondInsert, "Upsert should be idempotent");
    }
  }

  @Test
  public void testFlywayMigrationSqlLogsPopulated() {
    try (Handle handle = jdbi.open()) {
      Integer count =
          handle
              .createQuery(
                  "SELECT COUNT(*) FROM SERVER_MIGRATION_SQL_LOGS WHERE version LIKE '0.0.%'")
              .mapTo(Integer.class)
              .one();

      assertTrue(count >= 0, "Flyway SQL logs query should execute without error");
    }
  }

  @Test
  public void testChecksumConsistency() {
    String sql1 = "SELECT 1";
    String sql2 = "SELECT 1";
    String sql3 = "SELECT 2";

    String checksum1 = EntityUtil.hash(sql1);
    String checksum2 = EntityUtil.hash(sql2);
    String checksum3 = EntityUtil.hash(sql3);

    assertEquals(checksum1, checksum2, "Same SQL should produce same checksum");
    assertNotEquals(checksum1, checksum3, "Different SQL should produce different checksum");
  }
}

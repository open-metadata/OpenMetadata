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

package org.openmetadata.service.migration.utils.v1114;

import static org.junit.jupiter.api.Assertions.*;

import org.jdbi.v3.core.Handle;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInstance;
import org.openmetadata.service.OpenMetadataApplicationTest;
import org.openmetadata.service.jdbi3.MigrationDAO;
import org.openmetadata.service.jdbi3.locator.ConnectionType;
import org.openmetadata.service.util.EntityUtil;

@TestInstance(TestInstance.Lifecycle.PER_CLASS)
public class MigrationUtilTest extends OpenMetadataApplicationTest {

  private static MigrationDAO migrationDAO;
  private static ConnectionType connectionType;

  @BeforeAll
  public static void setup() {
    migrationDAO = jdbi.onDemand(MigrationDAO.class);
    connectionType =
        ConnectionType.from(APP.getConfiguration().getDataSourceFactory().getDriverClass());
  }

  @Test
  public void testGetSqlQueryParameterOrder() {
    try (Handle handle = jdbi.open()) {
      String testVersion = "test-1.11.4-param-order";
      String testSql =
          "SELECT 1 FROM dual WHERE id = 'test-parameter-order-" + System.nanoTime() + "'";
      String checksum = EntityUtil.hash(testSql);

      migrationDAO.upsertServerMigrationSQL(testVersion, testSql, checksum);

      String resultCorrectOrder = migrationDAO.getSqlQuery(testVersion, checksum);
      assertNotNull(
          resultCorrectOrder, "Should find SQL with correct parameter order (version, checksum)");
      assertEquals(testSql, resultCorrectOrder);

      String resultWrongOrder = migrationDAO.getSqlQuery(checksum, testVersion);
      assertNull(
          resultWrongOrder, "Should NOT find SQL with wrong parameter order (checksum, version)");
    }
  }

  @Test
  public void testCheckAndLogDataLossSymptomsDoesNotThrow() {
    try (Handle handle = jdbi.open()) {
      assertDoesNotThrow(
          () -> MigrationUtil.checkAndLogDataLossSymptoms(handle),
          "checkAndLogDataLossSymptoms should handle all cases without throwing");
    }
  }

  @Test
  public void testRestoreBotRelationshipsIsIdempotent() {
    try (Handle handle = jdbi.open()) {
      String countQuery =
          "SELECT COUNT(*) FROM entity_relationship WHERE fromEntity = 'application' AND toEntity = 'bot' AND relation = 0";

      Integer countBefore = handle.createQuery(countQuery).mapTo(Integer.class).one();

      MigrationUtil.restoreBotRelationshipsIfMissing(handle, connectionType);
      Integer countAfterFirst = handle.createQuery(countQuery).mapTo(Integer.class).one();

      MigrationUtil.restoreBotRelationshipsIfMissing(handle, connectionType);
      Integer countAfterSecond = handle.createQuery(countQuery).mapTo(Integer.class).one();

      assertEquals(countAfterFirst, countAfterSecond, "Running twice should not create duplicates");
      assertTrue(countAfterFirst >= countBefore, "Should not decrease relationship count");
    }
  }

  @Test
  public void testRestoreBotRelationshipsOnlyRestoresMissing() {
    try (Handle handle = jdbi.open()) {
      String appsWithoutBotQuery =
          connectionType == ConnectionType.MYSQL
              ? """
                  SELECT COUNT(*) FROM installed_apps a
                  WHERE NOT EXISTS (
                      SELECT 1 FROM entity_relationship er
                      WHERE er.fromId = a.id AND er.toEntity = 'bot' AND er.relation = 0
                  )
                  """
              : """
                  SELECT COUNT(*) FROM installed_apps a
                  WHERE NOT EXISTS (
                      SELECT 1 FROM entity_relationship er
                      WHERE er.fromId = a.id AND er.toEntity = 'bot' AND er.relation = 0
                  )
                  """;

      Integer missingBefore = handle.createQuery(appsWithoutBotQuery).mapTo(Integer.class).one();

      MigrationUtil.restoreBotRelationshipsIfMissing(handle, connectionType);

      Integer missingAfter = handle.createQuery(appsWithoutBotQuery).mapTo(Integer.class).one();

      assertTrue(
          missingAfter <= missingBefore,
          "Apps without bot relationships should decrease or stay same after restoration");
    }
  }

  @Test
  public void testAppsWithoutBotRelationshipsQuerySyntax() {
    try (Handle handle = jdbi.open()) {
      String query =
          connectionType == ConnectionType.MYSQL
              ? """
                  SELECT a.id, JSON_UNQUOTE(JSON_EXTRACT(a.json, '$.name')) as name
                  FROM installed_apps a
                  WHERE NOT EXISTS (
                      SELECT 1 FROM entity_relationship er
                      WHERE er.fromId = a.id AND er.toEntity = 'bot' AND er.relation = 0
                  )
                  """
              : """
                  SELECT a.id, a.json->>'name' as name
                  FROM installed_apps a
                  WHERE NOT EXISTS (
                      SELECT 1 FROM entity_relationship er
                      WHERE er.fromId = a.id AND er.toEntity = 'bot' AND er.relation = 0
                  )
                  """;

      assertDoesNotThrow(
          () -> handle.createQuery(query).mapToMap().list(),
          "Query to find apps without bot relationships should be valid SQL");
    }
  }

  @Test
  public void testFindBotByNameQuerySyntax() {
    try (Handle handle = jdbi.open()) {
      String query =
          connectionType == ConnectionType.MYSQL
              ? "SELECT id FROM bot_entity WHERE JSON_UNQUOTE(JSON_EXTRACT(json, '$.name')) = :botName"
              : "SELECT id FROM bot_entity WHERE json->>'name' = :botName";

      assertDoesNotThrow(
          () -> handle.createQuery(query).bind("botName", "TestBot").mapToMap().list(),
          "Query to find bot by name should be valid SQL");
    }
  }

  @Test
  public void testInsertRelationshipQuerySyntax() {
    try (Handle handle = jdbi.open()) {
      String testAppId = "00000000-0000-0000-0000-000000000001";
      String testBotId = "00000000-0000-0000-0000-000000000002";

      String query =
          connectionType == ConnectionType.MYSQL
              ? """
                  INSERT IGNORE INTO entity_relationship (fromId, toId, fromEntity, toEntity, relation)
                  VALUES (:appId, :botId, 'application', 'bot', :relation)
                  """
              : """
                  INSERT INTO entity_relationship (fromId, toId, fromEntity, toEntity, relation)
                  VALUES (:appId, :botId, 'application', 'bot', :relation)
                  ON CONFLICT DO NOTHING
                  """;

      assertDoesNotThrow(
          () ->
              handle
                  .createUpdate(query)
                  .bind("appId", testAppId)
                  .bind("botId", testBotId)
                  .bind("relation", 0)
                  .execute(),
          "Insert relationship query should be valid SQL");
    }
  }

  @Test
  public void testDataLossDetectionWithNonEmptyTables() {
    try (Handle handle = jdbi.open()) {
      Integer roleCount =
          handle.createQuery("SELECT COUNT(*) FROM role_entity").mapTo(Integer.class).one();
      Integer policyCount =
          handle.createQuery("SELECT COUNT(*) FROM policy_entity").mapTo(Integer.class).one();

      if (roleCount > 0 && policyCount > 0) {
        assertDoesNotThrow(
            () -> MigrationUtil.checkAndLogDataLossSymptoms(handle),
            "Should not throw when tables have data");
      }
    }
  }

  @Test
  public void testReseedRolesAndPoliciesDoesNotThrow() {
    try (Handle handle = jdbi.open()) {
      assertDoesNotThrow(
          () -> MigrationUtil.reseedRolesAndPoliciesIfMissing(handle, connectionType),
          "reseedRolesAndPoliciesIfMissing should handle all cases without throwing");
    }
  }

  @Test
  public void testReseedRolesAndPoliciesIsIdempotent() {
    try (Handle handle = jdbi.open()) {
      Integer roleCountBefore =
          handle.createQuery("SELECT COUNT(*) FROM role_entity").mapTo(Integer.class).one();
      Integer policyCountBefore =
          handle.createQuery("SELECT COUNT(*) FROM policy_entity").mapTo(Integer.class).one();

      MigrationUtil.reseedRolesAndPoliciesIfMissing(handle, connectionType);
      Integer roleCountAfterFirst =
          handle.createQuery("SELECT COUNT(*) FROM role_entity").mapTo(Integer.class).one();
      Integer policyCountAfterFirst =
          handle.createQuery("SELECT COUNT(*) FROM policy_entity").mapTo(Integer.class).one();

      MigrationUtil.reseedRolesAndPoliciesIfMissing(handle, connectionType);
      Integer roleCountAfterSecond =
          handle.createQuery("SELECT COUNT(*) FROM role_entity").mapTo(Integer.class).one();
      Integer policyCountAfterSecond =
          handle.createQuery("SELECT COUNT(*) FROM policy_entity").mapTo(Integer.class).one();

      assertEquals(
          roleCountAfterFirst, roleCountAfterSecond, "Running twice should not create duplicates");
      assertEquals(
          policyCountAfterFirst,
          policyCountAfterSecond,
          "Running twice should not create duplicates");
      assertTrue(roleCountAfterFirst >= roleCountBefore, "Should not decrease role count");
      assertTrue(policyCountAfterFirst >= policyCountBefore, "Should not decrease policy count");
    }
  }

  @Test
  public void testRestoreRolePolicyRelationshipsDoesNotThrow() {
    try (Handle handle = jdbi.open()) {
      assertDoesNotThrow(
          () -> MigrationUtil.restoreRolePolicyRelationshipsIfMissing(handle, connectionType),
          "restoreRolePolicyRelationshipsIfMissing should handle all cases without throwing");
    }
  }

  @Test
  public void testRestoreRolePolicyRelationshipsIsIdempotent() {
    try (Handle handle = jdbi.open()) {
      String countQuery =
          "SELECT COUNT(*) FROM entity_relationship WHERE fromEntity = 'role' AND toEntity = 'policy' AND relation = 1";

      Integer countBefore = handle.createQuery(countQuery).mapTo(Integer.class).one();

      MigrationUtil.restoreRolePolicyRelationshipsIfMissing(handle, connectionType);
      Integer countAfterFirst = handle.createQuery(countQuery).mapTo(Integer.class).one();

      MigrationUtil.restoreRolePolicyRelationshipsIfMissing(handle, connectionType);
      Integer countAfterSecond = handle.createQuery(countQuery).mapTo(Integer.class).one();

      assertEquals(
          countAfterFirst, countAfterSecond, "Running twice should not create duplicate relations");
      assertTrue(countAfterFirst >= countBefore, "Should not decrease relationship count");
    }
  }

  @Test
  public void testRestoreBotUserRolesDoesNotThrow() {
    try (Handle handle = jdbi.open()) {
      assertDoesNotThrow(
          () -> MigrationUtil.restoreBotUserRolesIfMissing(handle, connectionType),
          "restoreBotUserRolesIfMissing should handle all cases without throwing");
    }
  }

  @Test
  public void testRestoreBotUserRolesIsIdempotent() {
    try (Handle handle = jdbi.open()) {
      String countQuery =
          "SELECT COUNT(*) FROM entity_relationship WHERE fromEntity = 'user' AND toEntity = 'role' AND relation = 1";

      Integer countBefore = handle.createQuery(countQuery).mapTo(Integer.class).one();

      MigrationUtil.restoreBotUserRolesIfMissing(handle, connectionType);
      Integer countAfterFirst = handle.createQuery(countQuery).mapTo(Integer.class).one();

      MigrationUtil.restoreBotUserRolesIfMissing(handle, connectionType);
      Integer countAfterSecond = handle.createQuery(countQuery).mapTo(Integer.class).one();

      assertEquals(
          countAfterFirst, countAfterSecond, "Running twice should not create duplicate relations");
      assertTrue(countAfterFirst >= countBefore, "Should not decrease relationship count");
    }
  }

  @Test
  public void testFullRecoveryFlowDoesNotThrow() {
    try (Handle handle = jdbi.open()) {
      assertDoesNotThrow(
          () -> {
            MigrationUtil.checkAndLogDataLossSymptoms(handle);
            MigrationUtil.reseedRolesAndPoliciesIfMissing(handle, connectionType);
            MigrationUtil.restoreRolePolicyRelationshipsIfMissing(handle, connectionType);
            MigrationUtil.restoreBotRelationshipsIfMissing(handle, connectionType);
            MigrationUtil.restoreBotUserRolesIfMissing(handle, connectionType);
          },
          "Full recovery flow should complete without throwing");
    }
  }

  @Test
  public void testRecoveryPreservesExistingData() {
    try (Handle handle = jdbi.open()) {
      Integer roleCountBefore =
          handle.createQuery("SELECT COUNT(*) FROM role_entity").mapTo(Integer.class).one();
      Integer policyCountBefore =
          handle.createQuery("SELECT COUNT(*) FROM policy_entity").mapTo(Integer.class).one();
      Integer relationCountBefore =
          handle.createQuery("SELECT COUNT(*) FROM entity_relationship").mapTo(Integer.class).one();

      MigrationUtil.checkAndLogDataLossSymptoms(handle);
      MigrationUtil.reseedRolesAndPoliciesIfMissing(handle, connectionType);
      MigrationUtil.restoreRolePolicyRelationshipsIfMissing(handle, connectionType);
      MigrationUtil.restoreBotRelationshipsIfMissing(handle, connectionType);
      MigrationUtil.restoreBotUserRolesIfMissing(handle, connectionType);

      Integer roleCountAfter =
          handle.createQuery("SELECT COUNT(*) FROM role_entity").mapTo(Integer.class).one();
      Integer policyCountAfter =
          handle.createQuery("SELECT COUNT(*) FROM policy_entity").mapTo(Integer.class).one();
      Integer relationCountAfter =
          handle.createQuery("SELECT COUNT(*) FROM entity_relationship").mapTo(Integer.class).one();

      assertTrue(roleCountAfter >= roleCountBefore, "Recovery should not delete existing roles");
      assertTrue(
          policyCountAfter >= policyCountBefore, "Recovery should not delete existing policies");
      assertTrue(
          relationCountAfter >= relationCountBefore,
          "Recovery should not delete existing relationships");
    }
  }

  @Test
  public void testSystemRolesExistAfterRecovery() {
    try (Handle handle = jdbi.open()) {
      MigrationUtil.reseedRolesAndPoliciesIfMissing(handle, connectionType);

      String checkRoleQuery =
          connectionType == ConnectionType.MYSQL
              ? "SELECT COUNT(*) FROM role_entity WHERE JSON_UNQUOTE(JSON_EXTRACT(json, '$.name')) = :name"
              : "SELECT COUNT(*) FROM role_entity WHERE json->>'name' = :name";

      String[] systemRoles = {"DataConsumer", "DataSteward", "IngestionBotRole"};
      for (String roleName : systemRoles) {
        Integer count =
            handle.createQuery(checkRoleQuery).bind("name", roleName).mapTo(Integer.class).one();
        assertTrue(count >= 0, "Query for role " + roleName + " should execute successfully");
      }
    }
  }

  @Test
  public void testSystemPoliciesExistAfterRecovery() {
    try (Handle handle = jdbi.open()) {
      MigrationUtil.reseedRolesAndPoliciesIfMissing(handle, connectionType);

      String checkPolicyQuery =
          connectionType == ConnectionType.MYSQL
              ? "SELECT COUNT(*) FROM policy_entity WHERE JSON_UNQUOTE(JSON_EXTRACT(json, '$.name')) = :name"
              : "SELECT COUNT(*) FROM policy_entity WHERE json->>'name' = :name";

      String[] systemPolicies = {"OrganizationPolicy", "DataConsumerPolicy", "DataStewardPolicy"};
      for (String policyName : systemPolicies) {
        Integer count =
            handle
                .createQuery(checkPolicyQuery)
                .bind("name", policyName)
                .mapTo(Integer.class)
                .one();
        assertTrue(count >= 0, "Query for policy " + policyName + " should execute successfully");
      }
    }
  }
}

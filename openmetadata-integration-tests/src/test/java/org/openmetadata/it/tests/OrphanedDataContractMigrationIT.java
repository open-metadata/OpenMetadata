/*
 *  Copyright 2025 Collate
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
package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.bootstrap.SharedEntities;
import org.openmetadata.it.bootstrap.TestSuiteBootstrap;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.data.CreateDataContract;
import org.openmetadata.schema.api.data.CreateDatabase;
import org.openmetadata.schema.api.data.CreateDatabaseSchema;
import org.openmetadata.schema.api.data.CreateTable;
import org.openmetadata.schema.api.tests.CreateTestCase;
import org.openmetadata.schema.entity.data.DataContract;
import org.openmetadata.schema.entity.data.Database;
import org.openmetadata.schema.entity.data.DatabaseSchema;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.datacontract.DataContractResult;
import org.openmetadata.schema.tests.TestCase;
import org.openmetadata.schema.tests.TestCaseParameterValue;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.ColumnDataType;
import org.openmetadata.schema.type.ContractExecutionStatus;
import org.openmetadata.schema.type.EntityStatus;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.exceptions.OpenMetadataException;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.DataContractRepository;
import org.openmetadata.service.jdbi3.locator.ConnectionType;
import org.openmetadata.service.migration.utils.v1100.MigrationUtil;
import org.openmetadata.service.util.FullyQualifiedName;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * End-to-end regression for the v1.10.0 {@link MigrationUtil#cleanupOrphanedDataContracts()} bug:
 * the migration resolved each contract's parent with {@code Include.NON_DELETED}, which throws
 * {@code EntityNotFoundException} for both a hard-deleted (truly gone) parent <em>and</em> a
 * soft-deleted (recoverable trash) parent, and then recursively hard-deleted the contract —
 * destroying the contract, its logical test suite, the suite's DQ ingestion pipelines and the
 * contract-result time series irreversibly, and purging the CONTAINS edge so a later parent
 * restore could not bring the contract back.
 *
 * <p>The fix re-checks the parent with {@code Include.ALL} and only hard-deletes the contract when
 * the parent row is truly gone. These tests drive that path on a live cluster: they create a
 * table-backed data contract (owning a logical test suite and a stored result), put the parent in
 * trash via the soft-delete API, run the migration directly via JDBI, and assert that the
 * contract, suite and result rows all survive — then restore the table and assert the contract
 * comes back with its history. A paired test fabricates a truly missing parent (direct row delete
 * that bypasses the cascade) and asserts the migration still hard-deletes the orphan, pinning the
 * cleanup's original intent against regression.
 *
 * <p>{@link ExecutionMode#SAME_THREAD} because {@code cleanupOrphanedDataContracts()} lists every
 * data contract with {@code Include.ALL}: a concurrent test creating or deleting contracts could
 * race the scan and either skip a real orphan or reach into another test's fixture. {@code
 * OrphanIngestionPipelineCleanupIT} uses the same mode for the same reason.
 */
@Execution(ExecutionMode.SAME_THREAD)
@ExtendWith(TestNamespaceExtension.class)
public class OrphanedDataContractMigrationIT {

  private static final Logger LOG = LoggerFactory.getLogger(OrphanedDataContractMigrationIT.class);

  private static final String ENTITY_EXTENSION_TIME_SERIES = "entity_extension_time_series";
  private static final String DATA_CONTRACT_ENTITY = "data_contract_entity";
  private static final String TEST_SUITE_ENTITY = "test_suite";
  private static final String ENTITY_RELATIONSHIP = "entity_relationship";
  private static final String TABLE_ENTITY = "table_entity";
  private static final Map<String, String> RECURSIVE_HARD_DELETE =
      Map.of("hardDelete", "true", "recursive", "true");

  /**
   * Newest-first teardown for everything a test created, registered at creation time so an
   * assertion failing mid-test still cleans up. Mirrors {@code SoftDeleteRetentionIT} — the
   * {@link TestNamespaceExtension} cleanup only walks roots tracked via {@code ns.trackRoot}, and
   * these tests delete the parent table by id rather than tracking a database root, so the
   * contract's parents would otherwise leak on a failed assertion.
   */
  private final List<Runnable> fixtureCleanups = new ArrayList<>();

  @AfterEach
  void removeFixtures() {
    for (Runnable cleanup : fixtureCleanups.reversed()) {
      try {
        cleanup.run();
      } catch (OpenMetadataException alreadyGone) {
        LOG.debug("Fixture already removed by the test: {}", alreadyGone.getMessage());
      }
    }
    fixtureCleanups.clear();
  }

  /**
   * The bug: a contract whose parent table is in trash is hard-deleted by the v1.10.0 migration
   * even though the parent row is still present (deleted = true) and could be restored. This test
   * pins the fix — the migration must leave the contract (and its test suite, and its result
   * history) intact, and a later table restore must bring the contract back with everything still
   * attached.
   */
  @Test
  void contractWithSoftDeletedParent_migrationLeavesItIntactForRestore(TestNamespace ns)
      throws Exception {
    DataContract contract = createContractWithQualityExpectations(ns, "softDelParentDC");
    addContractResult(contract);
    UUID contractId = contract.getId();
    UUID tableId = contract.getEntity().getId();
    UUID testSuiteId = contract.getTestSuite().getId();
    String contractFqn = contract.getFullyQualifiedName();

    // Soft-deleting the table must be recursive — the contract is a CONTAINS child, so the
    // server refuses a non-recursive delete with "table is not empty". The cascade soft-deletes
    // the contract via the CONTAINS edge; the logical test suite stays alive (it is touched
    // only on the hard-delete hook).
    SdkClients.adminClient().tables().delete(tableId.toString(), Map.of("recursive", "true"));

    assertEquals(1, contractRowCount(contractId), "soft-deleted contract row must still exist");
    assertEquals(1, testSuiteRowCount(testSuiteId), "soft delete must not touch the test suite");
    assertEquals(
        1,
        countResultRows(contractFqn),
        "soft delete must not destroy the data contract result time series");
    assertEquals(
        1,
        containsEdgeRowCount(tableId, contractId),
        "the table -> contract CONTAINS edge must survive soft delete so a restore can find it");

    // Run the v1.10.0 migration against the live cluster. It must NOT hard-delete this contract.
    runCleanupMigration();

    assertEquals(
        1,
        contractRowCount(contractId),
        "migration must not hard-delete a contract whose parent is merely soft-deleted");
    assertEquals(
        1,
        testSuiteRowCount(testSuiteId),
        "migration must not destroy the contract's logical test suite for a soft-deleted parent");
    assertEquals(
        1,
        countResultRows(contractFqn),
        "migration must not destroy the contract-result time series for a soft-deleted parent");
    assertEquals(
        1,
        containsEdgeRowCount(tableId, contractId),
        "the CONTAINS edge must survive so the table restore can cascade to the contract");

    // Restoring the parent must bring the contract back, with the same suite and history intact.
    SdkClients.adminClient().tables().restore(tableId.toString());

    DataContract restored = SdkClients.adminClient().dataContracts().get(contractId.toString());
    assertNotNull(restored, "restored table must bring the contract back via the cascade");
    assertFalse(
        Boolean.TRUE.equals(restored.getDeleted()),
        "restored contract must not be in trash after the parent restore");
    assertNotNull(restored.getTestSuite(), "restored contract must still reference its test suite");
    assertEquals(
        testSuiteId,
        restored.getTestSuite().getId(),
        "restored contract must reference the same test suite it had before the soft delete");
    DataContractResult latest =
        SdkClients.adminClient().dataContracts().getLatestResult(contractId);
    assertNotNull(latest, "restored contract must still expose its validation history");
    assertEquals(
        ContractExecutionStatus.Success,
        latest.getContractExecutionStatus(),
        "the pre-soft-delete result must be the one read back after restore");
  }

  /**
   * Pairs with the soft-delete test to pin the migration's original intent: a contract whose
   * parent row is truly gone (the pre-1.9.3 HAS-relationship orphan) is still hard-deleted, taking
   * its logical test suite and result history with it. The parent row is removed directly via SQL
   * to bypass the cascade that the API hard-delete would have run, so the contract is left
   * dangling exactly the way the pre-fix bug left contracts behind.
   */
  @Test
  void contractWithTrulyMissingParent_migrationHardDeletesIt(TestNamespace ns) throws Exception {
    DataContract contract = createContractWithQualityExpectations(ns, "trulyMissingParentDC");
    addContractResult(contract);
    UUID contractId = contract.getId();
    UUID tableId = contract.getEntity().getId();
    UUID testSuiteId = contract.getTestSuite().getId();
    String contractFqn = contract.getFullyQualifiedName();

    // Bypass the application cascade so the contract is left orphaned: delete the table row
    // directly. The contract's CONTAINS edge and row remain, which is the state the migration's
    // cleanup is designed for. We also have to invalidate the in-process entity cache — the
    // repository caches the table row from createTable, so without invalidation the migration's
    // Include.ALL parent lookup returns the stale cached entity instead of throwing
    // EntityNotFoundException, and the contract would be left intact instead of hard-deleted.
    TestSuiteBootstrap.getJdbi()
        .useHandle(
            handle ->
                handle
                    .createUpdate("DELETE FROM " + TABLE_ENTITY + " WHERE id = :id")
                    .bind("id", tableId.toString())
                    .execute());
    org.openmetadata.service.jdbi3.EntityRepository.invalidateCacheForEntity(
        Entity.TABLE, tableId, null);
    // Defensive teardown in case the migration does not run: best-effort removal of the
    // contract by id and any residual relationship row pointed at the gone parent.
    fixtureCleanups.add(
        () -> {
          try {
            SdkClients.adminClient()
                .dataContracts()
                .delete(contractId.toString(), RECURSIVE_HARD_DELETE);
          } catch (OpenMetadataException ignored) {
            // Migration already removed it, or it was never cleaned up — best-effort.
          }
          try {
            TestSuiteBootstrap.getJdbi()
                .useHandle(
                    h ->
                        h.createUpdate(
                                "DELETE FROM "
                                    + ENTITY_RELATIONSHIP
                                    + " WHERE toId = :toId AND toEntity = :toEntity")
                            .bind("toId", contractId.toString())
                            .bind("toEntity", Entity.DATA_CONTRACT)
                            .execute());
          } catch (org.jdbi.v3.core.JdbiException e) {
            LOG.warn(
                "Best-effort cleanup of residual relationship rows for contract {} failed: {}",
                contractId,
                e.getMessage());
          }
        });

    assertEquals(
        1,
        contractRowCount(contractId),
        "the contract row must still exist after the parent row is removed");
    assertEquals(
        0,
        tableRowCount(tableId),
        "the parent table row must be gone, modeling a pre-1.9.3 hard-deleted parent");

    runCleanupMigration();

    assertEquals(
        0,
        contractRowCount(contractId),
        "migration must hard-delete a contract whose parent row is truly gone");
    assertEquals(
        0,
        testSuiteRowCount(testSuiteId),
        "hard-deleting the contract must take its logical test suite with it");
    assertEquals(
        0,
        countResultRows(contractFqn),
        "hard-deleting the contract must purge its data contract result history");
    assertEquals(
        0,
        containsEdgeRowCount(tableId, contractId),
        "hard-deleting the contract must remove the parent CONTAINS edge");
  }

  // ===================================================================
  // Migration runner
  // ===================================================================

  private void runCleanupMigration() {
    try (org.jdbi.v3.core.Handle handle = TestSuiteBootstrap.getJdbi().open()) {
      ConnectionType connectionType = TestSuiteBootstrap.getConnectionType();
      new MigrationUtil(handle, connectionType).cleanupOrphanedDataContracts();
    }
  }

  // ===================================================================
  // Row-level probes (portable across MySQL and Postgres — COUNT-only)
  // ===================================================================

  private int contractRowCount(UUID contractId) {
    return entityRowCount(DATA_CONTRACT_ENTITY, contractId);
  }

  private int testSuiteRowCount(UUID testSuiteId) {
    return entityRowCount(TEST_SUITE_ENTITY, testSuiteId);
  }

  private int tableRowCount(UUID tableId) {
    return entityRowCount(TABLE_ENTITY, tableId);
  }

  private int entityRowCount(String table, UUID id) {
    return TestSuiteBootstrap.getJdbi()
        .withHandle(
            handle ->
                handle
                    .createQuery("SELECT COUNT(*) FROM " + table + " WHERE id = :id")
                    .bind("id", id.toString())
                    .mapTo(Integer.class)
                    .one());
  }

  private int countResultRows(String contractFqn) {
    String entityFqnHash = FullyQualifiedName.buildHash(contractFqn);
    return TestSuiteBootstrap.getJdbi()
        .withHandle(
            handle ->
                handle
                    .createQuery(
                        "SELECT COUNT(*) FROM "
                            + ENTITY_EXTENSION_TIME_SERIES
                            + " WHERE entityFQNHash = :entityFqnHash AND extension = :extension")
                    .bind("entityFqnHash", entityFqnHash)
                    .bind("extension", DataContractRepository.RESULT_EXTENSION)
                    .mapTo(Integer.class)
                    .one());
  }

  private int containsEdgeRowCount(UUID parentId, UUID contractId) {
    return TestSuiteBootstrap.getJdbi()
        .withHandle(
            handle ->
                handle
                    .createQuery(
                        "SELECT COUNT(*) FROM "
                            + ENTITY_RELATIONSHIP
                            + " WHERE fromId = :fromId AND toId = :toId"
                            + " AND toEntity = :toEntity AND relation = :relation")
                    .bind("fromId", parentId.toString())
                    .bind("toId", contractId.toString())
                    .bind("toEntity", Entity.DATA_CONTRACT)
                    .bind("relation", Relationship.CONTAINS.ordinal())
                    .mapTo(Integer.class)
                    .one());
  }

  // ===================================================================
  // Fixtures
  // ===================================================================

  private DataContract createContractWithQualityExpectations(TestNamespace ns, String prefix)
      throws Exception {
    Table table = createTable(ns, prefix);
    TestCase testCase =
        SdkClients.adminClient()
            .testCases()
            .create(
                new CreateTestCase()
                    .withName(ns.prefix(prefix + "_tc"))
                    .withEntityLink("<#E::table::" + table.getFullyQualifiedName() + ">")
                    .withTestDefinition("tableRowCountToBeBetween")
                    .withParameterValues(
                        List.of(
                            new TestCaseParameterValue().withName("minValue").withValue("0"),
                            new TestCaseParameterValue().withName("maxValue").withValue("100"))));

    DataContract contract =
        SdkClients.adminClient()
            .dataContracts()
            .create(
                new CreateDataContract()
                    .withName(ns.prefix(prefix))
                    .withEntity(table.getEntityReference())
                    .withEntityStatus(EntityStatus.APPROVED)
                    .withQualityExpectations(List.of(testCase.getEntityReference()))
                    .withDescription("Orphaned data contract migration guard"));
    assertNotNull(
        contract.getTestSuite(), "contract with qualityExpectations must own a test suite");
    // Defensive teardown: hard-delete the contract by id; if the parent table still exists, the
    // recursive hard-delete of the database cascade (registered by createTable) takes the rest.
    fixtureCleanups.add(
        () -> {
          try {
            SdkClients.adminClient()
                .dataContracts()
                .delete(contract.getId().toString(), RECURSIVE_HARD_DELETE);
          } catch (OpenMetadataException alreadyGone) {
            LOG.debug("Contract already removed during teardown: {}", alreadyGone.getMessage());
          }
        });
    return contract;
  }

  private void addContractResult(DataContract contract) throws Exception {
    SdkClients.adminClient()
        .dataContracts()
        .addResult(
            contract.getId(),
            new DataContractResult()
                .withDataContractFQN(contract.getFullyQualifiedName())
                .withTimestamp(System.currentTimeMillis())
                .withContractExecutionStatus(ContractExecutionStatus.Success)
                .withResult("Validation passed")
                .withExecutionTime(42L));
  }

  /**
   * Builds a table under the shared MySQL service so a database-level recursive hard delete in
   * teardown cascades through the schema, table and any data contract still attached to it — the
   * same teardown pattern used by {@code SoftDeleteRetentionIT}.
   */
  private Table createTable(TestNamespace ns, String prefix) {
    OpenMetadataClient client = SdkClients.adminClient();
    String shortId = ns.uniqueShortId();
    Database database =
        client
            .databases()
            .create(
                new CreateDatabase()
                    .withName(prefix + "Db_" + shortId)
                    .withService(SharedEntities.get().MYSQL_SERVICE.getFullyQualifiedName()));
    fixtureCleanups.add(
        () -> client.databases().delete(database.getId().toString(), RECURSIVE_HARD_DELETE));
    DatabaseSchema schema =
        client
            .databaseSchemas()
            .create(
                new CreateDatabaseSchema()
                    .withName(prefix + "Sc_" + shortId)
                    .withDatabase(database.getFullyQualifiedName()));
    return client
        .tables()
        .create(
            new CreateTable()
                .withName(prefix + "Tb_" + shortId)
                .withDatabaseSchema(schema.getFullyQualifiedName())
                .withColumns(
                    List.of(new Column().withName("id").withDataType(ColumnDataType.BIGINT))));
  }
}

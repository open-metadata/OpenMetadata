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
import static org.junit.jupiter.api.Assertions.assertThrows;

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
import org.openmetadata.schema.api.services.ingestionPipelines.CreateIngestionPipeline;
import org.openmetadata.schema.api.tests.CreateTestCase;
import org.openmetadata.schema.entity.app.App;
import org.openmetadata.schema.entity.app.AppExtension;
import org.openmetadata.schema.entity.app.AppMarketPlaceDefinition;
import org.openmetadata.schema.entity.app.AppRunRecord;
import org.openmetadata.schema.entity.app.AppSchedule;
import org.openmetadata.schema.entity.app.AppType;
import org.openmetadata.schema.entity.app.CreateApp;
import org.openmetadata.schema.entity.app.CreateAppMarketPlaceDefinitionReq;
import org.openmetadata.schema.entity.app.NativeAppPermission;
import org.openmetadata.schema.entity.app.ScheduleTimeline;
import org.openmetadata.schema.entity.app.ScheduleType;
import org.openmetadata.schema.entity.app.ScheduledExecutionContext;
import org.openmetadata.schema.entity.data.DataContract;
import org.openmetadata.schema.entity.data.Database;
import org.openmetadata.schema.entity.data.DatabaseSchema;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.datacontract.DataContractResult;
import org.openmetadata.schema.entity.services.ingestionPipelines.AirflowConfig;
import org.openmetadata.schema.entity.services.ingestionPipelines.IngestionPipeline;
import org.openmetadata.schema.entity.services.ingestionPipelines.PipelineStatus;
import org.openmetadata.schema.entity.services.ingestionPipelines.PipelineStatusType;
import org.openmetadata.schema.entity.services.ingestionPipelines.PipelineType;
import org.openmetadata.schema.metadataIngestion.DatabaseServiceMetadataPipeline;
import org.openmetadata.schema.metadataIngestion.SourceConfig;
import org.openmetadata.schema.tests.TestCase;
import org.openmetadata.schema.tests.TestCaseParameterValue;
import org.openmetadata.schema.tests.TestSuite;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.ColumnDataType;
import org.openmetadata.schema.type.ContractExecutionStatus;
import org.openmetadata.schema.type.EntityStatus;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.exceptions.ApiException;
import org.openmetadata.sdk.exceptions.OpenMetadataException;
import org.openmetadata.sdk.network.HttpMethod;
import org.openmetadata.sdk.network.RequestOptions;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.DataContractRepository;
import org.openmetadata.service.jdbi3.IngestionPipelineRepository;
import org.openmetadata.service.util.FullyQualifiedName;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * Regression tests for issue #27040 — a <b>soft</b> delete of an IngestionPipeline, DataContract or
 * App physically deleted the entity's time series rows, so the subsequent restore brought the
 * entity back with its whole run/result history gone.
 *
 * <p>Time series survival can only be asserted at the row level: a soft-deleted entity's statuses
 * are not readable through the API anyway, so an API-only check passes even when the rows have
 * already been destroyed. Each test therefore counts rows directly (mirroring {@code
 * StaleIncidentStatusIT#softDeleteLeavesRowAndRelationshipIntact}) and then re-reads the history
 * through the public API after the restore.
 *
 * <p>Hard delete keeps destroying the same rows — the paired {@code hardDelete...} tests pin that
 * down so the fix cannot regress into leaking orphaned time series.
 */
@Execution(ExecutionMode.CONCURRENT)
@ExtendWith(TestNamespaceExtension.class)
public class SoftDeleteRetentionIT {

  private static final Logger LOG = LoggerFactory.getLogger(SoftDeleteRetentionIT.class);

  private static final String ENTITY_EXTENSION_TIME_SERIES = "entity_extension_time_series";
  private static final String APPS_EXTENSION_TIME_SERIES = "apps_extension_time_series";
  private static final String TEST_APP_CLASS = "org.openmetadata.service.resources.apps.TestApp";
  private static final String INGESTION_PIPELINES_PATH = "/v1/services/ingestionPipelines/";
  private static final String APPS_PATH = "/v1/apps/";
  private static final String MARKETPLACE_PATH = "/v1/apps/marketplace";
  private static final String HARD_DELETE_PARAM = "hardDelete";
  private static final Map<String, String> HARD_DELETE = Map.of(HARD_DELETE_PARAM, "true");
  private static final Map<String, String> RECURSIVE_HARD_DELETE =
      Map.of(HARD_DELETE_PARAM, "true", "recursive", "true");
  private static final int NOT_FOUND = 404;

  /**
   * Teardown for everything a test created, newest first. Registered at creation time rather than
   * run at the end of each test so that an assertion failing mid-test still cleans up: these suites
   * share one cluster and {@code NamespaceCleanup} has no mapping for ingestionPipeline, database or
   * application, so a leaked fixture would sit there for every later test to trip over.
   */
  private final List<Runnable> fixtureCleanups = new ArrayList<>();

  @AfterEach
  void removeFixtures() {
    for (Runnable cleanup : fixtureCleanups.reversed()) {
      try {
        cleanup.run();
      } catch (OpenMetadataException alreadyGone) {
        LOG.debug("Fixture already removed by the test itself: {}", alreadyGone.getMessage());
      }
    }
    fixtureCleanups.clear();
  }

  // ===================================================================
  // IngestionPipeline — entity_extension_time_series / pipelineStatus
  // ===================================================================

  @Test
  void ingestionPipelineSoftDeleteKeepsPipelineStatuses(TestNamespace ns) {
    IngestionPipeline pipeline = createPipeline(ns);
    String runId = addPipelineStatus(pipeline);

    SdkClients.adminClient().ingestionPipelines().delete(pipeline.getId().toString());

    assertEquals(
        1,
        countExtensionRows(
            pipeline.getFullyQualifiedName(),
            IngestionPipelineRepository.PIPELINE_STATUS_EXTENSION),
        "soft delete must not destroy pipeline statuses — restore has to be able to recover them");

    SdkClients.adminClient().ingestionPipelines().restore(pipeline.getId().toString());

    PipelineStatus restored = getPipelineStatus(pipeline, runId);
    assertEquals(runId, restored.getRunId(), "restored pipeline must still expose its run history");
  }

  @Test
  void ingestionPipelineHardDeleteRemovesPipelineStatuses(TestNamespace ns) {
    IngestionPipeline pipeline = createPipeline(ns);
    addPipelineStatus(pipeline);

    hardDeletePipeline(pipeline);

    assertEquals(
        0,
        countExtensionRows(
            pipeline.getFullyQualifiedName(),
            IngestionPipelineRepository.PIPELINE_STATUS_EXTENSION),
        "hard delete must still purge pipeline statuses");
  }

  // ===================================================================
  // DataContract — entity_extension_time_series / dataContractResult
  // ===================================================================

  @Test
  void dataContractSoftDeleteKeepsResults(TestNamespace ns) {
    DataContract contract = createContract(ns, "dc_soft");
    addContractResult(contract);
    String contractId = contract.getId().toString();

    SdkClients.adminClient().dataContracts().delete(contractId);

    assertEquals(
        1,
        countExtensionRows(
            contract.getFullyQualifiedName(), DataContractRepository.RESULT_EXTENSION),
        "soft delete must not destroy data contract results");

    SdkClients.adminClient().dataContracts().restore(contractId);

    DataContractResult latest =
        SdkClients.adminClient().dataContracts().getLatestResult(contract.getId());
    assertNotNull(latest, "restored contract must still expose its validation history");
  }

  @Test
  void dataContractHardDeleteRemovesResults(TestNamespace ns) {
    DataContract contract = createContract(ns, "dc_hard");
    addContractResult(contract);

    hardDeleteContract(contract);

    assertEquals(
        0,
        countExtensionRows(
            contract.getFullyQualifiedName(), DataContractRepository.RESULT_EXTENSION),
        "hard delete must still purge data contract results");
  }

  /**
   * The contract's logical test suite is linked as {@code testSuite CONTAINS dataContract}, so the
   * normal (from → to) cascade never reaches it and the repository has to drive it explicitly. It
   * used to be <b>hard</b>-deleted regardless of the delete mode, taking the DQ ingestion pipeline
   * (and its orchestrator DAG) with it, which a restore could not undo.
   */
  @Test
  void dataContractSoftDeleteKeepsTestSuiteAlive(TestNamespace ns) {
    DataContract contract = createContractWithQualityExpectations(ns);
    UUID testSuiteId = contract.getTestSuite().getId();
    String contractId = contract.getId().toString();

    SdkClients.adminClient().dataContracts().delete(contractId);

    TestSuite suite = getTestSuiteIncludeDeleted(testSuiteId);
    assertFalse(
        Boolean.TRUE.equals(suite.getDeleted()),
        "a reversible contract delete must leave its logical test suite intact to come back to");

    SdkClients.adminClient().dataContracts().restore(contractId);

    DataContract restored = SdkClients.adminClient().dataContracts().get(contractId);
    assertNotNull(restored.getTestSuite(), "restored contract must still reference its test suite");
    assertEquals(
        testSuiteId,
        restored.getTestSuite().getId(),
        "restored contract must reference the very same test suite");
  }

  @Test
  void dataContractHardDeleteRemovesTestSuite(TestNamespace ns) {
    DataContract contract = createContractWithQualityExpectations(ns);
    UUID testSuiteId = contract.getTestSuite().getId();

    hardDeleteContract(contract);

    ApiException notFound =
        assertThrows(
            ApiException.class,
            () -> getTestSuiteIncludeDeleted(testSuiteId),
            "hard delete must still take the contract's logical test suite with it");
    assertEquals(
        NOT_FOUND,
        notFound.getStatusCode(),
        "the suite must be gone, not merely unreadable — got: " + notFound.getMessage());
  }

  // ===================================================================
  // App — apps_extension_time_series / status
  // ===================================================================

  @Test
  void appSoftDeleteKeepsRunRecords(TestNamespace ns) {
    App app = installTestApp(ns, "softDelApp");
    addAppRunRecord(app);

    deleteApp(app, false);

    assertEquals(
        1, countAppStatusRows(app.getId()), "soft delete must not destroy application run records");

    restoreApp(app);

    AppRunRecord latest = getLatestAppRun(app);
    assertNotNull(latest, "restored app must still expose its run history");
  }

  @Test
  void appHardDeleteRemovesRunRecords(TestNamespace ns) {
    App app = installTestApp(ns, "hardDelApp");
    addAppRunRecord(app);

    deleteApp(app, true);

    assertEquals(
        0, countAppStatusRows(app.getId()), "hard delete must still purge application run records");
  }

  // ===================================================================
  // Row-level assertions
  // ===================================================================

  private int countExtensionRows(String entityFqn, String extension) {
    String entityFqnHash = FullyQualifiedName.buildHash(entityFqn);
    return TestSuiteBootstrap.getJdbi()
        .withHandle(
            handle ->
                handle
                    .createQuery(
                        "SELECT COUNT(*) FROM "
                            + ENTITY_EXTENSION_TIME_SERIES
                            + " WHERE entityFQNHash = :entityFqnHash AND extension = :extension")
                    .bind("entityFqnHash", entityFqnHash)
                    .bind("extension", extension)
                    .mapTo(Integer.class)
                    .one());
  }

  private int countAppStatusRows(UUID appId) {
    return TestSuiteBootstrap.getJdbi()
        .withHandle(
            handle ->
                handle
                    .createQuery(
                        "SELECT COUNT(*) FROM "
                            + APPS_EXTENSION_TIME_SERIES
                            + " WHERE appId = :appId AND extension = :extension")
                    .bind("appId", appId.toString())
                    .bind("extension", AppExtension.ExtensionType.STATUS.toString())
                    .mapTo(Integer.class)
                    .one());
  }

  // ===================================================================
  // IngestionPipeline fixtures
  // ===================================================================

  private IngestionPipeline createPipeline(TestNamespace ns) {
    CreateIngestionPipeline request =
        new CreateIngestionPipeline()
            .withName(ns.prefix("retention"))
            .withPipelineType(PipelineType.METADATA)
            .withService(SharedEntities.get().MYSQL_SERVICE.getEntityReference())
            .withSourceConfig(
                new SourceConfig()
                    .withConfig(new DatabaseServiceMetadataPipeline().withMarkDeletedTables(true)))
            .withAirflowConfig(new AirflowConfig());
    IngestionPipeline pipeline = SdkClients.adminClient().ingestionPipelines().create(request);
    fixtureCleanups.add(() -> hardDeletePipeline(pipeline));
    return pipeline;
  }

  private String addPipelineStatus(IngestionPipeline pipeline) {
    String runId = UUID.randomUUID().toString();
    PipelineStatus status =
        new PipelineStatus()
            .withPipelineState(PipelineStatusType.SUCCESS)
            .withRunId(runId)
            .withTimestamp(System.currentTimeMillis());
    SdkClients.adminClient()
        .getHttpClient()
        .execute(
            HttpMethod.PUT,
            INGESTION_PIPELINES_PATH + pipeline.getFullyQualifiedName() + "/pipelineStatus",
            status,
            PipelineStatus.class);
    return runId;
  }

  private PipelineStatus getPipelineStatus(IngestionPipeline pipeline, String runId) {
    return SdkClients.adminClient()
        .getHttpClient()
        .execute(
            HttpMethod.GET,
            INGESTION_PIPELINES_PATH
                + pipeline.getFullyQualifiedName()
                + "/pipelineStatus/"
                + runId,
            null,
            PipelineStatus.class);
  }

  private void hardDeletePipeline(IngestionPipeline pipeline) {
    SdkClients.adminClient().ingestionPipelines().delete(pipeline.getId().toString(), HARD_DELETE);
  }

  // ===================================================================
  // DataContract fixtures
  // ===================================================================

  private DataContract createContract(TestNamespace ns, String prefix) {
    Table table = createTable(ns, prefix);
    return SdkClients.adminClient()
        .dataContracts()
        .create(
            new CreateDataContract()
                .withName(ns.prefix(prefix))
                .withEntity(table.getEntityReference())
                .withDescription("Soft delete retention guard"));
  }

  private DataContract createContractWithQualityExpectations(TestNamespace ns) {
    Table table = createTable(ns, "dc_suite");
    TestCase testCase =
        SdkClients.adminClient()
            .testCases()
            .create(
                new CreateTestCase()
                    .withName(ns.prefix("dc_tc"))
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
                    .withName(ns.prefix("dc_suite"))
                    .withEntity(table.getEntityReference())
                    .withEntityStatus(EntityStatus.APPROVED)
                    .withQualityExpectations(List.of(testCase.getEntityReference()))
                    .withDescription("Test suite lifecycle guard"));
    assertNotNull(
        contract.getTestSuite(), "contract with qualityExpectations must own a logical test suite");
    return contract;
  }

  private void addContractResult(DataContract contract) {
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

  private void hardDeleteContract(DataContract contract) {
    SdkClients.adminClient().dataContracts().delete(contract.getId().toString(), HARD_DELETE);
  }

  private TestSuite getTestSuiteIncludeDeleted(UUID testSuiteId) {
    return SdkClients.adminClient()
        .getHttpClient()
        .execute(
            HttpMethod.GET,
            "/v1/dataQuality/testSuites/" + testSuiteId + "?include=all",
            null,
            TestSuite.class);
  }

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
    // The database cascade takes the schema, the table and the table's data contract with it.
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

  // ===================================================================
  // App fixtures
  // ===================================================================

  private App installTestApp(TestNamespace ns, String prefix) {
    String appName = ns.prefix(prefix);
    CreateAppMarketPlaceDefinitionReq definitionRequest =
        new CreateAppMarketPlaceDefinitionReq()
            .withName(appName)
            .withDisplayName(appName)
            .withDescription("App used to guard time series retention on soft delete")
            .withFeatures("retention guard")
            .withDeveloper("Test Developer")
            .withDeveloperUrl("https://www.example.com")
            .withPrivacyPolicyUrl("https://www.example.com/privacy")
            .withSupportEmail("support@example.com")
            .withClassName(TEST_APP_CLASS)
            .withAppType(AppType.Internal)
            .withScheduleType(ScheduleType.Scheduled)
            .withRuntime(new ScheduledExecutionContext().withEnabled(true))
            .withAppConfiguration(Map.of())
            .withPermission(NativeAppPermission.All);

    AppMarketPlaceDefinition definition =
        SdkClients.adminClient()
            .getHttpClient()
            .execute(
                HttpMethod.POST,
                MARKETPLACE_PATH,
                definitionRequest,
                AppMarketPlaceDefinition.class);
    fixtureCleanups.add(() -> hardDelete(MARKETPLACE_PATH + "/" + definition.getId()));

    CreateApp createApp =
        new CreateApp()
            .withName(definition.getName())
            .withAppConfiguration(definition.getAppConfiguration())
            .withAppSchedule(new AppSchedule().withScheduleTimeline(ScheduleTimeline.HOURLY));
    App app =
        SdkClients.adminClient()
            .getHttpClient()
            .execute(HttpMethod.POST, "/v1/apps", createApp, App.class);
    fixtureCleanups.add(() -> deleteApp(app, true));
    return app;
  }

  private void addAppRunRecord(App app) {
    AppRunRecord runRecord =
        new AppRunRecord()
            .withAppId(app.getId())
            .withAppName(app.getName())
            .withStatus(AppRunRecord.Status.SUCCESS)
            .withTimestamp(System.currentTimeMillis())
            .withStartTime(System.currentTimeMillis())
            .withExtension(AppExtension.ExtensionType.STATUS.toString());
    Entity.getCollectionDAO()
        .appExtensionTimeSeriesDao()
        .insert(JsonUtils.pojoToJson(runRecord), AppExtension.ExtensionType.STATUS.toString());
  }

  private void deleteApp(App app, boolean hardDelete) {
    SdkClients.adminClient()
        .getHttpClient()
        .executeForString(
            HttpMethod.DELETE,
            APPS_PATH + app.getId() + "?" + HARD_DELETE_PARAM + "=" + hardDelete,
            null,
            RequestOptions.builder().build());
  }

  private void hardDelete(String path) {
    SdkClients.adminClient()
        .getHttpClient()
        .executeForString(
            HttpMethod.DELETE,
            path + "?" + HARD_DELETE_PARAM + "=true",
            null,
            RequestOptions.builder().build());
  }

  private void restoreApp(App app) {
    SdkClients.adminClient()
        .getHttpClient()
        .executeForString(
            HttpMethod.PUT,
            APPS_PATH + "restore",
            "{\"id\": \"" + app.getId() + "\"}",
            RequestOptions.builder().build());
  }

  private AppRunRecord getLatestAppRun(App app) {
    return SdkClients.adminClient()
        .getHttpClient()
        .execute(
            HttpMethod.GET,
            APPS_PATH + "name/" + app.getName() + "/runs/latest",
            null,
            AppRunRecord.class);
  }
}

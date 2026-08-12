/*
 *  Copyright 2024 Collate
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

package org.openmetadata.service.governance.workflows;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertInstanceOf;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyBoolean;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.RETURNS_DEEP_STUBS;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockConstruction;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.zaxxer.hikari.HikariDataSource;
import java.lang.reflect.Field;
import java.lang.reflect.Method;
import java.util.ArrayList;
import java.util.List;
import javax.sql.DataSource;
import org.flowable.common.engine.api.FlowableWrongDbException;
import org.flowable.engine.ManagementService;
import org.flowable.engine.ProcessEngine;
import org.flowable.engine.ProcessEngineConfiguration;
import org.flowable.engine.ProcessEngines;
import org.flowable.engine.RepositoryService;
import org.flowable.engine.RuntimeService;
import org.flowable.engine.impl.cfg.StandaloneProcessEngineConfiguration;
import org.flowable.engine.repository.ProcessDefinition;
import org.flowable.engine.repository.ProcessDefinitionQuery;
import org.flowable.engine.runtime.ProcessInstanceQuery;
import org.flowable.job.api.Job;
import org.flowable.job.api.TimerJobQuery;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.MockedConstruction;
import org.mockito.MockedStatic;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.openmetadata.schema.configuration.WorkflowSettings;
import org.openmetadata.service.Entity;
import org.openmetadata.service.OpenMetadataApplicationConfig;
import org.openmetadata.service.clients.pipeline.PipelineServiceClientFactory;
import org.openmetadata.service.jdbi3.HikariCPDataSourceFactory;
import org.openmetadata.service.jdbi3.SystemRepository;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class WorkflowHandlerSchemaUpdateTest {

  @BeforeEach
  @AfterEach
  void resetWorkflowHandlerState() throws ReflectiveOperationException {
    setStaticField("initialized", false);
    setStaticField("instance", null);
  }

  @Test
  void runtimeModeWrapsFlowableWrongDbExceptionWithActionableMessage() {
    try (MockedConstruction<StandaloneProcessEngineConfiguration> engineMock =
            mockConstruction(
                StandaloneProcessEngineConfiguration.class,
                (mock, ctx) ->
                    when(mock.buildProcessEngine())
                        .thenThrow(new FlowableWrongDbException("7.2.0.2", "7.1.0.0")));
        MockedStatic<ProcessEngines> ignored = mockStatic(ProcessEngines.class);
        MockedStatic<Entity> entityMock = mockStatic(Entity.class);
        MockedStatic<PipelineServiceClientFactory> pscMock =
            mockStatic(PipelineServiceClientFactory.class)) {

      setupEntityMock(entityMock);
      pscMock
          .when(() -> PipelineServiceClientFactory.createPipelineServiceClient(any()))
          .thenReturn(null);

      IllegalStateException ex =
          assertThrows(
              IllegalStateException.class,
              () -> WorkflowHandler.initialize(buildMockConfig(), false));

      assertTrue(ex.getMessage().contains("openmetadata-ops.sh migrate"));
      assertInstanceOf(FlowableWrongDbException.class, ex.getCause());
    }
  }

  @Test
  void migrationModeDoesNotLoadPipelineServiceClient() {
    ProcessEngine mockEngine = mock(ProcessEngine.class, RETURNS_DEEP_STUBS);

    try (MockedConstruction<StandaloneProcessEngineConfiguration> ignored =
            mockConstruction(
                StandaloneProcessEngineConfiguration.class,
                (mock, ctx) -> {
                  when(mock.buildProcessEngine()).thenReturn(mockEngine);
                  stubWrapperGetters(mock);
                });
        MockedStatic<ProcessEngines> ignoredEngines = mockStatic(ProcessEngines.class);
        MockedStatic<Entity> entityMock = mockStatic(Entity.class);
        MockedStatic<PipelineServiceClientFactory> pscMock =
            mockStatic(PipelineServiceClientFactory.class)) {

      setupEntityMock(entityMock);
      pscMock
          .when(() -> PipelineServiceClientFactory.createPipelineServiceClient(any()))
          .thenThrow(new RuntimeException("pipeline client class not on classpath"));

      assertDoesNotThrow(() -> WorkflowHandler.initialize(buildMockConfig(), true));
      pscMock.verify(
          () -> PipelineServiceClientFactory.createPipelineServiceClient(any()),
          org.mockito.Mockito.never());
    }
  }

  @Test
  void migrationModeSetsDbSchemaUpdateTrue() {
    ProcessEngine mockEngine = mock(ProcessEngine.class, RETURNS_DEEP_STUBS);

    try (MockedConstruction<StandaloneProcessEngineConfiguration> engineMock =
            mockConstruction(
                StandaloneProcessEngineConfiguration.class,
                (mock, ctx) -> {
                  when(mock.buildProcessEngine()).thenReturn(mockEngine);
                  stubWrapperGetters(mock);
                });
        MockedStatic<ProcessEngines> ignored = mockStatic(ProcessEngines.class);
        MockedStatic<Entity> entityMock = mockStatic(Entity.class);
        MockedStatic<PipelineServiceClientFactory> pscMock =
            mockStatic(PipelineServiceClientFactory.class)) {

      setupEntityMock(entityMock);
      pscMock
          .when(() -> PipelineServiceClientFactory.createPipelineServiceClient(any()))
          .thenReturn(null);

      WorkflowHandler.initialize(buildMockConfig(), true);

      StandaloneProcessEngineConfiguration engineConfig = engineMock.constructed().getLast();
      verify(engineConfig)
          .setDatabaseSchemaUpdate(ProcessEngineConfiguration.DB_SCHEMA_UPDATE_TRUE);
    }
  }

  @Test
  void runtimeModeSetsDbSchemaUpdateFalse() {
    try (MockedConstruction<StandaloneProcessEngineConfiguration> engineMock =
            mockConstruction(
                StandaloneProcessEngineConfiguration.class,
                (mock, ctx) ->
                    when(mock.buildProcessEngine())
                        .thenThrow(new FlowableWrongDbException("7.2.0.2", "7.1.0.0")));
        MockedStatic<ProcessEngines> ignored = mockStatic(ProcessEngines.class);
        MockedStatic<Entity> entityMock = mockStatic(Entity.class);
        MockedStatic<PipelineServiceClientFactory> pscMock =
            mockStatic(PipelineServiceClientFactory.class)) {

      setupEntityMock(entityMock);
      pscMock
          .when(() -> PipelineServiceClientFactory.createPipelineServiceClient(any()))
          .thenReturn(null);

      assertThrows(
          IllegalStateException.class, () -> WorkflowHandler.initialize(buildMockConfig(), false));

      StandaloneProcessEngineConfiguration engineConfig = engineMock.constructed().getLast();
      verify(engineConfig)
          .setDatabaseSchemaUpdate(ProcessEngineConfiguration.DB_SCHEMA_UPDATE_FALSE);
    }
  }

  @Test
  void runtimeModeEnablesConnectionPoolHealthChecks() {
    try (MockedConstruction<StandaloneProcessEngineConfiguration> engineMock =
            mockConstruction(
                StandaloneProcessEngineConfiguration.class,
                (mock, ctx) ->
                    when(mock.buildProcessEngine())
                        .thenThrow(new FlowableWrongDbException("7.2.0.2", "7.1.0.0")));
        MockedStatic<ProcessEngines> ignored = mockStatic(ProcessEngines.class);
        MockedStatic<Entity> entityMock = mockStatic(Entity.class);
        MockedStatic<PipelineServiceClientFactory> pscMock =
            mockStatic(PipelineServiceClientFactory.class)) {

      setupEntityMock(entityMock);
      pscMock
          .when(() -> PipelineServiceClientFactory.createPipelineServiceClient(any()))
          .thenReturn(null);

      assertThrows(
          IllegalStateException.class, () -> WorkflowHandler.initialize(buildMockConfig(), false));

      StandaloneProcessEngineConfiguration engineConfig = engineMock.constructed().getLast();
      verify(engineConfig).setJdbcPingEnabled(true);
      verify(engineConfig).setJdbcPingQuery("SELECT 1");
      verify(engineConfig).setJdbcPingConnectionNotUsedFor(30000);
    }
  }

  @Test
  void migrationModeDoesNotEnableConnectionPoolPing() {
    ProcessEngine mockEngine = mock(ProcessEngine.class, RETURNS_DEEP_STUBS);

    try (MockedConstruction<StandaloneProcessEngineConfiguration> engineMock =
            mockConstruction(
                StandaloneProcessEngineConfiguration.class,
                (mock, ctx) -> {
                  when(mock.buildProcessEngine()).thenReturn(mockEngine);
                  stubWrapperGetters(mock);
                });
        MockedStatic<ProcessEngines> ignored = mockStatic(ProcessEngines.class);
        MockedStatic<Entity> entityMock = mockStatic(Entity.class);
        MockedStatic<PipelineServiceClientFactory> pscMock =
            mockStatic(PipelineServiceClientFactory.class)) {

      setupEntityMock(entityMock);
      pscMock
          .when(() -> PipelineServiceClientFactory.createPipelineServiceClient(any()))
          .thenReturn(null);

      WorkflowHandler.initialize(buildMockConfig(), true);

      StandaloneProcessEngineConfiguration engineConfig = engineMock.constructed().getLast();
      verify(engineConfig, never()).setJdbcPingEnabled(anyBoolean());
    }
  }

  @Test
  void migrationModeUsesPooledDataSourceWrappedInIdempotentDdl() throws Exception {
    ProcessEngine mockEngine = mock(ProcessEngine.class, RETURNS_DEEP_STUBS);

    try (MockedConstruction<StandaloneProcessEngineConfiguration> engineMock =
            mockConstruction(
                StandaloneProcessEngineConfiguration.class,
                (mock, ctx) -> {
                  when(mock.buildProcessEngine()).thenReturn(mockEngine);
                  stubWrapperGetters(mock);
                });
        MockedStatic<ProcessEngines> ignored = mockStatic(ProcessEngines.class);
        MockedStatic<Entity> entityMock = mockStatic(Entity.class);
        MockedStatic<PipelineServiceClientFactory> pscMock =
            mockStatic(PipelineServiceClientFactory.class)) {

      setupEntityMock(entityMock);
      pscMock
          .when(() -> PipelineServiceClientFactory.createPipelineServiceClient(any()))
          .thenReturn(null);

      WorkflowHandler.initialize(buildMockConfig(), true);

      StandaloneProcessEngineConfiguration migrationEngineConfig =
          engineMock.constructed().getLast();
      ArgumentCaptor<DataSource> dsCaptor = ArgumentCaptor.forClass(DataSource.class);
      verify(migrationEngineConfig).setDataSource(dsCaptor.capture());
      DataSource injected = dsCaptor.getValue();
      assertInstanceOf(IdempotentDdlDataSource.class, injected);

      Field delegateField = IdempotentDdlDataSource.class.getDeclaredField("delegate");
      delegateField.setAccessible(true);
      Object delegate = delegateField.get(injected);
      assertInstanceOf(
          HikariDataSource.class,
          delegate,
          "IdempotentDdlDataSource must wrap a pooled HikariDataSource, not a raw "
              + "DriverManager-per-call DataSource");

      HikariDataSource pool = (HikariDataSource) delegate;
      assertEquals(10, pool.getMaximumPoolSize(), "migration pool must be bounded");
      assertEquals("flowable-migration-pool", pool.getPoolName());
      assertEquals(30_000L, pool.getConnectionTimeout());
    }
  }

  @Test
  void migrationModeDoesNotSetRawJdbcSettingsOnRuntimeEngine() {
    ProcessEngine mockEngine = mock(ProcessEngine.class, RETURNS_DEEP_STUBS);

    try (MockedConstruction<StandaloneProcessEngineConfiguration> engineMock =
            mockConstruction(
                StandaloneProcessEngineConfiguration.class,
                (mock, ctx) -> {
                  when(mock.buildProcessEngine()).thenReturn(mockEngine);
                  stubWrapperGetters(mock);
                });
        MockedStatic<ProcessEngines> ignored = mockStatic(ProcessEngines.class);
        MockedStatic<Entity> entityMock = mockStatic(Entity.class);
        MockedStatic<PipelineServiceClientFactory> pscMock =
            mockStatic(PipelineServiceClientFactory.class)) {

      setupEntityMock(entityMock);
      pscMock
          .when(() -> PipelineServiceClientFactory.createPipelineServiceClient(any()))
          .thenReturn(null);

      WorkflowHandler.initialize(buildMockConfig(), true);

      // Migration engine (last constructed) must reach the DB via setDataSource only, never
      // via raw JDBC settings — those would bypass the pool.
      StandaloneProcessEngineConfiguration migrationEngineConfig =
          engineMock.constructed().getLast();
      verify(migrationEngineConfig, never()).setJdbcUrl(anyString());
      verify(migrationEngineConfig, never()).setJdbcUsername(anyString());
      verify(migrationEngineConfig, never()).setJdbcPassword(anyString());
      verify(migrationEngineConfig, never()).setJdbcDriver(anyString());
    }
  }

  @Test
  void migrationPoolHonoursYamlConnectionTimeout() throws Exception {
    ProcessEngine mockEngine = mock(ProcessEngine.class, RETURNS_DEEP_STUBS);
    long yamlValue = 45_000L;

    try (MockedConstruction<StandaloneProcessEngineConfiguration> engineMock =
            mockConstruction(
                StandaloneProcessEngineConfiguration.class,
                (mock, ctx) -> {
                  when(mock.buildProcessEngine()).thenReturn(mockEngine);
                  stubWrapperGetters(mock);
                });
        MockedStatic<ProcessEngines> ignored = mockStatic(ProcessEngines.class);
        MockedStatic<Entity> entityMock = mockStatic(Entity.class);
        MockedStatic<PipelineServiceClientFactory> pscMock =
            mockStatic(PipelineServiceClientFactory.class)) {

      setupEntityMock(entityMock);
      pscMock
          .when(() -> PipelineServiceClientFactory.createPipelineServiceClient(any()))
          .thenReturn(null);

      // Yaml sets DB_CONNECTION_TIMEOUT to 45s — migration pool must inherit that value
      // rather than the hardcoded fallback, so ops tuning applies uniformly.
      WorkflowHandler.initialize(buildMockConfig(yamlValue), true);

      StandaloneProcessEngineConfiguration migrationEngineConfig =
          engineMock.constructed().getLast();
      ArgumentCaptor<DataSource> dsCaptor = ArgumentCaptor.forClass(DataSource.class);
      verify(migrationEngineConfig).setDataSource(dsCaptor.capture());
      Field delegateField = IdempotentDdlDataSource.class.getDeclaredField("delegate");
      delegateField.setAccessible(true);
      HikariDataSource pool = (HikariDataSource) delegateField.get(dsCaptor.getValue());
      assertEquals(yamlValue, pool.getConnectionTimeout());
    }
  }

  @Test
  void migrationModeClosesPoolIfBuildProcessEngineFails() {
    try (MockedConstruction<StandaloneProcessEngineConfiguration> ignoredEngine =
            mockConstruction(
                StandaloneProcessEngineConfiguration.class,
                (mock, ctx) -> {
                  when(mock.buildProcessEngine())
                      .thenThrow(new FlowableWrongDbException("7.2.0.2", "7.1.0.0"));
                  stubWrapperGetters(mock);
                });
        MockedStatic<ProcessEngines> ignored = mockStatic(ProcessEngines.class);
        MockedStatic<Entity> entityMock = mockStatic(Entity.class);
        MockedStatic<PipelineServiceClientFactory> pscMock =
            mockStatic(PipelineServiceClientFactory.class);
        MockedConstruction<HikariDataSource> hikariMock =
            mockConstruction(HikariDataSource.class)) {

      setupEntityMock(entityMock);
      pscMock
          .when(() -> PipelineServiceClientFactory.createPipelineServiceClient(any()))
          .thenReturn(null);

      // Migration path builds the Hikari pool BEFORE buildProcessEngine(). When the build fails
      // (Flowable schema-version mismatch here), the pool would otherwise leak Hikari
      // housekeeping threads + already-opened physical connections for the life of the JVM.
      assertThrows(
          IllegalStateException.class, () -> WorkflowHandler.initialize(buildMockConfig(), true));

      assertEquals(
          1,
          hikariMock.constructed().size(),
          "migration path must have constructed exactly one HikariDataSource before failing");
      HikariDataSource pool = hikariMock.constructed().getLast();
      verify(pool).close();
    }
  }

  @Test
  void runtimeModeDoesNotBuildMigrationPool() {
    try (MockedConstruction<StandaloneProcessEngineConfiguration> engineMock =
            mockConstruction(
                StandaloneProcessEngineConfiguration.class,
                (mock, ctx) ->
                    when(mock.buildProcessEngine())
                        .thenThrow(new FlowableWrongDbException("7.2.0.2", "7.1.0.0")));
        MockedStatic<ProcessEngines> ignored = mockStatic(ProcessEngines.class);
        MockedStatic<Entity> entityMock = mockStatic(Entity.class);
        MockedStatic<PipelineServiceClientFactory> pscMock =
            mockStatic(PipelineServiceClientFactory.class);
        MockedConstruction<HikariDataSource> hikariMock =
            mockConstruction(HikariDataSource.class)) {

      setupEntityMock(entityMock);
      pscMock
          .when(() -> PipelineServiceClientFactory.createPipelineServiceClient(any()))
          .thenReturn(null);

      assertThrows(
          IllegalStateException.class, () -> WorkflowHandler.initialize(buildMockConfig(), false));

      // Runtime path must configure the engine with raw JDBC settings + Flowable's own pool;
      // it must NOT stand up a migration HikariDataSource.
      assertTrue(
          hikariMock.constructed().isEmpty(),
          "Runtime mode must not construct a migration HikariDataSource");
      StandaloneProcessEngineConfiguration runtimeEngineConfig = engineMock.constructed().getLast();
      verify(runtimeEngineConfig, never()).setDataSource(any());
      // Wrapper's getJdbcUrl returns Mockito's default null; only assert the setter was invoked
      // via the raw-JDBC branch (not that the string is non-null).
      verify(runtimeEngineConfig).setJdbcUrl(any());
    }
  }

  @Test
  void deployCancelsEntitySpecificPeriodicTimerJobs() {
    ProcessEngine mockEngine = mock(ProcessEngine.class, RETURNS_DEEP_STUBS);
    RepositoryService repositoryService = mock(RepositoryService.class, RETURNS_DEEP_STUBS);
    ManagementService managementService = mock(ManagementService.class);
    TimerJobQuery exactTriggerQuery = mock(TimerJobQuery.class);
    TimerJobQuery allTimerJobsQuery = mock(TimerJobQuery.class);
    Job entitySpecificTimer = mock(Job.class);
    Workflow workflow = mock(Workflow.class, RETURNS_DEEP_STUBS);

    when(mockEngine.getRepositoryService()).thenReturn(repositoryService);
    when(mockEngine.getManagementService()).thenReturn(managementService);
    when(managementService.createTimerJobQuery())
        .thenReturn(exactTriggerQuery)
        .thenReturn(allTimerJobsQuery);
    when(exactTriggerQuery.processDefinitionKey("approvalTrigger")).thenReturn(exactTriggerQuery);
    when(exactTriggerQuery.list()).thenReturn(List.of());
    when(allTimerJobsQuery.list()).thenReturn(List.of(entitySpecificTimer));
    when(entitySpecificTimer.getProcessDefinitionId()).thenReturn("approvalTrigger-table:1:abc");
    when(workflow.getWorkflowDefinition().getName()).thenReturn("approval");
    when(workflow.getWorkflowDefinition().getTrigger().getType()).thenReturn("periodicBatchEntity");
    when(workflow.getTriggerWorkflow().getWorkflowName()).thenReturn("approvalTrigger");

    try (MockedConstruction<StandaloneProcessEngineConfiguration> ignored =
            mockConstruction(
                StandaloneProcessEngineConfiguration.class,
                (mock, ctx) -> {
                  when(mock.buildProcessEngine()).thenReturn(mockEngine);
                  stubWrapperGetters(mock);
                });
        MockedStatic<ProcessEngines> ignoredEngines = mockStatic(ProcessEngines.class);
        MockedStatic<Entity> entityMock = mockStatic(Entity.class);
        MockedStatic<PipelineServiceClientFactory> pscMock =
            mockStatic(PipelineServiceClientFactory.class)) {
      setupEntityMock(entityMock);
      pscMock
          .when(() -> PipelineServiceClientFactory.createPipelineServiceClient(any()))
          .thenReturn(null);

      WorkflowHandler.initialize(buildMockConfig(), true);
      WorkflowHandler.getInstance().deploy(workflow);

      verify(managementService).deleteJob(entitySpecificTimer.getId());
    }
  }

  @Test
  void deploymentCleanupSkipsPreservedDefinitionsBetweenPages() throws Exception {
    ProcessEngine mockEngine = mock(ProcessEngine.class, RETURNS_DEEP_STUBS);
    RepositoryService repositoryService = mock(RepositoryService.class);
    ManagementService managementService = mock(ManagementService.class, RETURNS_DEEP_STUBS);
    RuntimeService runtimeService = mock(RuntimeService.class);
    ProcessDefinitionQuery processDefinitionQuery = mock(ProcessDefinitionQuery.class);
    ProcessDefinition preservedDefinition = mock(ProcessDefinition.class);
    ProcessDefinition deletableDefinition = mock(ProcessDefinition.class);
    ProcessInstanceQuery preservedInstanceQuery = mock(ProcessInstanceQuery.class);
    ProcessInstanceQuery deletableInstanceQuery = mock(ProcessInstanceQuery.class);
    ProcessInstanceQuery postCleanupInstanceQuery = mock(ProcessInstanceQuery.class);
    List<Integer> requestedOffsets = new ArrayList<>();

    when(mockEngine.getRepositoryService()).thenReturn(repositoryService);
    when(mockEngine.getManagementService()).thenReturn(managementService);
    when(mockEngine.getRuntimeService()).thenReturn(runtimeService);
    when(repositoryService.createProcessDefinitionQuery()).thenReturn(processDefinitionQuery);
    when(processDefinitionQuery.processDefinitionKey("approval"))
        .thenReturn(processDefinitionQuery);
    when(processDefinitionQuery.orderByProcessDefinitionVersion())
        .thenReturn(processDefinitionQuery);
    when(processDefinitionQuery.asc()).thenReturn(processDefinitionQuery);
    when(processDefinitionQuery.listPage(any(Integer.class), any(Integer.class)))
        .thenAnswer(
            invocation -> {
              requestedOffsets.add(invocation.getArgument(0));
              return requestedOffsets.size() == 1
                  ? List.of(preservedDefinition, deletableDefinition)
                  : List.of();
            });
    when(preservedDefinition.getId()).thenReturn("preserved");
    when(deletableDefinition.getId()).thenReturn("deletable");
    when(deletableDefinition.getDeploymentId()).thenReturn("deployment");
    when(runtimeService.createProcessInstanceQuery())
        .thenReturn(preservedInstanceQuery, deletableInstanceQuery, postCleanupInstanceQuery);
    when(preservedInstanceQuery.processDefinitionId("preserved"))
        .thenReturn(preservedInstanceQuery);
    when(preservedInstanceQuery.list())
        .thenReturn(List.of(mock(org.flowable.engine.runtime.ProcessInstance.class)));
    when(deletableInstanceQuery.processDefinitionId("deletable"))
        .thenReturn(deletableInstanceQuery);
    when(deletableInstanceQuery.list()).thenReturn(List.of());
    when(postCleanupInstanceQuery.processDefinitionId("deletable"))
        .thenReturn(postCleanupInstanceQuery);
    when(postCleanupInstanceQuery.list()).thenReturn(List.of());

    try (MockedConstruction<StandaloneProcessEngineConfiguration> ignored =
            mockConstruction(
                StandaloneProcessEngineConfiguration.class,
                (mock, ctx) -> {
                  when(mock.buildProcessEngine()).thenReturn(mockEngine);
                  stubWrapperGetters(mock);
                });
        MockedStatic<ProcessEngines> ignoredEngines = mockStatic(ProcessEngines.class);
        MockedStatic<Entity> entityMock = mockStatic(Entity.class);
        MockedStatic<PipelineServiceClientFactory> pscMock =
            mockStatic(PipelineServiceClientFactory.class)) {
      setupEntityMock(entityMock);
      pscMock
          .when(() -> PipelineServiceClientFactory.createPipelineServiceClient(any()))
          .thenReturn(null);

      WorkflowHandler.initialize(buildMockConfig(), true);
      Method cleanupMethod =
          WorkflowHandler.class.getDeclaredMethod(
              "drainOldDeploymentsForKey",
              RepositoryService.class,
              ManagementService.class,
              String.class,
              boolean.class);
      cleanupMethod.setAccessible(true);
      cleanupMethod.invoke(
          WorkflowHandler.getInstance(), repositoryService, managementService, "approval", false);

      assertEquals(List.of(0, 1), requestedOffsets);
    }
  }

  // ── Helpers ──────────────────────────────────────────────────────────────────

  private void setupEntityMock(MockedStatic<Entity> entityMock) {
    SystemRepository systemRepository = mock(SystemRepository.class);
    WorkflowSettings workflowSettings = mock(WorkflowSettings.class, RETURNS_DEEP_STUBS);
    entityMock.when(Entity::getSystemRepository).thenReturn(systemRepository);
    lenient().when(systemRepository.getWorkflowSettingsOrDefault()).thenReturn(workflowSettings);
  }

  private OpenMetadataApplicationConfig buildMockConfig() {
    return buildMockConfig(null);
  }

  private OpenMetadataApplicationConfig buildMockConfig(Long connectionTimeoutMs) {
    OpenMetadataApplicationConfig config = mock(OpenMetadataApplicationConfig.class);
    HikariCPDataSourceFactory dsf = mock(HikariCPDataSourceFactory.class);
    lenient().when(config.getDataSourceFactory()).thenReturn(dsf);
    lenient().when(dsf.getUrl()).thenReturn("jdbc:postgresql://localhost:5432/openmetadata_db");
    lenient().when(dsf.getUser()).thenReturn("openmetadata_user");
    lenient().when(dsf.getPassword()).thenReturn("openmetadata_password");
    lenient().when(dsf.getDriverClass()).thenReturn("org.postgresql.Driver");
    lenient().when(dsf.getConnectionTimeout()).thenReturn(connectionTimeoutMs);
    lenient().when(config.getPipelineServiceClientConfiguration()).thenReturn(null);
    return config;
  }

  private static void setStaticField(String fieldName, Object value)
      throws ReflectiveOperationException {
    Field field = WorkflowHandler.class.getDeclaredField(fieldName);
    field.setAccessible(true);
    field.set(null, value);
  }

  // WorkflowHandler constructs two StandaloneProcessEngineConfiguration instances: the outer
  // wrapper in the constructor (with raw JDBC settings) and the inner engine in
  // initializeNewProcessEngine (which now reads getJdbcUrl/etc. off the wrapper to build a
  // HikariDataSource). Mockito mockConstruction returns default-value stubs, so we must
  // pre-stub the getters or HikariDataSource construction rejects the null jdbcUrl.
  private static void stubWrapperGetters(StandaloneProcessEngineConfiguration mock) {
    lenient()
        .when(mock.getJdbcUrl())
        .thenReturn("jdbc:postgresql://localhost:5432/openmetadata_db");
    lenient().when(mock.getJdbcUsername()).thenReturn("openmetadata_user");
    lenient().when(mock.getJdbcPassword()).thenReturn("openmetadata_password");
    lenient().when(mock.getJdbcDriver()).thenReturn("org.postgresql.Driver");
  }
}

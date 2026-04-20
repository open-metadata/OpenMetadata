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
import static org.junit.jupiter.api.Assertions.assertInstanceOf;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.RETURNS_DEEP_STUBS;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockConstruction;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.lang.reflect.Field;
import org.flowable.common.engine.api.FlowableWrongDbException;
import org.flowable.engine.ProcessEngine;
import org.flowable.engine.ProcessEngineConfiguration;
import org.flowable.engine.ProcessEngines;
import org.flowable.engine.impl.cfg.StandaloneProcessEngineConfiguration;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
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
                (mock, ctx) -> when(mock.buildProcessEngine()).thenReturn(mockEngine));
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
                (mock, ctx) -> when(mock.buildProcessEngine()).thenReturn(mockEngine));
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

  // ── Helpers ──────────────────────────────────────────────────────────────────

  private void setupEntityMock(MockedStatic<Entity> entityMock) {
    SystemRepository systemRepository = mock(SystemRepository.class);
    WorkflowSettings workflowSettings = mock(WorkflowSettings.class, RETURNS_DEEP_STUBS);
    entityMock.when(Entity::getSystemRepository).thenReturn(systemRepository);
    lenient().when(systemRepository.getWorkflowSettingsOrDefault()).thenReturn(workflowSettings);
  }

  private OpenMetadataApplicationConfig buildMockConfig() {
    OpenMetadataApplicationConfig config = mock(OpenMetadataApplicationConfig.class);
    HikariCPDataSourceFactory dsf = mock(HikariCPDataSourceFactory.class);
    lenient().when(config.getDataSourceFactory()).thenReturn(dsf);
    lenient().when(dsf.getUrl()).thenReturn("jdbc:postgresql://localhost:5432/openmetadata_db");
    lenient().when(dsf.getUser()).thenReturn("openmetadata_user");
    lenient().when(dsf.getPassword()).thenReturn("openmetadata_password");
    lenient().when(dsf.getDriverClass()).thenReturn("org.postgresql.Driver");
    lenient().when(config.getPipelineServiceClientConfiguration()).thenReturn(null);
    return config;
  }

  private static void setStaticField(String fieldName, Object value)
      throws ReflectiveOperationException {
    Field field = WorkflowHandler.class.getDeclaredField(fieldName);
    field.setAccessible(true);
    field.set(null, value);
  }
}

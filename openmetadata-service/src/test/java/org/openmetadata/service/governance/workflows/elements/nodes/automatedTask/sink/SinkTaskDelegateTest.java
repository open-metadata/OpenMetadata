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

package org.openmetadata.service.governance.workflows.elements.nodes.automatedTask.sink;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.openmetadata.service.governance.workflows.Workflow.ENTITY_LIST_VARIABLE;
import static org.openmetadata.service.governance.workflows.Workflow.GLOBAL_NAMESPACE;
import static org.openmetadata.service.governance.workflows.Workflow.RELATED_ENTITY_VARIABLE;

import java.lang.reflect.Field;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.flowable.common.engine.api.delegate.Expression;
import org.flowable.engine.delegate.BpmnError;
import org.flowable.engine.delegate.DelegateExecution;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.utils.JsonUtils;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class SinkTaskDelegateTest {

  private static final String TEST_SINK_TYPE = "testSink";

  @Mock private DelegateExecution execution;
  @Mock private Expression sinkTypeExpr;
  @Mock private Expression sinkConfigExpr;
  @Mock private Expression syncModeExpr;
  @Mock private Expression outputFormatExpr;
  @Mock private Expression hierarchyConfigExpr;
  @Mock private Expression entityFilterExpr;
  @Mock private Expression batchModeExpr;
  @Mock private Expression timeoutSecondsExpr;
  @Mock private Expression inputNamespaceMapExpr;

  private SinkTaskDelegate delegate;
  private TestSinkProvider testProvider;

  @BeforeEach
  void setUp() throws Exception {
    delegate = new SinkTaskDelegate();
    testProvider = new TestSinkProvider();

    // Register test provider
    SinkProviderRegistry.getInstance().register(TEST_SINK_TYPE, config -> testProvider);

    // Inject mocked expressions via reflection
    injectExpression(delegate, "sinkTypeExpr", sinkTypeExpr);
    injectExpression(delegate, "sinkConfigExpr", sinkConfigExpr);
    injectExpression(delegate, "syncModeExpr", syncModeExpr);
    injectExpression(delegate, "outputFormatExpr", outputFormatExpr);
    injectExpression(delegate, "hierarchyConfigExpr", hierarchyConfigExpr);
    injectExpression(delegate, "entityFilterExpr", entityFilterExpr);
    injectExpression(delegate, "batchModeExpr", batchModeExpr);
    injectExpression(delegate, "timeoutSecondsExpr", timeoutSecondsExpr);
    injectExpression(delegate, "inputNamespaceMapExpr", inputNamespaceMapExpr);

    // Setup common mock behaviors
    when(execution.getProcessDefinitionId()).thenReturn("process:1:test");
    when(execution.getProcessInstanceId()).thenReturn("exec-123");
    when(execution.getCurrentActivityId()).thenReturn("process.executeSink");
  }

  @AfterEach
  void tearDown() {
    SinkProviderRegistry.getInstance().unregister(TEST_SINK_TYPE);
  }

  @Test
  void testBatchMode_SkipsSubsequentIterations() {
    setupCommonExpressions(true);
    Map<String, String> namespaceMap = new HashMap<>();
    namespaceMap.put(ENTITY_LIST_VARIABLE, GLOBAL_NAMESPACE);
    namespaceMap.put(RELATED_ENTITY_VARIABLE, GLOBAL_NAMESPACE);
    when(inputNamespaceMapExpr.getValue(execution)).thenReturn(JsonUtils.pojoToJson(namespaceMap));

    // Setup: entityList present AND batchSinkProcessed = true
    List<String> entityList = List.of("<#E::table::test.fqn>");
    setupVariableAccess(entityList, true);

    delegate.execute(execution);

    // Verify: Neither write() nor writeBatch() called
    assertEquals(0, testProvider.getWriteCallCount());
    assertEquals(0, testProvider.getBatchWriteCallCount());

    // Verify: Success variables set (namespace separator is underscore)
    verify(execution).setVariable(eq("process_result"), eq("success"));
    verify(execution).setVariable(eq("process_syncedCount"), eq(0));
    verify(execution).setVariable(eq("process_failedCount"), eq(0));
  }

  @Test
  void testBatchMode_NotSkippedOnFirstIteration() {
    // This test verifies that when batchSinkProcessed=false, the batch is NOT skipped
    // It should proceed to processing (unlike when batchSinkProcessed=true which skips)
    setupCommonExpressions(true);
    Map<String, String> namespaceMap = new HashMap<>();
    namespaceMap.put(ENTITY_LIST_VARIABLE, GLOBAL_NAMESPACE);
    namespaceMap.put(RELATED_ENTITY_VARIABLE, GLOBAL_NAMESPACE);
    when(inputNamespaceMapExpr.getValue(execution)).thenReturn(JsonUtils.pojoToJson(namespaceMap));

    // Setup: entityList present, batchSinkProcessed = false (first iteration)
    List<String> entityList = List.of("<#E::table::test.fqn>");
    setupVariableAccess(entityList, false);

    // Execute - the delegate will try to process but Entity.getEntity will fail
    // gracefully (errors are recorded, not thrown)
    delegate.execute(execution);

    // Verify: Neither write() nor writeBatch() called (entity fetch failed first)
    // because Entity.getEntity is static and can't be mocked - entities list is empty
    assertEquals(0, testProvider.getWriteCallCount());
    assertEquals(0, testProvider.getBatchWriteCallCount());

    // Verify: Result variables were set (this proves we completed the delegate execution)
    // When all entity fetches fail, failedCount should be 1 (one entity failed to fetch)
    verify(execution).setVariable(eq("process_failedCount"), eq(1));
  }

  @Test
  void testSingleEntityMode_WhenNoEntityList() {
    setupCommonExpressions(false);
    Map<String, String> namespaceMap = new HashMap<>();
    namespaceMap.put(RELATED_ENTITY_VARIABLE, GLOBAL_NAMESPACE);
    when(inputNamespaceMapExpr.getValue(execution)).thenReturn(JsonUtils.pojoToJson(namespaceMap));

    // Setup: No entityList (event-based workflow)
    setupVariableAccess(null, false);
    when(execution.getVariable("global_relatedEntity")).thenReturn("<#E::table::test.fqn>");

    // This will throw because Entity.getEntity is static
    assertThrows(Exception.class, () -> delegate.execute(execution));
  }

  @Test
  void testSingleEntityMode_FallsBackWhenProviderDoesNotSupportBatch() {
    // Register a provider that doesn't support batch
    SinkProviderRegistry.getInstance().unregister(TEST_SINK_TYPE);
    TestSinkProvider noBatchProvider =
        new TestSinkProvider() {
          @Override
          public boolean supportsBatch() {
            return false;
          }
        };
    SinkProviderRegistry.getInstance().register(TEST_SINK_TYPE, config -> noBatchProvider);

    setupCommonExpressions(true); // batchMode=true but provider doesn't support it
    Map<String, String> namespaceMap = new HashMap<>();
    namespaceMap.put(ENTITY_LIST_VARIABLE, GLOBAL_NAMESPACE);
    namespaceMap.put(RELATED_ENTITY_VARIABLE, GLOBAL_NAMESPACE);
    when(inputNamespaceMapExpr.getValue(execution)).thenReturn(JsonUtils.pojoToJson(namespaceMap));

    List<String> entityList = List.of("<#E::table::test.fqn>");
    setupVariableAccess(entityList, false);
    when(execution.getVariable("global_relatedEntity")).thenReturn("<#E::table::test.fqn>");

    // Will throw due to Entity.getEntity, but verifies the code path selection
    assertThrows(Exception.class, () -> delegate.execute(execution));
  }

  @Test
  void testUnregisteredSinkType_ThrowsError() {
    when(sinkTypeExpr.getValue(execution)).thenReturn("unknownSink");
    when(sinkConfigExpr.getValue(execution)).thenReturn("{}");
    when(syncModeExpr.getValue(execution)).thenReturn("overwrite");
    when(outputFormatExpr.getValue(execution)).thenReturn("yaml");
    when(hierarchyConfigExpr.getValue(execution)).thenReturn("{}");
    when(entityFilterExpr.getValue(execution)).thenReturn("{}");
    when(batchModeExpr.getValue(execution)).thenReturn("false");
    when(timeoutSecondsExpr.getValue(execution)).thenReturn("300");

    Map<String, String> namespaceMap = new HashMap<>();
    namespaceMap.put(RELATED_ENTITY_VARIABLE, GLOBAL_NAMESPACE);
    when(inputNamespaceMapExpr.getValue(execution)).thenReturn(JsonUtils.pojoToJson(namespaceMap));

    setupVariableAccess(null, false);

    BpmnError error = assertThrows(BpmnError.class, () -> delegate.execute(execution));
    assertNotNull(error);
    // BpmnError wraps the exception - check it was thrown for the right reason
    String errorMessage = error.getMessage() != null ? error.getMessage() : "";
    assertTrue(
        errorMessage.contains("No sink provider") || errorMessage.contains("unknownSink"),
        "Expected error about missing sink provider, got: " + errorMessage);
  }

  @Test
  void testSinkResult_SuccessMetrics() {
    SinkResult result =
        SinkResult.builder()
            .success(true)
            .syncedCount(5)
            .failedCount(0)
            .syncedEntities(List.of("entity1", "entity2", "entity3", "entity4", "entity5"))
            .build();

    assertTrue(result.isSuccess());
    assertEquals(5, result.getSyncedCount());
    assertEquals(0, result.getFailedCount());
    assertEquals(5, result.getSyncedEntities().size());
  }

  @Test
  void testSinkResult_PartialFailure() {
    SinkResult result =
        SinkResult.builder()
            .success(false)
            .syncedCount(3)
            .failedCount(2)
            .syncedEntities(List.of("entity1", "entity2", "entity3"))
            .errors(
                List.of(
                    SinkResult.SinkError.builder()
                        .entityFqn("entity4")
                        .errorMessage("Failed to sync")
                        .build(),
                    SinkResult.SinkError.builder()
                        .entityFqn("entity5")
                        .errorMessage("Network error")
                        .build()))
            .build();

    assertFalse(result.isSuccess());
    assertEquals(3, result.getSyncedCount());
    assertEquals(2, result.getFailedCount());
    assertNotNull(result.getErrors());
    assertEquals(2, result.getErrors().size());
  }

  @Test
  void testTestSinkProvider_WriteBatch() {
    TestSinkProvider provider = new TestSinkProvider();
    SinkContext context =
        SinkContext.builder()
            .sinkConfig(new HashMap<>())
            .syncMode("overwrite")
            .outputFormat("yaml")
            .batchMode(true)
            .workflowExecutionId("exec-123")
            .workflowName("TestWorkflow")
            .build();

    // Create mock entities
    EntityInterface entity1 = mock(EntityInterface.class);
    EntityInterface entity2 = mock(EntityInterface.class);
    when(entity1.getFullyQualifiedName()).thenReturn("test.entity1");
    when(entity2.getFullyQualifiedName()).thenReturn("test.entity2");

    List<EntityInterface> entities = List.of(entity1, entity2);

    SinkResult result = provider.writeBatch(context, entities);

    assertTrue(result.isSuccess());
    assertEquals(2, result.getSyncedCount());
    assertEquals(0, result.getFailedCount());
    assertEquals(1, provider.getBatchWriteCallCount());
    assertEquals(2, provider.getLastBatchEntities().size());
  }

  @Test
  void testTestSinkProvider_Write() {
    TestSinkProvider provider = new TestSinkProvider();
    SinkContext context =
        SinkContext.builder()
            .sinkConfig(new HashMap<>())
            .syncMode("overwrite")
            .outputFormat("yaml")
            .batchMode(false)
            .workflowExecutionId("exec-123")
            .workflowName("TestWorkflow")
            .build();

    EntityInterface entity = mock(EntityInterface.class);
    when(entity.getFullyQualifiedName()).thenReturn("test.entity");

    SinkResult result = provider.write(context, entity);

    assertTrue(result.isSuccess());
    assertEquals(1, result.getSyncedCount());
    assertEquals(1, provider.getWriteCallCount());
  }

  @Test
  void testTestSinkProvider_FailureMode() {
    TestSinkProvider provider = new TestSinkProvider();
    provider.setShouldFail(true);

    SinkContext context =
        SinkContext.builder()
            .sinkConfig(new HashMap<>())
            .syncMode("overwrite")
            .outputFormat("yaml")
            .batchMode(false)
            .build();

    EntityInterface entity = mock(EntityInterface.class);
    when(entity.getFullyQualifiedName()).thenReturn("test.entity");

    assertThrows(RuntimeException.class, () -> provider.write(context, entity));
  }

  private void setupCommonExpressions(boolean batchMode) {
    when(sinkTypeExpr.getValue(execution)).thenReturn(TEST_SINK_TYPE);
    when(sinkConfigExpr.getValue(execution)).thenReturn("{}");
    when(syncModeExpr.getValue(execution)).thenReturn("overwrite");
    when(outputFormatExpr.getValue(execution)).thenReturn("yaml");
    when(hierarchyConfigExpr.getValue(execution)).thenReturn("{}");
    when(entityFilterExpr.getValue(execution)).thenReturn("{}");
    when(batchModeExpr.getValue(execution)).thenReturn(String.valueOf(batchMode));
    when(timeoutSecondsExpr.getValue(execution)).thenReturn("300");
  }

  private void setupVariableAccess(List<String> entityList, boolean batchProcessed) {
    // Setup entity list access (namespace separator is underscore)
    when(execution.getVariable("global_entityList")).thenReturn(entityList);
    // Setup batch processed flag
    when(execution.getVariable("global_batchSinkProcessed")).thenReturn(batchProcessed);
  }

  private void injectExpression(Object target, String fieldName, Expression value)
      throws Exception {
    Field field = SinkTaskDelegate.class.getDeclaredField(fieldName);
    field.setAccessible(true);
    field.set(target, value);
  }

  static class TestSinkProvider implements SinkProvider {
    private final List<EntityInterface> writtenEntities = new ArrayList<>();
    private final List<List<EntityInterface>> batchWrites = new ArrayList<>();
    private boolean shouldFail = false;

    @Override
    public String getSinkType() {
      return TEST_SINK_TYPE;
    }

    @Override
    public SinkResult write(SinkContext context, EntityInterface entity) {
      if (shouldFail) {
        throw new RuntimeException("Simulated failure");
      }
      writtenEntities.add(entity);
      return SinkResult.builder()
          .success(true)
          .syncedCount(1)
          .syncedEntities(List.of(entity.getFullyQualifiedName()))
          .build();
    }

    @Override
    public SinkResult writeBatch(SinkContext context, List<EntityInterface> entities) {
      if (shouldFail) {
        throw new RuntimeException("Simulated failure");
      }
      batchWrites.add(new ArrayList<>(entities));
      List<String> fqns = entities.stream().map(EntityInterface::getFullyQualifiedName).toList();
      return SinkResult.builder()
          .success(true)
          .syncedCount(entities.size())
          .syncedEntities(fqns)
          .build();
    }

    @Override
    public boolean supportsBatch() {
      return true;
    }

    @Override
    public void close() {}

    public int getWriteCallCount() {
      return writtenEntities.size();
    }

    public int getBatchWriteCallCount() {
      return batchWrites.size();
    }

    public List<EntityInterface> getWrittenEntities() {
      return writtenEntities;
    }

    public List<EntityInterface> getLastBatchEntities() {
      return batchWrites.isEmpty() ? List.of() : batchWrites.get(batchWrites.size() - 1);
    }

    public void setShouldFail(boolean shouldFail) {
      this.shouldFail = shouldFail;
    }

    public void reset() {
      writtenEntities.clear();
      batchWrites.clear();
      shouldFail = false;
    }
  }
}

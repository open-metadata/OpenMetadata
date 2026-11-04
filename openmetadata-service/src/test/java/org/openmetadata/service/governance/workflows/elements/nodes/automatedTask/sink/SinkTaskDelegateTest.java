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
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.openmetadata.service.governance.workflows.Workflow.ENTITY_LIST_VARIABLE;
import static org.openmetadata.service.governance.workflows.Workflow.GLOBAL_NAMESPACE;
import static org.openmetadata.service.governance.workflows.Workflow.RELATED_ENTITY_VARIABLE;

import com.fasterxml.jackson.databind.JsonNode;
import java.lang.reflect.Field;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.function.Function;
import java.util.stream.IntStream;
import org.flowable.common.engine.api.delegate.Expression;
import org.flowable.engine.delegate.BpmnError;
import org.flowable.engine.delegate.DelegateExecution;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.fernet.Fernet;
import org.openmetadata.service.governance.workflows.SubWorkflowFailureListener;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class SinkTaskDelegateTest {

  private static final String TEST_SINK_TYPE = "testSink";
  private static final String FERNET_KEY = "jJ/9sz0g0OHxsfxOoSfdFdmk3ysNmPRnH3TUAbz3IHA=";

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
  @Mock private Expression failureHandledByBranchExpr;

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
  void testBatchMode_IgnoresLegacyBatchProcessedFlag() {
    setupCommonExpressions(true);
    Map<String, String> namespaceMap = new HashMap<>();
    namespaceMap.put(ENTITY_LIST_VARIABLE, GLOBAL_NAMESPACE);
    namespaceMap.put(RELATED_ENTITY_VARIABLE, GLOBAL_NAMESPACE);
    when(inputNamespaceMapExpr.getValue(execution)).thenReturn(JsonUtils.pojoToJson(namespaceMap));

    // Setup: entityList present AND batchSinkProcessed = true
    List<String> entityList = List.of("<#E::table::test.fqn>");
    setupVariableAccess(entityList, true);

    EntityInterface<?> batchEntity = mock(EntityInterface.class);
    when(batchEntity.getFullyQualifiedName()).thenReturn("test.fqn");

    delegate.entityLoader = link -> batchEntity;
    delegate.execute(execution);

    // Legacy batchSinkProcessed flag is ignored; batch execution is controlled by trigger config.
    assertEquals(0, testProvider.getWriteCallCount());
    assertEquals(1, testProvider.getBatchWriteCallCount());

    verify(execution).setVariable(eq("process_result"), eq("success"));
    verify(execution).setVariable(eq("process_syncedCount"), eq(1));
    verify(execution).setVariable(eq("process_failedCount"), eq(0));
  }

  @Test
  void testBatchMode_ProcessesFirstIteration() {
    setupCommonExpressions(true);
    Map<String, String> namespaceMap = new HashMap<>();
    namespaceMap.put(ENTITY_LIST_VARIABLE, GLOBAL_NAMESPACE);
    namespaceMap.put(RELATED_ENTITY_VARIABLE, GLOBAL_NAMESPACE);
    when(inputNamespaceMapExpr.getValue(execution)).thenReturn(JsonUtils.pojoToJson(namespaceMap));

    // Setup: entityList present, batchSinkProcessed = false (first iteration)
    List<String> entityList = List.of("<#E::table::test.fqn>");
    setupVariableAccess(entityList, false);

    EntityInterface<?> batchEntity = mock(EntityInterface.class);
    when(batchEntity.getFullyQualifiedName()).thenReturn("test.fqn");

    delegate.entityLoader = link -> batchEntity;
    delegate.execute(execution);

    assertEquals(0, testProvider.getWriteCallCount());
    assertEquals(1, testProvider.getBatchWriteCallCount());

    verify(execution).setVariable(eq("process_result"), eq("success"));
    verify(execution).setVariable(eq("process_syncedCount"), eq(1));
    verify(execution).setVariable(eq("process_failedCount"), eq(0));
  }

  /**
   * A condition upstream that matched no entity hands the sink an empty batch while {@code
   * global_relatedEntity} still names the batch's first entity, which that condition dropped.
   */
  @Test
  void emptiedBatchWritesNoEntity() {
    setupCommonExpressions(true);
    Map<String, String> namespaceMap = new HashMap<>();
    namespaceMap.put(ENTITY_LIST_VARIABLE, GLOBAL_NAMESPACE);
    namespaceMap.put(RELATED_ENTITY_VARIABLE, GLOBAL_NAMESPACE);
    when(inputNamespaceMapExpr.getValue(execution)).thenReturn(JsonUtils.pojoToJson(namespaceMap));
    setupVariableAccess(List.of(), false);
    when(execution.getVariable("global_relatedEntity")).thenReturn("<#E::table::dropped.fqn>");
    List<String> loaded = new ArrayList<>();
    delegate.entityLoader =
        link -> {
          loaded.add(link);
          return mock(EntityInterface.class);
        };

    delegate.execute(execution);

    assertEquals(List.of(), loaded);
    assertEquals(0, testProvider.getWriteCallCount());
    assertEquals(0, testProvider.getBatchWriteCallCount());
    verify(execution).setVariable(eq("process_result"), eq("success"));
    verify(execution).setVariable(eq("process_syncedCount"), eq(0));
    verify(execution).setVariable(eq("process_failedCount"), eq(0));
  }

  @Test
  void providerReceivesTheDecryptedSinkSecrets() {
    Fernet.getInstance().setFernetKey(FERNET_KEY);
    try {
      String token = "ghp_plaintextForTheProvider";
      List<Object> providerConfigs = new ArrayList<>();
      SinkProviderRegistry.getInstance()
          .register(
              TEST_SINK_TYPE,
              config -> {
                providerConfigs.add(config);
                return testProvider;
              });
      setupCommonExpressions(true);
      setupEncryptedSinkConfig(token);
      when(inputNamespaceMapExpr.getValue(execution))
          .thenReturn(JsonUtils.pojoToJson(Map.of(ENTITY_LIST_VARIABLE, GLOBAL_NAMESPACE)));
      setupVariableAccess(List.of("<#E::table::test.fqn>"), false);
      EntityInterface<?> batchEntity = mock(EntityInterface.class);
      when(batchEntity.getFullyQualifiedName()).thenReturn("test.fqn");
      delegate.entityLoader = link -> batchEntity;

      delegate.execute(execution);

      assertEquals(1, providerConfigs.size());
      assertEquals(
          token,
          JsonUtils.valueToTree(providerConfigs.getFirst()).at("/credentials/token").asText());
      assertEquals(1, testProvider.getBatchWriteCallCount());
    } finally {
      Fernet.getInstance().setFernetKey((String) null);
    }
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

  /**
   * A provider without batch support still gets every entity of the batch, through its
   * single-entity write, and never {@code global_relatedEntity}, which names an entity a condition
   * upstream may have dropped.
   */
  @Test
  void batchWithoutProviderBatchSupportWritesEveryEntityOneByOne() {
    TestSinkProvider single = singleEntityProvider(entity -> SinkResult.success("written"));
    when(execution.getVariable("global_relatedEntity")).thenReturn("<#E::table::dropped.fqn>");
    delegate.entityLoader = SinkTaskDelegateTest::namedEntity;

    runBatchWithLoader(single, 250);

    assertEquals(
        IntStream.range(0, 250).mapToObj("<#E::table::svc.db.sch.t%d>"::formatted).toList(),
        single.getWrittenEntities().stream().map(EntityInterface::getFullyQualifiedName).toList());
    assertEquals(0, single.getBatchWriteCallCount());
    verify(execution).setVariable(eq("process_syncedCount"), eq(250));
    verify(execution).setVariable(eq("process_failedCount"), eq(0));
    verify(execution).setVariable(eq("process_result"), eq("success"));
  }

  @Test
  void anEmptiedBatchWritesNoEntityWithoutProviderBatchSupport() {
    TestSinkProvider single = singleEntityProvider(entity -> SinkResult.success("written"));
    SinkProviderRegistry.getInstance().register(TEST_SINK_TYPE, config -> single);
    setupCommonExpressions(true);
    when(inputNamespaceMapExpr.getValue(execution))
        .thenReturn(
            JsonUtils.pojoToJson(
                Map.of(
                    ENTITY_LIST_VARIABLE, GLOBAL_NAMESPACE,
                    RELATED_ENTITY_VARIABLE, GLOBAL_NAMESPACE)));
    setupVariableAccess(List.of(), false);
    when(execution.getVariable("global_relatedEntity")).thenReturn("<#E::table::dropped.fqn>");

    delegate.execute(execution);

    assertEquals(0, single.getWriteCallCount());
    verify(execution).setVariable(eq("process_syncedCount"), eq(0));
    verify(execution).setVariable(eq("process_result"), eq("success"));
  }

  @Test
  void aStopRequestEndsAWriteOfSingleEntitiesAtTheNextSubBatch() {
    when(execution.getProcessInstanceBusinessKey()).thenReturn(UUID.randomUUID().toString());
    TestSinkProvider single = singleEntityProvider(entity -> SinkResult.success("written"));
    delegate.isStopRequested = businessKey -> single.getWriteCallCount() > 0;
    delegate.entityLoader = SinkTaskDelegateTest::namedEntity;

    runBatchWithLoader(single, 250);

    assertEquals(SinkProvider.DEFAULT_BATCH_SIZE, single.getWriteCallCount());
    verify(execution).setVariable(eq("process_syncedCount"), eq(100));
    verify(execution).setVariable(eq("process_failedCount"), eq(150));
    verify(execution).setVariable(eq("process_result"), eq("failure"));
  }

  /** Single-entity writes count per sub-batch, as a batch write does, not per entity. */
  @Test
  void consecutiveSubBatchesOfFailedSingleEntityWritesStopTheBatch() {
    TestSinkProvider single =
        singleEntityProvider(
            entity -> SinkResult.failure(entity.getFullyQualifiedName(), "endpoint down"));
    delegate.entityLoader = SinkTaskDelegateTest::namedEntity;

    runBatchWithLoader(single, 1000);

    assertEquals(
        SinkTaskDelegate.MAX_CONSECUTIVE_FAILED_SUB_BATCHES * SinkProvider.DEFAULT_BATCH_SIZE,
        single.getWriteCallCount());
    verify(execution).setVariable(eq("process_syncedCount"), eq(0));
    verify(execution).setVariable(eq("process_failedCount"), eq(1000));
    verify(execution).setVariable(eq("process_result"), eq("failure"));
  }

  @Test
  void skippedEntitiesAreCountedApartFromSyncedAndFailedOnes() {
    SinkProvider skippingOne =
        new TestSinkProvider() {
          @Override
          public SinkResult writeBatch(SinkContext context, List<EntityInterface<?>> entities) {
            return SinkResult.builder()
                .success(true)
                .syncedCount(entities.size() - 1)
                .skippedCount(1)
                .build();
          }

          @Override
          public SinkResult finishBatch(SinkContext context) {
            return SinkResult.builder().success(true).skippedCount(2).build();
          }
        };

    runBatch(skippingOne, 250, "300");

    verify(execution).setVariable(eq("process_syncedCount"), eq(247));
    verify(execution).setVariable(eq("process_failedCount"), eq(0));
    verify(execution).setVariable(eq("process_skippedCount"), eq(5));
    verify(execution).setVariable(eq("process_result"), eq("success"));
    ArgumentCaptor<Object> syncResult = ArgumentCaptor.forClass(Object.class);
    verify(execution).setVariable(eq("process_syncResult"), syncResult.capture());
    assertEquals(
        5, JsonUtils.readTree((String) syncResult.getValue()).path("skippedCount").asInt());
  }

  @Test
  void aSingleEntityWriteThatThrowsFailsOnlyItsEntity() {
    String failingFqn = "<#E::table::svc.db.sch.t7>";
    TestSinkProvider single =
        singleEntityProvider(
            entity -> {
              if (failingFqn.equals(entity.getFullyQualifiedName())) {
                throw new IllegalStateException("endpoint rejected the entity");
              }
              return SinkResult.success("written");
            });
    delegate.entityLoader = SinkTaskDelegateTest::namedEntity;

    runBatchWithLoader(single, 20);

    assertEquals(20, single.getWriteCallCount());
    verify(execution).setVariable(eq("process_syncedCount"), eq(19));
    verify(execution).setVariable(eq("process_failedCount"), eq(1));
    verify(execution).setVariable(eq("process_result"), eq("failure"));
    ArgumentCaptor<Object> syncResult = ArgumentCaptor.forClass(Object.class);
    verify(execution).setVariable(eq("process_syncResult"), syncResult.capture());
    assertTrue(
        ((String) syncResult.getValue()).contains("endpoint rejected the entity"),
        (String) syncResult.getValue());
  }

  @Test
  void entitiesSkippedBySingleEntityWritesAreCounted() {
    TestSinkProvider single =
        singleEntityProvider(entity -> SinkResult.builder().success(true).skippedCount(1).build());
    delegate.entityLoader = SinkTaskDelegateTest::namedEntity;

    runBatchWithLoader(single, 120);

    verify(execution).setVariable(eq("process_syncedCount"), eq(0));
    verify(execution).setVariable(eq("process_skippedCount"), eq(120));
    verify(execution).setVariable(eq("process_result"), eq("success"));
  }

  private static TestSinkProvider singleEntityProvider(
      Function<EntityInterface<?>, SinkResult> behavior) {
    return new TestSinkProvider() {
      @Override
      public SinkResult write(SinkContext context, EntityInterface<?> entity) {
        super.write(context, entity);
        return behavior.apply(entity);
      }

      @Override
      public boolean supportsBatch() {
        return false;
      }
    };
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
    EntityInterface<?> entity1 = mock(EntityInterface.class);
    EntityInterface<?> entity2 = mock(EntityInterface.class);
    when(entity1.getFullyQualifiedName()).thenReturn("test.entity1");
    when(entity2.getFullyQualifiedName()).thenReturn("test.entity2");

    List<EntityInterface<?>> entities = List.of(entity1, entity2);

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

    EntityInterface<?> entity = mock(EntityInterface.class);
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

    EntityInterface<?> entity = mock(EntityInterface.class);
    when(entity.getFullyQualifiedName()).thenReturn("test.entity");

    assertThrows(RuntimeException.class, () -> provider.write(context, entity));
  }

  @Test
  void failedBatchIsPersistedForTheTriggerProcess() {
    runBatch(scripted(entities -> failedWrite(entities)), 10, "300");

    verify(execution).setVariable("global_failure", true);
    verify(execution).setVariable(eq("process_result"), eq("failure"));
  }

  @Test
  void failureNotRoutedToABranchIsPersistedForTheTriggerProcess() throws Exception {
    injectExpression(delegate, "failureHandledByBranchExpr", failureHandledByBranchExpr);
    when(failureHandledByBranchExpr.getValue(execution)).thenReturn("false");

    runBatch(scripted(entities -> failedWrite(entities)), 10, "300");

    verify(execution).setVariable("global_failure", true);
  }

  @Test
  void failureRoutedToABranchIsNotPersistedAsAWorkflowFailure() throws Exception {
    injectExpression(delegate, "failureHandledByBranchExpr", failureHandledByBranchExpr);
    when(failureHandledByBranchExpr.getValue(execution)).thenReturn("true");

    runBatch(scripted(entities -> failedWrite(entities)), 10, "300");

    verify(execution, never()).setVariable(eq("global_failure"), any());
    verify(execution).setVariable(eq("process_result"), eq("failure"));
  }

  @Test
  void aSinkThatThrowsIsPersistedAsAFailureForTheTriggerProcess() {
    givenUnregisteredSinkType();

    assertThrows(BpmnError.class, () -> delegate.execute(execution));

    verify(execution).setVariable("global_failure", true);
    verify(execution).setVariable(eq("global_exception"), any());
  }

  @Test
  void aSinkThatThrowsWithAFailureBranchIsStillPersistedAsAFailure() throws Exception {
    injectExpression(delegate, "failureHandledByBranchExpr", failureHandledByBranchExpr);
    when(failureHandledByBranchExpr.getValue(execution)).thenReturn("true");
    givenUnregisteredSinkType();

    assertThrows(BpmnError.class, () -> delegate.execute(execution));

    ArgumentCaptor<Object> persistedFailure = ArgumentCaptor.forClass(Object.class);
    verify(execution).setVariable(eq("global_failure"), persistedFailure.capture());
    verify(execution).setVariable(eq("global_exception"), any());
    // The call activity copies global_failure into the trigger, whose end state reads `failure`.
    DelegateExecution trigger = mock(DelegateExecution.class);
    when(trigger.getVariable(SubWorkflowFailureListener.SUB_WORKFLOW_FAILURE_VARIABLE))
        .thenReturn(persistedFailure.getValue());
    new SubWorkflowFailureListener().execute(trigger);
    verify(trigger).setVariable("failure", true);
  }

  private void givenUnregisteredSinkType() {
    when(sinkTypeExpr.getValue(execution)).thenReturn("unknownSink");
    when(sinkConfigExpr.getValue(execution)).thenReturn("{}");
    when(syncModeExpr.getValue(execution)).thenReturn("overwrite");
    when(outputFormatExpr.getValue(execution)).thenReturn("yaml");
    when(hierarchyConfigExpr.getValue(execution)).thenReturn("{}");
    when(entityFilterExpr.getValue(execution)).thenReturn("{}");
    when(batchModeExpr.getValue(execution)).thenReturn("true");
    when(timeoutSecondsExpr.getValue(execution)).thenReturn("300");
    when(inputNamespaceMapExpr.getValue(execution))
        .thenReturn(JsonUtils.pojoToJson(Map.of(ENTITY_LIST_VARIABLE, GLOBAL_NAMESPACE)));
    setupVariableAccess(List.of("<#E::table::db.schema.t1>"), false);
  }

  @Test
  void successfulBatchDoesNotRecordFailure() {
    runBatch(testProvider, 10, "300");

    verify(execution, never()).setVariable(eq("global_failure"), any());
    verify(execution).setVariable(eq("process_result"), eq("success"));
  }

  @Test
  void consecutiveFailedSubBatchesStopTheBatch() {
    AtomicInteger calls = new AtomicInteger();
    SinkProvider down =
        scripted(
            entities -> {
              calls.incrementAndGet();
              return failedWrite(entities);
            });

    runBatch(down, 1000, "300");

    assertEquals(SinkTaskDelegate.MAX_CONSECUTIVE_FAILED_SUB_BATCHES, calls.get());
    verify(execution).setVariable(eq("process_syncedCount"), eq(0));
    verify(execution).setVariable(eq("process_failedCount"), eq(1000));
  }

  @Test
  void consecutiveSubBatchesWhoseEntitiesAllFailToLoadStopTheBatch() {
    AtomicInteger loads = new AtomicInteger();
    AtomicInteger writes = new AtomicInteger();
    delegate.entityLoader =
        link -> {
          loads.incrementAndGet();
          throw new IllegalStateException("entity store unavailable");
        };
    SinkProvider provider =
        scripted(
            entities -> {
              writes.incrementAndGet();
              return failedWrite(entities);
            });

    runBatchWithLoader(provider, 1000);

    assertEquals(0, writes.get(), "no entity was loaded, so none reached the provider");
    int prefetchedAhead = SinkTaskDelegate.MAX_CONSECUTIVE_FAILED_SUB_BATCHES + 1;
    assertTrue(
        loads.get() <= prefetchedAhead * SinkProvider.DEFAULT_BATCH_SIZE,
        () -> "loading continued past the failure limit: %d loads".formatted(loads.get()));
    verify(execution).setVariable(eq("process_syncedCount"), eq(0));
    verify(execution).setVariable(eq("process_failedCount"), eq(1000));
    verify(execution).setVariable(eq("process_result"), eq("failure"));
  }

  @Test
  void subBatchesWithPartialProgressDoNotStopTheBatch() {
    AtomicInteger calls = new AtomicInteger();
    SinkProvider flaky =
        scripted(
            entities -> {
              calls.incrementAndGet();
              return SinkResult.builder()
                  .success(false)
                  .syncedCount(entities.size() - 1)
                  .failedCount(1)
                  .build();
            });

    runBatch(flaky, 1000, "300");

    assertEquals(10, calls.get());
    verify(execution).setVariable(eq("process_syncedCount"), eq(990));
  }

  @Test
  void subBatchesThatStageAllButOneEntityDoNotStopTheBatch() {
    AtomicInteger calls = new AtomicInteger();
    List<Integer> staged = new ArrayList<>();
    SinkProvider staging =
        new TestSinkProvider() {
          @Override
          public SinkResult writeBatch(SinkContext context, List<EntityInterface<?>> entities) {
            calls.incrementAndGet();
            staged.add(entities.size() - 1);
            return SinkResult.builder()
                .success(false)
                .syncedCount(0)
                .failedCount(1)
                .errors(
                    List.of(
                        SinkResult.SinkError.builder()
                            .entityFqn(entities.getFirst().getFullyQualifiedName())
                            .errorMessage("path collision")
                            .build()))
                .build();
          }

          @Override
          public SinkResult finishBatch(SinkContext context) {
            return SinkResult.builder()
                .success(true)
                .syncedCount(staged.stream().mapToInt(Integer::intValue).sum())
                .build();
          }
        };

    runBatch(staging, 1000, "300");

    assertEquals(10, calls.get());
    verify(execution).setVariable(eq("process_syncedCount"), eq(990));
    verify(execution).setVariable(eq("process_failedCount"), eq(10));
    ArgumentCaptor<Object> syncResult = ArgumentCaptor.forClass(Object.class);
    verify(execution).setVariable(eq("process_syncResult"), syncResult.capture());
    assertFalse(((String) syncResult.getValue()).contains("Not synced"));
  }

  @Test
  void storedSyncResultIsBoundedAndHasNoStackTraces() {
    runBatch(scripted(entities -> failedWrite(entities)), 1000, "300");

    ArgumentCaptor<Object> syncResult = ArgumentCaptor.forClass(Object.class);
    verify(execution).setVariable(eq("process_syncResult"), syncResult.capture());
    String json = (String) syncResult.getValue();
    JsonNode tree = JsonUtils.readTree(json);

    assertEquals(SinkResultSummary.MAX_ERRORS, tree.path("errors").size());
    assertEquals(1000 - SinkResultSummary.MAX_ERRORS, tree.path("unlistedFailures").asInt());
    assertFalse(json.contains("stackTrace"), json);
    assertFalse(json.contains("cause"), json);
    assertFalse(json.contains("syncedEntities"), json);
    assertTrue(
        json.length() < 10_000, "stored result stays small: %d chars".formatted(json.length()));
  }

  @Test
  void providerChoosesTheSizeOfEachSubBatch() {
    List<Integer> sizes = new ArrayList<>();
    SinkProvider sized =
        new TestSinkProvider() {
          @Override
          public SinkResult writeBatch(SinkContext context, List<EntityInterface<?>> entities) {
            sizes.add(entities.size());
            return SinkResult.builder().success(true).syncedCount(entities.size()).build();
          }

          @Override
          public int nextBatchSize() {
            return 250;
          }
        };

    runBatch(sized, 600, "300");

    assertEquals(List.of(250, 250, 100), sizes);
    verify(execution).setVariable(eq("process_syncedCount"), eq(600));
  }

  @Test
  void otherProvidersKeepTheDefaultSubBatchSize() {
    List<Integer> sizes = new ArrayList<>();
    runBatch(
        scripted(
            entities -> {
              sizes.add(entities.size());
              return SinkResult.builder().success(true).syncedCount(entities.size()).build();
            }),
        250,
        "300");

    assertEquals(List.of(100, 100, 50), sizes);
  }

  @Test
  void nextSubBatchIsFetchedWhileTheCurrentOneIsWrittenButNoFurther() {
    int subBatchSize = SinkProvider.DEFAULT_BATCH_SIZE;
    AtomicInteger loads = new AtomicInteger();
    CountDownLatch nextSubBatchLoading = new CountDownLatch(1);
    AtomicBoolean overlapped = new AtomicBoolean();
    AtomicInteger furthestAhead = new AtomicInteger(Integer.MIN_VALUE);
    AtomicInteger writes = new AtomicInteger();
    SinkProvider slowWriter =
        scripted(
            entities -> {
              int written = writes.getAndIncrement();
              if (written == 0) {
                overlapped.set(awaitQuietly(nextSubBatchLoading));
              }
              furthestAhead.accumulateAndGet(loads.get() - (written + 2) * subBatchSize, Math::max);
              return SinkResult.builder().success(true).syncedCount(entities.size()).build();
            });
    delegate.entityLoader =
        link -> {
          if (loads.incrementAndGet() > subBatchSize) {
            nextSubBatchLoading.countDown();
          }
          return namedEntity(link);
        };

    runBatchWithLoader(slowWriter, 400);

    assertTrue(overlapped.get(), "sub-batch 2 is loaded while sub-batch 1 is being written");
    assertTrue(furthestAhead.get() <= 0, "never more than one sub-batch is fetched ahead");
    assertEquals(4, writes.get());
    verify(execution).setVariable(eq("process_syncedCount"), eq(400));
  }

  @Test
  void prefetchThreadStopsWhenTheBatchEnds() throws InterruptedException {
    Set<Thread> loaderThreads = ConcurrentHashMap.newKeySet();
    delegate.entityLoader =
        link -> {
          loaderThreads.add(Thread.currentThread());
          return namedEntity(link);
        };

    runBatchWithLoader(testProvider, 250);

    assertEquals(SubBatchPrefetcher.FETCH_THREADS, loaderThreads.size(), "a pool loads each batch");
    for (Thread prefetchThread : loaderThreads) {
      assertTrue(prefetchThread.getName().startsWith(SubBatchPrefetcher.THREAD_NAME_PREFIX));
      prefetchThread.join(TimeUnit.SECONDS.toMillis(5));
      assertFalse(prefetchThread.isAlive(), "every fetch thread is shut down");
    }
  }

  @Test
  void entitiesLoadedInParallelReachTheProviderInInputOrder() {
    List<String> written = new ArrayList<>();
    SinkProvider recording =
        new TestSinkProvider() {
          @Override
          public SinkResult writeBatch(SinkContext context, List<EntityInterface<?>> entities) {
            entities.forEach(entity -> written.add(entity.getFullyQualifiedName()));
            return SinkResult.builder().success(true).syncedCount(entities.size()).build();
          }

          @Override
          public int nextBatchSize() {
            return 97;
          }
        };
    delegate.entityLoader = SinkTaskDelegateTest::namedEntity;

    runBatchWithLoader(recording, 300);

    assertEquals(
        IntStream.range(0, 300).mapToObj("<#E::table::svc.db.sch.t%d>"::formatted).toList(),
        written);
  }

  @Test
  void slicesCoverTheSubBatchInOrderWithAtMostOneSlicePerThread() {
    List<String> links = IntStream.range(0, 10).mapToObj("l%d"::formatted).toList();

    List<List<String>> slices = SubBatchPrefetcher.slices(links);

    assertEquals(SubBatchPrefetcher.FETCH_THREADS, slices.size());
    assertEquals(links, slices.stream().flatMap(List::stream).toList());
    assertEquals(List.of(List.of("l0")), SubBatchPrefetcher.slices(List.of("l0")));
  }

  @Test
  void finishBatchRunsOnceAfterTheLastSubBatchAndItsResultIsCounted() {
    AtomicInteger finishes = new AtomicInteger();
    List<Integer> heldBack = new ArrayList<>();
    SinkProvider holdingBack =
        new TestSinkProvider() {
          @Override
          public SinkResult writeBatch(SinkContext context, List<EntityInterface<?>> entities) {
            heldBack.add(entities.size());
            return SinkResult.builder().success(true).build();
          }

          @Override
          public SinkResult finishBatch(SinkContext context) {
            finishes.incrementAndGet();
            return SinkResult.builder()
                .success(true)
                .syncedCount(heldBack.stream().mapToInt(Integer::intValue).sum())
                .metadata(Map.of("commitOids", List.of("pushed")))
                .build();
          }
        };

    runBatch(holdingBack, 250, "300");

    assertEquals(1, finishes.get());
    verify(execution).setVariable(eq("process_syncedCount"), eq(250));
    verify(execution).setVariable(eq("process_result"), eq("success"));
  }

  @Test
  void finishBatchRunsOnceEvenWhenConsecutiveFailuresSkippedSubBatches() {
    AtomicInteger writes = new AtomicInteger();
    AtomicInteger finishes = new AtomicInteger();
    SinkProvider down =
        new TestSinkProvider() {
          @Override
          public SinkResult writeBatch(SinkContext context, List<EntityInterface<?>> entities) {
            writes.incrementAndGet();
            return failedWrite(entities);
          }

          @Override
          public SinkResult finishBatch(SinkContext context) {
            finishes.incrementAndGet();
            return SinkResult.builder().success(true).syncedCount(7).build();
          }
        };

    runBatch(down, 1000, "300");

    assertEquals(SinkTaskDelegate.MAX_CONSECUTIVE_FAILED_SUB_BATCHES, writes.get());
    assertEquals(1, finishes.get());
    verify(execution).setVariable(eq("process_syncedCount"), eq(7));
    verify(execution).setVariable(eq("process_failedCount"), eq(1000));
  }

  @Test
  void aStopRequestedBeforeTheSecondSubBatchWritesOnlyTheFirst() {
    String workflowInstanceId = UUID.randomUUID().toString();
    when(execution.getProcessInstanceBusinessKey()).thenReturn(workflowInstanceId);
    AtomicInteger writes = new AtomicInteger();
    AtomicInteger finishes = new AtomicInteger();
    SinkProvider counting =
        new TestSinkProvider() {
          @Override
          public SinkResult writeBatch(SinkContext context, List<EntityInterface<?>> entities) {
            writes.incrementAndGet();
            return SinkResult.builder().success(true).syncedCount(entities.size()).build();
          }

          @Override
          public SinkResult finishBatch(SinkContext context) {
            finishes.incrementAndGet();
            return SinkResult.builder().success(true).build();
          }
        };
    List<String> checkedKeys = new ArrayList<>();
    delegate.isStopRequested =
        businessKey -> {
          checkedKeys.add(businessKey);
          return writes.get() >= 1;
        };

    runBatch(counting, 250, "300");

    assertEquals(1, writes.get(), "only sub-batch 1 is written");
    assertEquals(1, finishes.get(), "staged work is still finished");
    assertEquals(List.of(workflowInstanceId, workflowInstanceId), checkedKeys);
    verify(execution).setVariable(eq("process_syncedCount"), eq(100));
    verify(execution).setVariable(eq("process_failedCount"), eq(150));
    verify(execution).setVariable(eq("process_result"), eq("failure"));
    verify(execution, never()).setVariable(eq("global_failure"), any());
    ArgumentCaptor<Object> syncResult = ArgumentCaptor.forClass(Object.class);
    verify(execution).setVariable(eq("process_syncResult"), syncResult.capture());
    assertTrue(
        ((String) syncResult.getValue()).contains(SinkTaskDelegate.STOP_REQUESTED_REASON),
        "skipped entities say why they were not synced");
  }

  @Test
  void prefetchThreadStopsWhenTheProviderThrows() throws InterruptedException {
    Set<Thread> loaderThreads = ConcurrentHashMap.newKeySet();
    delegate.entityLoader =
        link -> {
          loaderThreads.add(Thread.currentThread());
          return namedEntity(link);
        };
    SinkProvider broken =
        scripted(
            entities -> {
              throw new IllegalStateException("provider bug");
            });

    assertThrows(BpmnError.class, () -> runBatchWithLoader(broken, 250));

    for (Thread prefetchThread : loaderThreads) {
      prefetchThread.join(TimeUnit.SECONDS.toMillis(5));
      assertFalse(prefetchThread.isAlive(), "every fetch thread is shut down on failure too");
    }
  }

  private static boolean awaitQuietly(CountDownLatch latch) {
    boolean released;
    try {
      released = latch.await(10, TimeUnit.SECONDS);
    } catch (InterruptedException e) {
      Thread.currentThread().interrupt();
      released = false;
    }
    return released;
  }

  private static EntityInterface<?> namedEntity(String link) {
    EntityInterface<?> entity = mock(EntityInterface.class);
    when(entity.getFullyQualifiedName()).thenReturn(link);
    return entity;
  }

  private static SinkResult failedWrite(List<EntityInterface<?>> entities) {
    RuntimeException cause = new RuntimeException("GitHub request failed with status 499");
    return SinkResult.builder()
        .success(false)
        .syncedCount(0)
        .failedCount(entities.size())
        .errors(
            entities.stream()
                .map(
                    entity ->
                        SinkResult.SinkError.builder()
                            .entityFqn(entity.getFullyQualifiedName())
                            .errorMessage(cause.getMessage())
                            .cause(cause)
                            .build())
                .toList())
        .build();
  }

  private static SinkProvider scripted(Function<List<EntityInterface<?>>, SinkResult> behavior) {
    return new TestSinkProvider() {
      @Override
      public SinkResult writeBatch(SinkContext context, List<EntityInterface<?>> entities) {
        return behavior.apply(entities);
      }
    };
  }

  private void runBatch(SinkProvider provider, int entityCount, String timeoutSeconds) {
    SinkProviderRegistry.getInstance().register(TEST_SINK_TYPE, config -> provider);
    setupCommonExpressions(true);
    when(timeoutSecondsExpr.getValue(execution)).thenReturn(timeoutSeconds);
    when(inputNamespaceMapExpr.getValue(execution))
        .thenReturn(JsonUtils.pojoToJson(Map.of(ENTITY_LIST_VARIABLE, GLOBAL_NAMESPACE)));
    List<String> links =
        IntStream.range(0, entityCount).mapToObj("<#E::table::svc.db.sch.t%d>"::formatted).toList();
    setupVariableAccess(links, false);
    EntityInterface<?> entity = mock(EntityInterface.class);
    when(entity.getFullyQualifiedName()).thenReturn("svc.db.sch.t");

    delegate.entityLoader = link -> entity;
    delegate.execute(execution);
  }

  /** Like {@link #runBatch} with a 300s budget, keeping the entity loader the test installed. */
  private void runBatchWithLoader(SinkProvider provider, int entityCount) {
    SinkProviderRegistry.getInstance().register(TEST_SINK_TYPE, config -> provider);
    setupCommonExpressions(true);
    when(inputNamespaceMapExpr.getValue(execution))
        .thenReturn(JsonUtils.pojoToJson(Map.of(ENTITY_LIST_VARIABLE, GLOBAL_NAMESPACE)));
    setupVariableAccess(
        IntStream.range(0, entityCount).mapToObj("<#E::table::svc.db.sch.t%d>"::formatted).toList(),
        false);
    delegate.execute(execution);
  }

  private void setupEncryptedSinkConfig(String token) {
    when(sinkConfigExpr.getValue(execution))
        .thenReturn(
            JsonUtils.pojoToJson(
                Map.of("credentials", Map.of("token", Fernet.getInstance().encrypt(token)))));
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
    private final List<EntityInterface<?>> writtenEntities = new ArrayList<>();
    private final List<List<EntityInterface<?>>> batchWrites = new ArrayList<>();
    private boolean shouldFail = false;

    @Override
    public String getSinkType() {
      return TEST_SINK_TYPE;
    }

    @Override
    public SinkResult write(SinkContext context, EntityInterface<?> entity) {
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
    public SinkResult writeBatch(SinkContext context, List<EntityInterface<?>> entities) {
      if (shouldFail) {
        throw new RuntimeException("Simulated failure");
      }
      batchWrites.add(new ArrayList<>(entities));
      List<String> fqns = entities.stream().map(EntityInterface<?>::getFullyQualifiedName).toList();
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

    public List<EntityInterface<?>> getWrittenEntities() {
      return writtenEntities;
    }

    public List<EntityInterface<?>> getLastBatchEntities() {
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

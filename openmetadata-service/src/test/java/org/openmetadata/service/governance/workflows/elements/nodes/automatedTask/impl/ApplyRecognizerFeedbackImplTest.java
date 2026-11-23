/*
 *  Copyright 2026 Collate.
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
package org.openmetadata.service.governance.workflows.elements.nodes.automatedTask.impl;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertInstanceOf;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.mockConstruction;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.lang.reflect.Field;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;
import org.flowable.common.engine.api.delegate.Expression;
import org.flowable.engine.delegate.BpmnError;
import org.flowable.engine.delegate.DelegateExecution;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.MockedConstruction;
import org.mockito.MockedStatic;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.openmetadata.schema.type.RecognizerFeedback;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.governance.workflows.Workflow;
import org.openmetadata.service.jdbi3.RecognizerFeedbackRepository;

/**
 * Regression tests for {@link ApplyRecognizerFeedbackImpl}. The non-obvious contract these
 * protect: a missing {@code recognizerFeedback} variable must surface as a {@code
 * BpmnError(WORKFLOW_RUNTIME_EXCEPTION)} whose {@code global_exception} carries an {@code
 * IllegalArgumentException} stack trace (not the legacy {@code NullPointerException}), so the
 * delegate null-guard is observable through the workflow instance's exception field.
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class ApplyRecognizerFeedbackImplTest {

  private static final String ACTIVITY_ID = "ApplyApprovedFeedback";
  private static final String PROCESS_DEFINITION_ID = "RecognizerFeedbackReviewWorkflow:1:1";
  private static final String FEEDBACK_VARIABLE =
      Workflow.GLOBAL_NAMESPACE + "_" + Workflow.RECOGNIZER_FEEDBACK;
  private static final String UPDATED_BY_VARIABLE =
      Workflow.GLOBAL_NAMESPACE + "_" + Workflow.UPDATED_BY_VARIABLE;
  private static final String FULL_INPUT_NAMESPACE_MAP =
      "{\"relatedEntity\":\"global\",\"updatedBy\":\"global\""
          + ",\"triggeringObjectId\":\"global\",\"recognizerFeedback\":\"global\"}";

  @Mock private DelegateExecution execution;
  @Mock private Expression inputNamespaceMapExpr;

  private ApplyRecognizerFeedbackImpl delegate;
  private MockedStatic<Entity> mockedEntity;
  private MockedConstruction<RecognizerFeedbackRepository> mockedRepoConstruction;
  private Map<String, Object> capturedVars;

  @BeforeEach
  void setUp() throws Exception {
    delegate = new ApplyRecognizerFeedbackImpl();
    injectField(delegate, "inputNamespaceMapExpr", inputNamespaceMapExpr);

    when(inputNamespaceMapExpr.getValue(execution)).thenReturn(FULL_INPUT_NAMESPACE_MAP);
    when(execution.getProcessDefinitionId()).thenReturn(PROCESS_DEFINITION_ID);
    when(execution.getCurrentActivityId()).thenReturn(ACTIVITY_ID);

    mockedEntity = mockStatic(Entity.class);
    mockedRepoConstruction =
        mockConstruction(
            RecognizerFeedbackRepository.class,
            (mock, ctx) ->
                when(mock.applyFeedback(any(), anyString())).thenAnswer(inv -> inv.getArgument(0)));

    capturedVars = new HashMap<>();
    doAnswer(
            inv -> {
              capturedVars.put(inv.getArgument(0), inv.getArgument(1));
              return null;
            })
        .when(execution)
        .setVariable(anyString(), any());
  }

  @AfterEach
  void tearDown() {
    if (mockedEntity != null) {
      mockedEntity.close();
    }
    if (mockedRepoConstruction != null) {
      mockedRepoConstruction.close();
    }
  }

  @Test
  void missingFeedbackVariable_throwsDescriptiveBpmnError() {
    when(execution.getVariable(FEEDBACK_VARIABLE)).thenReturn(null);

    BpmnError error = assertThrows(BpmnError.class, () -> delegate.execute(execution));

    assertEquals(Workflow.WORKFLOW_RUNTIME_EXCEPTION, error.getErrorCode());
    assertMessageContains(error.getMessage(), "is missing or could not be deserialized");
    assertMessageContains(error.getMessage(), ACTIVITY_ID);
    Object exception =
        capturedVars.get(Workflow.GLOBAL_NAMESPACE + "_" + Workflow.EXCEPTION_VARIABLE);
    assertInstanceOf(String.class, exception);
    String stack = (String) exception;
    assertTrue(
        stack.contains("IllegalArgumentException"),
        "exception stack trace should reference the descriptive IllegalArgumentException");
    assertTrue(
        !stack.contains("NullPointerException"),
        "exception stack trace should not contain the legacy NullPointerException");
  }

  @Test
  void emptyNamespaceMap_throwsDescriptiveBpmnError() {
    when(inputNamespaceMapExpr.getValue(execution)).thenReturn("{}");

    BpmnError error = assertThrows(BpmnError.class, () -> delegate.execute(execution));

    assertEquals(Workflow.WORKFLOW_RUNTIME_EXCEPTION, error.getErrorCode());
    assertMessageContains(error.getMessage(), "is missing or could not be deserialized");
  }

  @Test
  void happyPath_appliesFeedbackAndDerivesReviewedByFromUpdatedBy() {
    RecognizerFeedback feedback = validFeedback();
    when(execution.getVariable(FEEDBACK_VARIABLE)).thenReturn(JsonUtils.pojoToJson(feedback));
    when(execution.getVariable(UPDATED_BY_VARIABLE)).thenReturn("alice");

    assertDoesNotThrow(() -> delegate.execute(execution));

    RecognizerFeedbackRepository repo = mockedRepoConstruction.constructed().get(0);
    verify(repo).applyFeedback(eq(feedback), eq("alice"));
  }

  @Test
  void happyPath_updatedByMissing_fallsBackToGovernanceBot() {
    RecognizerFeedback feedback = validFeedback();
    when(execution.getVariable(FEEDBACK_VARIABLE)).thenReturn(JsonUtils.pojoToJson(feedback));
    when(execution.getVariable(UPDATED_BY_VARIABLE)).thenReturn(null);

    assertDoesNotThrow(() -> delegate.execute(execution));

    RecognizerFeedbackRepository repo = mockedRepoConstruction.constructed().get(0);
    verify(repo).applyFeedback(eq(feedback), eq("governance-bot"));
  }

  @Test
  void happyPath_updatedByFromUpstreamNode_readsFromNamespacedVariable() {
    RecognizerFeedback feedback = validFeedback();
    when(inputNamespaceMapExpr.getValue(execution))
        .thenReturn(
            "{\"relatedEntity\":\"global\",\"updatedBy\":\"ReviewFeedback\""
                + ",\"triggeringObjectId\":\"global\",\"recognizerFeedback\":\"global\"}");
    when(execution.getVariable(FEEDBACK_VARIABLE)).thenReturn(JsonUtils.pojoToJson(feedback));
    when(execution.getVariable("ReviewFeedback_updatedBy")).thenReturn("reviewer.1");

    assertDoesNotThrow(() -> delegate.execute(execution));

    RecognizerFeedbackRepository repo = mockedRepoConstruction.constructed().get(0);
    verify(repo).applyFeedback(eq(feedback), eq("reviewer.1"));
  }

  @Test
  void happyPath_updatedByEmpty_fallsBackToGovernanceBot() {
    RecognizerFeedback feedback = validFeedback();
    when(execution.getVariable(FEEDBACK_VARIABLE)).thenReturn(JsonUtils.pojoToJson(feedback));
    when(execution.getVariable(UPDATED_BY_VARIABLE)).thenReturn("");

    assertDoesNotThrow(() -> delegate.execute(execution));

    RecognizerFeedbackRepository repo = mockedRepoConstruction.constructed().get(0);
    verify(repo).applyFeedback(eq(feedback), eq("governance-bot"));
  }

  @Test
  void malformedFeedbackJson_wrapsJsonParsingExceptionInBpmnError() {
    when(execution.getVariable(FEEDBACK_VARIABLE)).thenReturn("not-json");

    BpmnError error = assertThrows(BpmnError.class, () -> delegate.execute(execution));

    assertEquals(Workflow.WORKFLOW_RUNTIME_EXCEPTION, error.getErrorCode());
    assertMessageContains(error.getMessage(), "JSON parsing failed");
  }

  private static void assertMessageContains(String message, String expected) {
    assertTrue(
        message != null && message.contains(expected),
        () -> "message should contain '" + expected + "' but was: " + message);
  }

  private static RecognizerFeedback validFeedback() {
    return new RecognizerFeedback()
        .withId(UUID.randomUUID())
        .withEntityLink("<#E::tag::Personal>")
        .withTagFQN("Personal")
        .withStatus(RecognizerFeedback.Status.PENDING);
  }

  private static void injectField(Object target, String fieldName, Object value) throws Exception {
    Field field = target.getClass().getDeclaredField(fieldName);
    field.setAccessible(true);
    field.set(target, value);
  }
}

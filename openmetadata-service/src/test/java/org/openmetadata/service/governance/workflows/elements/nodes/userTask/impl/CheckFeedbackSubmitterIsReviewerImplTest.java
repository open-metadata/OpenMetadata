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
package org.openmetadata.service.governance.workflows.elements.nodes.userTask.impl;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertInstanceOf;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.when;

import java.lang.reflect.Field;
import java.util.HashMap;
import java.util.List;
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
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.RecognizerFeedback;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.governance.workflows.Workflow;

/**
 * Regression tests for {@link CheckFeedbackSubmitterIsReviewerImpl}. This delegate runs first in
 * the feedback-review sub-process, so the null-guard contract it shares with the apply/reject
 * delegates must surface the same descriptive {@code BpmnError} (with an {@code
 * IllegalArgumentException} in {@code global_exception}) when {@code recognizerFeedback} is
 * missing. The non-obvious behavior protected below: a {@code createdBy} FQN containing a dot is
 * matched against a quoted assignee entity-link.
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class CheckFeedbackSubmitterIsReviewerImplTest {

  private static final String ACTIVITY_ID = "ReviewFeedback.checkSubmitterIsReviewer";
  private static final String PROCESS_DEFINITION_ID = "RecognizerFeedbackReviewWorkflow:1:1";
  private static final String PROCESS_INSTANCE_ID = "process-1";
  private static final String FEEDBACK_VARIABLE =
      Workflow.GLOBAL_NAMESPACE + "_" + Workflow.RECOGNIZER_FEEDBACK;
  private static final String ASSIGNEES_VAR_NAME = "ReviewFeedback_assignees";
  private static final String FULL_INPUT_NAMESPACE_MAP =
      "{\"relatedEntity\":\"global\",\"updatedBy\":\"global\""
          + ",\"triggeringObjectId\":\"global\",\"recognizerFeedback\":\"global\"}";

  @Mock private DelegateExecution execution;
  @Mock private Expression inputNamespaceMapExpr;
  @Mock private Expression assigneesVarNameExpr;

  private CheckFeedbackSubmitterIsReviewerImpl delegate;
  private Map<String, Object> capturedVars;

  @BeforeEach
  void setUp() throws Exception {
    delegate = new CheckFeedbackSubmitterIsReviewerImpl();
    injectField(delegate, "inputNamespaceMapExpr", inputNamespaceMapExpr);
    injectField(delegate, "assigneesVarNameExpr", assigneesVarNameExpr);

    when(inputNamespaceMapExpr.getValue(execution)).thenReturn(FULL_INPUT_NAMESPACE_MAP);
    when(assigneesVarNameExpr.getValue(execution)).thenReturn(ASSIGNEES_VAR_NAME);
    when(execution.getProcessDefinitionId()).thenReturn(PROCESS_DEFINITION_ID);
    when(execution.getCurrentActivityId()).thenReturn(ACTIVITY_ID);
    when(execution.getProcessInstanceId()).thenReturn(PROCESS_INSTANCE_ID);

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
  void tearDown() {}

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
  void submitterIsReviewer_setsVariableTrue() {
    EntityReference submitter =
        new EntityReference()
            .withId(UUID.randomUUID())
            .withType("user")
            .withName("alice")
            .withFullyQualifiedName("alice");
    RecognizerFeedback feedback = validFeedback().withCreatedBy(submitter);
    when(execution.getVariable(FEEDBACK_VARIABLE)).thenReturn(JsonUtils.pojoToJson(feedback));
    when(execution.getVariable(ASSIGNEES_VAR_NAME))
        .thenReturn(JsonUtils.pojoToJson(List.of("<#E::user::alice>", "<#E::user::bob>")));

    assertDoesNotThrow(() -> delegate.execute(execution));

    assertEquals(Boolean.TRUE, capturedVars.get("submitterIsReviewer"));
  }

  @Test
  void submitterNotInAssignees_setsVariableFalse() {
    EntityReference submitter =
        new EntityReference()
            .withId(UUID.randomUUID())
            .withType("user")
            .withName("alice")
            .withFullyQualifiedName("alice");
    RecognizerFeedback feedback = validFeedback().withCreatedBy(submitter);
    when(execution.getVariable(FEEDBACK_VARIABLE)).thenReturn(JsonUtils.pojoToJson(feedback));
    when(execution.getVariable(ASSIGNEES_VAR_NAME))
        .thenReturn(JsonUtils.pojoToJson(List.of("<#E::user::bob>", "<#E::user::carol>")));

    assertDoesNotThrow(() -> delegate.execute(execution));

    assertEquals(Boolean.FALSE, capturedVars.get("submitterIsReviewer"));
  }

  @Test
  void emptyAssignees_setsVariableFalse() {
    EntityReference submitter =
        new EntityReference().withType("user").withName("alice").withFullyQualifiedName("alice");
    RecognizerFeedback feedback = validFeedback().withCreatedBy(submitter);
    when(execution.getVariable(FEEDBACK_VARIABLE)).thenReturn(JsonUtils.pojoToJson(feedback));
    when(execution.getVariable(ASSIGNEES_VAR_NAME)).thenReturn("[]");

    assertDoesNotThrow(() -> delegate.execute(execution));

    assertEquals(Boolean.FALSE, capturedVars.get("submitterIsReviewer"));
  }

  @Test
  void nullCreatedBy_setsVariableFalse() {
    RecognizerFeedback feedback = validFeedback().withCreatedBy(null);
    when(execution.getVariable(FEEDBACK_VARIABLE)).thenReturn(JsonUtils.pojoToJson(feedback));
    when(execution.getVariable(ASSIGNEES_VAR_NAME))
        .thenReturn(JsonUtils.pojoToJson(List.of("<#E::user::bob>")));

    assertDoesNotThrow(() -> delegate.execute(execution));

    assertEquals(Boolean.FALSE, capturedVars.get("submitterIsReviewer"));
  }

  /**
   * If the assignee entry contains a dotted fully-qualified name the submitter matches even when
   * the dot appears inside the assignees entity-link string. Ensure no regression on this case.
   */
  @Test
  void submitterWithDottedFqn_matchesQuotedAssigneeLink() {
    EntityReference submitter =
        new EntityReference()
            .withType("user")
            .withName("ram.balaji")
            .withFullyQualifiedName("\"ram.balaji\"");
    RecognizerFeedback feedback = validFeedback().withCreatedBy(submitter);
    when(execution.getVariable(FEEDBACK_VARIABLE)).thenReturn(JsonUtils.pojoToJson(feedback));
    when(execution.getVariable(ASSIGNEES_VAR_NAME))
        .thenReturn(JsonUtils.pojoToJson(List.of("<#E::user::\"ram.balaji\">", "<#E::user::bob>")));

    assertDoesNotThrow(() -> delegate.execute(execution));

    assertEquals(Boolean.TRUE, capturedVars.get("submitterIsReviewer"));
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

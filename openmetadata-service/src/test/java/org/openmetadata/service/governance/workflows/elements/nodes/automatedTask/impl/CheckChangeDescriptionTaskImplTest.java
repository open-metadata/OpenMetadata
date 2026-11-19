/*
 *  Copyright 2024 Collate.
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

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.when;

import java.lang.reflect.Field;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.flowable.common.engine.api.delegate.Expression;
import org.flowable.engine.delegate.DelegateExecution;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.MockedStatic;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.openmetadata.schema.entity.data.Glossary;
import org.openmetadata.schema.type.Include;
import org.openmetadata.service.Entity;
import org.openmetadata.service.resources.feeds.MessageParser;

/**
 * Covers {@code CheckChangeDescriptionTask} on an entity that shows no change. Only a create, or a
 * run started before the trigger passed the event type, has nothing narrower to judge; an update
 * whose edit was undone within its session reverts the entity to a version without a change.
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class CheckChangeDescriptionTaskImplTest {

  private static final String NODE_ID = "CheckChange";
  private static final String RESULT_KEY = NODE_ID + "_result";
  private static final String ENTITY_LINK = "<#E::glossary::DiagGlossary>";

  @Mock private DelegateExecution execution;
  @Mock private Expression conditionExpr;
  @Mock private Expression rulesExpr;
  @Mock private Expression inputNamespaceMapExpr;

  private CheckChangeDescriptionTaskImpl delegate;
  private MockedStatic<Entity> mockedEntity;
  private Map<String, Object> capturedVars;

  @BeforeEach
  void setUp() throws Exception {
    delegate = new CheckChangeDescriptionTaskImpl();
    injectField(delegate, "conditionExpr", conditionExpr);
    injectField(delegate, "rulesExpr", rulesExpr);
    injectField(delegate, "inputNamespaceMapExpr", inputNamespaceMapExpr);

    when(inputNamespaceMapExpr.getValue(execution)).thenReturn("{\"relatedEntity\":\"global\"}");
    when(execution.getVariable("global_relatedEntity")).thenReturn(ENTITY_LINK);
    when(execution.getProcessDefinitionId()).thenReturn("TagApprovalWorkflow:1:1");
    when(execution.getCurrentActivityId()).thenReturn(NODE_ID);
    when(conditionExpr.getValue(execution)).thenReturn("OR");
    when(rulesExpr.getValue(execution)).thenReturn(Map.of("tags", List.of("PII.Sensitive")));

    mockedEntity = mockStatic(Entity.class);
    mockedEntity
        .when(
            () ->
                Entity.getEntity(
                    any(MessageParser.EntityLink.class), anyString(), any(Include.class)))
        .thenReturn(new Glossary().withName("DiagGlossary").withFullyQualifiedName("DiagGlossary"));

    capturedVars = new HashMap<>();
    doAnswer(
            invocation -> {
              capturedVars.put(invocation.getArgument(0), invocation.getArgument(1));
              return null;
            })
        .when(execution)
        .setVariable(anyString(), any());
  }

  @AfterEach
  void tearDown() {
    mockedEntity.close();
  }

  @Test
  void updateThatLeftNoChange_evaluatesFalse() {
    givenEventType("entityUpdated");

    delegate.execute(execution);

    assertFalse(result(), "an update whose edit was undone has no change to match");
  }

  @Test
  void createWithNoChange_evaluatesTrue() {
    givenEventType("entityCreated");

    delegate.execute(execution);

    assertTrue(result(), "a create carries no change and routes true");
  }

  @Test
  void runWithoutRecordedEventType_keepsTreatingNoChangeAsCreate() {
    givenEventType(null);

    delegate.execute(execution);

    assertTrue(result(), "a run started before the event type was passed keeps the create rule");
  }

  private void givenEventType(String eventType) {
    when(execution.getVariable("global_triggeringEventType")).thenReturn(eventType);
  }

  private boolean result() {
    return Boolean.TRUE.equals(capturedVars.get(RESULT_KEY));
  }

  private static void injectField(Object target, String fieldName, Object value) throws Exception {
    Field field = target.getClass().getDeclaredField(fieldName);
    field.setAccessible(true);
    field.set(target, value);
  }
}

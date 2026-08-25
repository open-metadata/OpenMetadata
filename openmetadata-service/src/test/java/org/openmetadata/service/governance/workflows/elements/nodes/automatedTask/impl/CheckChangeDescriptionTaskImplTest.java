/*
 *  Copyright 2026 Collate
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
import static org.mockito.ArgumentMatchers.eq;
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
import org.openmetadata.schema.type.ChangeDescription;
import org.openmetadata.schema.type.FieldChange;
import org.openmetadata.schema.type.Include;
import org.openmetadata.service.Entity;
import org.openmetadata.service.governance.approval.PendingApprovalChangeStore;
import org.openmetadata.service.resources.feeds.MessageParser;

/**
 * Covers {@code CheckChangeDescriptionTask} on an approval-gated change. The gate holds the change
 * off the entity (reverted, no persisted change description of its own), so the node must evaluate
 * the requester's held change via {@link PendingApprovalChangeStore#effective} - not just the
 * entity's persisted diff - to route the workflow. A held-only change carries just {@code
 * fieldsUpdated} (null added/deleted), which the node must tolerate.
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class CheckChangeDescriptionTaskImplTest {

  private static final String NODE_ID = "CheckChange";
  private static final String RESULT_KEY = NODE_ID + "_result";
  private static final String ENTITY_LINK = "<#E::glossary::DiagGlossary>";
  private static final String REQUESTER = "alice";

  @Mock private DelegateExecution execution;
  @Mock private Expression conditionExpr;
  @Mock private Expression rulesExpr;
  @Mock private Expression inputNamespaceMapExpr;

  private CheckChangeDescriptionTaskImpl delegate;
  private MockedStatic<Entity> mockedEntity;
  private MockedStatic<PendingApprovalChangeStore> mockedStore;
  private Map<String, Object> capturedVars;

  @BeforeEach
  void setUp() throws Exception {
    delegate = new CheckChangeDescriptionTaskImpl();
    injectField(delegate, "conditionExpr", conditionExpr);
    injectField(delegate, "rulesExpr", rulesExpr);
    injectField(delegate, "inputNamespaceMapExpr", inputNamespaceMapExpr);

    when(inputNamespaceMapExpr.getValue(execution)).thenReturn("{\"relatedEntity\":\"global\"}");
    when(execution.getVariable("global_relatedEntity")).thenReturn(ENTITY_LINK);
    when(execution.getVariable("global_updatedBy")).thenReturn(REQUESTER);
    when(execution.getProcessDefinitionId()).thenReturn("PendingChangeApprovalWorkflow:1:1");
    when(execution.getCurrentActivityId()).thenReturn(NODE_ID);
    when(conditionExpr.getValue(execution)).thenReturn("OR");

    mockedEntity = mockStatic(Entity.class);
    mockedEntity
        .when(
            () ->
                Entity.getEntity(
                    any(MessageParser.EntityLink.class), anyString(), any(Include.class)))
        .thenReturn(new Glossary().withName("DiagGlossary").withFullyQualifiedName("DiagGlossary"));
    mockedStore = mockStatic(PendingApprovalChangeStore.class);

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
    mockedStore.close();
  }

  @Test
  void heldChangeMatchingRule_evaluatesTrue() {
    // Held-only change: just fieldsUpdated set (added/deleted null) - the node must read it and not
    // NPE, and route true because the held description matches the rule.
    givenEffective(heldUpdated("description", "proposed change value"));
    givenRules(Map.of("description", List.of("proposed change")));

    delegate.execute(execution);

    assertTrue(result(), "the node must see and match the held change");
  }

  @Test
  void heldChangeNotMatchingRule_evaluatesFalse() {
    givenEffective(heldUpdated("description", "some unrelated value"));
    givenRules(Map.of("description", List.of("proposed change")));

    delegate.execute(execution);

    assertFalse(result(), "the held change content is evaluated, so a non-match routes false");
  }

  @Test
  void heldChangeOnFieldNotInRules_evaluatesFalse() {
    givenEffective(heldUpdated("displayName", "new dn"));
    givenRules(Map.of("description", List.of("proposed change")));

    delegate.execute(execution);

    assertFalse(result(), "a held change to a field outside the rules routes false");
  }

  @Test
  void noHeldOrPersistedChange_evaluatesTrue() {
    givenEffective(null);
    givenRules(Map.of("description", List.of("proposed change")));

    delegate.execute(execution);

    assertTrue(result(), "no change (create event) routes true");
  }

  @Test
  void heldChangeWithNoRules_evaluatesTrue() {
    givenEffective(heldUpdated("description", "proposed change value"));
    when(rulesExpr.getValue(execution)).thenReturn(null);

    delegate.execute(execution);

    assertTrue(result(), "with no rules configured the node routes true");
  }

  private void givenEffective(ChangeDescription change) {
    mockedStore
        .when(() -> PendingApprovalChangeStore.effective(any(), eq(REQUESTER)))
        .thenReturn(change);
  }

  private void givenRules(Map<String, List<String>> rules) {
    when(rulesExpr.getValue(execution)).thenReturn(rules);
  }

  private ChangeDescription heldUpdated(String field, String newValue) {
    return new ChangeDescription()
        .withFieldsUpdated(List.of(new FieldChange().withName(field).withNewValue(newValue)));
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

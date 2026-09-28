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

package org.openmetadata.service.governance.workflows.elements.triggers.impl;

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
import java.util.UUID;
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
import org.openmetadata.service.governance.workflows.elements.triggers.EventBasedEntityTrigger;
import org.openmetadata.service.resources.feeds.MessageParser;

/**
 * Covers the {@code eventBasedEntity} trigger's decision to fire a workflow, focused on the
 * approval-gated pending-change path.
 *
 * <p>The trigger evaluates exactly one edit: the held change carried on the signal the gate raises
 * (the fields this edit held off the entity), or - for a normal change event - the entity's
 * persisted change description. The requester's accumulated hold (prior edits still awaiting
 * approval) must never be folded in, so an edit that touches only an excluded field does not
 * re-fire while an unrelated hold is open. The exclusion JsonLogic runs against the proposed entity
 * (the held change applied), matching the gate, which evaluates the filter before reverting.
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class FilterEntityImplTest {

  private static final String ENTITY_LINK = "<#E::glossary::DiagGlossary>";

  @Mock private DelegateExecution execution;
  @Mock private Expression excludedFieldsExpr;
  @Mock private Expression includeFieldsExpr;
  @Mock private Expression filterExpr;

  private FilterEntityImpl delegate;
  private MockedStatic<Entity> mockedEntity;
  private Map<String, Object> capturedVars;

  @BeforeEach
  void setUp() throws Exception {
    delegate = new FilterEntityImpl();
    injectField(delegate, "excludedFieldsExpr", excludedFieldsExpr);
    injectField(delegate, "includeFieldsExpr", includeFieldsExpr);
    injectField(delegate, "filterExpr", filterExpr);

    when(execution.getProcessDefinitionId()).thenReturn("PendingChangeApprovalWorkflow:1:1");
    when(execution.getVariable("global_relatedEntity")).thenReturn(ENTITY_LINK);

    mockedEntity = mockStatic(Entity.class);

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

  // ---- Event path: no held change on the signal, evaluate the persisted change description ----

  @Test
  void eventPath_excludedFieldOnly_doesNotFire() {
    givenEntity(glossary().withChangeDescription(changeOf("description")));
    exclude("description");

    delegate.execute(execution);

    assertFalse(passesFilter(), "A change to only an excluded field must not fire");
  }

  @Test
  void eventPath_nonExcludedField_fires() {
    givenEntity(glossary().withChangeDescription(changeOf("tags")));
    exclude("description");

    delegate.execute(execution);

    assertTrue(passesFilter(), "A change to a non-excluded field must fire");
  }

  // ---- Change-request path: admitted at submission, routed only to the reviewing workflow ----

  @Test
  void changeRequestRun_passesInTheReviewingWorkflowWithoutRefiltering() {
    // The entity is not written while the request is pending, so there is no persisted change; the
    // run still passes because admission already applied this workflow's include/exclude/filter.
    givenEntity(glossary().withChangeDescription(null));
    exclude("description");
    changeRequestFor("PendingChangeApprovalWorkflow");

    delegate.execute(execution);

    assertTrue(passesFilter(), "The reviewing workflow runs its change request");
  }

  @Test
  void changeRequestRun_isIgnoredByOtherHookWorkflows() {
    givenEntity(glossary().withChangeDescription(changeOf("tags")));
    changeRequestFor("SomeOtherApprovalWorkflow");

    delegate.execute(execution);

    assertFalse(passesFilter(), "Only the workflow that reviews the request runs it");
  }

  @Test
  void jsonLogicFilter_eventPath_evaluatesPersistedEntity() {
    givenEntity(glossary().withDescription("kept").withChangeDescription(changeOf("tags")));
    filter(Map.of("glossary", "{\"==\":[{\"var\":\"description\"},\"SKIP\"]}"));

    delegate.execute(execution);

    assertTrue(passesFilter(), "With no held change the persisted entity is not excluded");
  }

  // ---- helpers ----

  private void givenEntity(Glossary glossary) {
    mockedEntity
        .when(
            () ->
                Entity.getEntity(
                    any(MessageParser.EntityLink.class), anyString(), any(Include.class)))
        .thenReturn(glossary);
  }

  private void changeRequestFor(String workflowName) {
    when(execution.getVariable("global_changeRequestId")).thenReturn(UUID.randomUUID().toString());
    when(execution.getVariable("global_changeRequestRevision")).thenReturn(1);
    when(execution.getVariable("global_changeRequestWorkflow")).thenReturn(workflowName);
  }

  private void exclude(String... fields) {
    when(excludedFieldsExpr.getValue(execution)).thenReturn(List.of(fields));
  }

  private void filter(Map<String, String> perEntityFilter) {
    when(filterExpr.getValue(execution)).thenReturn(perEntityFilter);
  }

  private Glossary glossary() {
    return new Glossary()
        .withName("DiagGlossary")
        .withFullyQualifiedName("DiagGlossary")
        .withDescription("desc");
  }

  private ChangeDescription changeOf(String... fieldNames) {
    List<FieldChange> updated =
        List.of(fieldNames).stream().map(name -> new FieldChange().withName(name)).toList();
    return new ChangeDescription().withFieldsUpdated(updated);
  }

  private boolean passesFilter() {
    return Boolean.TRUE.equals(capturedVars.get(EventBasedEntityTrigger.PASSES_FILTER_VARIABLE));
  }

  private static void injectField(Object target, String fieldName, Object value) throws Exception {
    Field field = target.getClass().getDeclaredField(fieldName);
    field.setAccessible(true);
    field.set(target, value);
  }
}

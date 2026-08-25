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
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.governance.approval.GovernanceApprovalRegistry;
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
  private MockedStatic<GovernanceApprovalRegistry> mockedRegistry;
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
    mockedRegistry = mockStatic(GovernanceApprovalRegistry.class);
    // Default: not a hook workflow, so the field/filter logic below is what the tests exercise.
    // The hook-suppression case overrides this to true.
    mockedRegistry
        .when(() -> GovernanceApprovalRegistry.isPendingChangeWorkflow(anyString()))
        .thenReturn(false);

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
    mockedRegistry.close();
  }

  // ---- Event path: no held change on the signal, evaluate the persisted change description ----

  @Test
  void eventPath_excludedFieldOnly_doesNotFire() {
    givenEntity(glossary().withChangeDescription(changeOf("description")));
    exclude("description");

    delegate.execute(execution);

    assertFalse(
        passesFilter(),
        "A change to only an excluded field must not fire, even with a hold open elsewhere");
  }

  @Test
  void eventPath_nonExcludedField_fires() {
    givenEntity(glossary().withChangeDescription(changeOf("tags")));
    exclude("description");

    delegate.execute(execution);

    assertTrue(passesFilter(), "A change to a non-excluded field must fire");
  }

  // ---- Gate path: held change carried on the signal is the single edit under review ----

  @Test
  void gatePath_heldGatedField_firesEvenWhenEntityHasNoPersistedChange() {
    // The gate reverts the held field off the entity, so the persisted change description is null.
    givenEntity(glossary().withChangeDescription(null));
    heldChange(changeOf("tags"));
    exclude("description");

    delegate.execute(execution);

    assertTrue(passesFilter(), "The held gated field must drive the trigger on the gate path");
  }

  @Test
  void gatePath_usesHeldChangeNotPersisted() {
    // Held change is an excluded field; the entity's persisted change description carries a
    // non-excluded field. If the trigger read the persisted change it would fire - it must not,
    // because the edit under review (the held change) touched only an excluded field.
    givenEntity(glossary().withChangeDescription(changeOf("tags")));
    heldChange(changeOf("description"));
    exclude("description");

    delegate.execute(execution);

    assertFalse(passesFilter(), "The held change, not the persisted one, decides the gate path");
  }

  @Test
  void eventPath_hookWorkflow_noHeldChange_isSuppressed() {
    // A hook workflow reviews held changes only. An entity-change event with nothing held (e.g. a
    // description edit whose change description also carries the workflow's own entityStatus write)
    // must not start it, even though entityStatus is not an excluded field. Suppressed before the
    // field/filter evaluation, so no entity stub is needed.
    mockedRegistry
        .when(() -> GovernanceApprovalRegistry.isPendingChangeWorkflow(anyString()))
        .thenReturn(true);

    delegate.execute(execution);

    assertFalse(
        passesFilter(), "A hook workflow must not fire on a plain event with no held change");
  }

  // ---- Exclusion JsonLogic evaluated against the proposed (held-applied) entity ----

  @Test
  void jsonLogicFilter_evaluatesProposedEntity_notRevertedEntity() {
    // Filter excludes the entity when its description equals SKIP. The gate reverted the held
    // description off the entity (persisted value is 'kept'); the proposed value is 'SKIP'. The
    // filter must see the proposed value and exclude, matching what the gate decided.
    givenEntity(glossary().withDescription("kept"));
    heldChange(changeOfField("description", "SKIP"));
    filter(Map.of("glossary", "{\"==\":[{\"var\":\"description\"},\"SKIP\"]}"));

    delegate.execute(execution);

    assertFalse(
        passesFilter(), "Exclusion JsonLogic must evaluate the proposed entity (held applied)");
  }

  @Test
  void jsonLogicFilter_eventPath_evaluatesPersistedEntity() {
    givenEntity(glossary().withDescription("kept").withChangeDescription(changeOf("tags")));
    filter(Map.of("glossary", "{\"==\":[{\"var\":\"description\"},\"SKIP\"]}"));

    delegate.execute(execution);

    assertTrue(passesFilter(), "With no held change the persisted entity is not excluded");
  }

  @Test
  void jsonLogicFilter_gatePath_excludedWhenDescriptionEqualsClaude() {
    // Exclude filter: skip the workflow when the glossary description equals "claude". A held gated
    // field would otherwise fire, but an excluded entity must not go through the workflow at all.
    givenEntity(glossary().withDescription("claude"));
    heldChange(changeOf("tags"));
    filter(Map.of("glossary", "{\"==\":[{\"var\":\"description\"},\"claude\"]}"));

    delegate.execute(execution);

    assertFalse(
        passesFilter(), "Exclude filter description==claude must stop the workflow despite the hold");
  }

  @Test
  void jsonLogicFilter_gatePath_firesWhenDescriptionDoesNotMatch() {
    givenEntity(glossary().withDescription("something-else"));
    heldChange(changeOf("tags"));
    filter(Map.of("glossary", "{\"==\":[{\"var\":\"description\"},\"claude\"]}"));

    delegate.execute(execution);

    assertTrue(passesFilter(), "A non-matching entity is not excluded; the held change fires");
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

  private void heldChange(ChangeDescription change) {
    when(execution.getVariable("global_pendingHeldChange"))
        .thenReturn(JsonUtils.pojoToJson(change));
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

  private ChangeDescription changeOfField(String name, Object newValue) {
    return new ChangeDescription()
        .withFieldsUpdated(List.of(new FieldChange().withName(name).withNewValue(newValue)));
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

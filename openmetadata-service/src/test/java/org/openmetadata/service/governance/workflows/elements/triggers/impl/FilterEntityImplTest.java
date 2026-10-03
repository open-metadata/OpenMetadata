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

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.when;

import java.lang.reflect.Field;
import java.lang.reflect.Method;
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
import org.openmetadata.service.governance.workflows.elements.triggers.WorkflowTriggerFilters;
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
  private FilterEntityImpl filterEntity;
  private Method passesFieldBasedFilter;

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

    filterEntity = new FilterEntityImpl();
    passesFieldBasedFilter =
        FilterEntityImpl.class.getDeclaredMethod(
            "passesFieldBasedFilter", String.class, List.class, List.class, List.class);
    passesFieldBasedFilter.setAccessible(true);
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

  @Test
  void testExistingFieldsAreRecognizedAsTriggerFields() throws Exception {
    List<String> commonFields =
        List.of(
            "name",
            "displayName",
            "fullyQualifiedName",
            "description",
            "owners",
            "reviewers",
            "tags",
            "certification",
            "domains",
            "dataProducts",
            "extension",
            "deleted");
    for (String field : commonFields) {
      assertTrue(
          invokeFilter(List.of(fieldChange(field)), null, null),
          "Common field should trigger workflow: %s".formatted(field));
    }

    List<String> glossaryTermFields =
        List.of("synonyms", "relatedTerms", "references", "glossary", "parent");
    for (String field : glossaryTermFields) {
      assertTrue(
          invokeFilterFor("glossaryTerm", List.of(fieldChange(field)), null, null),
          "Glossary term field should trigger workflow: %s".formatted(field));
    }
    assertTrue(invokeFilterFor("domain", List.of(fieldChange("experts")), null, null));
    assertTrue(invokeFilterFor("domain", List.of(fieldChange("children")), null, null));
    assertFalse(invokeFilterFor("glossaryTerm", List.of(fieldChange("children")), null, null));
  }

  @Test
  void testNewCommonFieldsAreRecognizedAsTriggerFields() throws Exception {
    assertTrue(invokeFilterFor("glossaryTerm", List.of(fieldChange("style")), null, null));
    assertTrue(invokeFilter(List.of(fieldChange("lifeCycle")), null, null));
  }

  @Test
  void testNewDataContractFieldsAreRecognizedAsTriggerFields() throws Exception {
    for (String field :
        List.of("schema", "semantics", "qualityExpectations", "termsOfUse", "security", "sla")) {
      assertTrue(
          invokeFilterFor("dataContract", List.of(fieldChange(field)), null, null),
          "Data contract field should trigger workflow: %s".formatted(field));
    }
    // Written by contract validation, not by users: never a trigger field.
    assertFalse(invokeFilterFor("dataContract", List.of(fieldChange("latestResult")), null, null));
    assertFalse(invokeFilterFor("dataContract", List.of(fieldChange("testSuite")), null, null));
  }

  @Test
  void testServerComputedFieldsDoNotTriggerWorkflow() throws Exception {
    // Recorded on every test-result post; a trigger here would fire a workflow per DQ run.
    for (String field : List.of("testCaseResult", "testCaseStatus")) {
      assertFalse(invokeFilterFor("testCase", List.of(fieldChange(field)), null, null));
    }
    assertTrue(invokeFilterFor("testCase", List.of(fieldChange("parameterValues")), null, null));
    assertFalse(
        invokeFilterFor("testSuite", List.of(fieldChange("testCaseResultSummary")), null, null));
    assertFalse(invokeFilterFor("query", List.of(fieldChange("checksum")), null, null));
    assertFalse(invokeFilterFor("user", List.of(fieldChange("allowImpersonation")), null, null));
    assertFalse(
        invokeFilterFor("mcpServer", List.of(fieldChange("usedByApplications")), null, null));
  }

  @Test
  void testNewDataProductFieldsAreRecognizedAsTriggerFields() throws Exception {
    for (String field : List.of("dataProductType", "visibility", "portfolioPriority", "assets")) {
      assertTrue(
          invokeFilterFor("dataProduct", List.of(fieldChange(field)), null, null),
          "Data product field should trigger workflow: %s".formatted(field));
    }
  }

  @Test
  void testInputOutputPortsAndGlossaryTermsAreRecognizedAsTriggerFields() throws Exception {
    assertTrue(invokeFilterFor("dataProduct", List.of(fieldChange("inputPorts")), null, null));
    assertTrue(invokeFilterFor("dataProduct", List.of(fieldChange("outputPorts")), null, null));
    assertTrue(invokeFilter(List.of(fieldChange("glossaryTerms")), null, null));
  }

  @Test
  void testInputOutputPortsCanBeIncludedOrExcluded() throws Exception {
    List<String> includePortFields = List.of("inputPorts", "outputPorts");
    assertTrue(
        invokeFilterFor(
            "dataProduct", List.of(fieldChange("inputPorts")), includePortFields, null));
    assertTrue(
        invokeFilterFor(
            "dataProduct", List.of(fieldChange("outputPorts")), includePortFields, null));
    assertFalse(
        invokeFilterFor(
            "dataProduct", List.of(fieldChange("description")), includePortFields, null));

    List<String> excludePortFields = List.of("inputPorts", "outputPorts");
    assertFalse(
        invokeFilterFor(
            "dataProduct", List.of(fieldChange("inputPorts")), null, excludePortFields));
    assertFalse(
        invokeFilterFor(
            "dataProduct", List.of(fieldChange("outputPorts")), null, excludePortFields));
    assertTrue(
        invokeFilterFor(
            "dataProduct", List.of(fieldChange("description")), null, excludePortFields));
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

  @Test
  void testIncludeFilterAllowsOnlySpecifiedFields() throws Exception {
    List<String> includeFields = List.of("sla", "schema");

    assertTrue(invokeFilterFor("dataContract", List.of(fieldChange("sla")), includeFields, null));
    assertTrue(
        invokeFilterFor("dataContract", List.of(fieldChange("schema")), includeFields, null));
    assertFalse(
        invokeFilterFor("dataContract", List.of(fieldChange("semantics")), includeFields, null));
    assertFalse(invokeFilterFor("dataContract", List.of(fieldChange("tags")), includeFields, null));
  }

  @Test
  void testExcludeFilterBlocksSpecifiedFields() throws Exception {
    List<String> excludeFields = List.of("sla", "latestResult");

    assertFalse(invokeFilterFor("dataContract", List.of(fieldChange("sla")), null, excludeFields));
    assertFalse(
        invokeFilterFor("dataContract", List.of(fieldChange("latestResult")), null, excludeFields));
    assertTrue(
        invokeFilterFor("dataContract", List.of(fieldChange("schema")), null, excludeFields));
    assertTrue(
        invokeFilterFor("dataContract", List.of(fieldChange("semantics")), null, excludeFields));
  }

  @Test
  void testIncludeFilterTakesPriorityOverExcludeFilter() throws Exception {
    List<String> includeFields = List.of("sla");
    List<String> excludeFields = List.of("sla");

    assertTrue(
        invokeFilterFor("dataContract", List.of(fieldChange("sla")), includeFields, excludeFields));
  }

  @Test
  void testEntitySpecificFieldsDoNotTriggerForOtherEntityTypes() throws Exception {
    // Glossary, data product and data contract fields are trigger fields only for the entity types
    // that have them; a same-named change on a table does not fire a table workflow.
    for (String field :
        List.of("synonyms", "style", "inputPorts", "consumesFrom", "sla", "schema")) {
      assertFalse(
          invokeFilter(List.of(fieldChange(field)), null, null),
          "Field should not trigger a table workflow: %s".formatted(field));
    }
  }

  @Test
  void testMetricFieldsTriggerOnlyForMetrics() throws Exception {
    // Every metric attribute a user or a semantic-layer sync can change fires a metric workflow,
    // including the formula; the same field names are not trigger fields for other entity types.
    for (String field :
        List.of(
            "metricExpression",
            "metricType",
            "unitOfMeasurement",
            "customUnitOfMeasurement",
            "granularity",
            "dimensions",
            "measures",
            "filters",
            "relatedMetrics",
            "metricGroup",
            "assets")) {
      assertTrue(
          invokeFilterFor("metric", List.of(fieldChange(field)), null, null),
          "metric field '%s' should trigger a metric workflow".formatted(field));
    }
    assertTrue(
        invokeFilterFor("metric", List.of(fieldChange("metricExpression.code")), null, null));
    assertFalse(invokeFilterFor("table", List.of(fieldChange("metricExpression")), null, null));
    assertFalse(
        invokeFilterFor(
            "metric", List.of(fieldChange("metricExpression")), null, List.of("metricExpression")));
  }

  @Test
  void testEntitySpecificColumnFieldTriggersByDefault() throws Exception {
    // `columns` is a table-specific trigger field. It is not opt-in: with no include/exclude it
    // fires like any other trigger field, so a column change (including a column custom-property /
    // extension change, recorded as `columns.<name>.extension`) triggers the workflow.
    assertTrue(invokeFilter(List.of(fieldChange("columns")), null, null));
    assertTrue(invokeFilter(List.of(fieldChange("columns.campaign_id.extension")), null, null));

    // include set -> only the listed fields fire.
    assertTrue(
        invokeFilter(
            List.of(fieldChange("columns.campaign_id.extension")), List.of("columns"), null));
    assertFalse(invokeFilter(List.of(fieldChange("description")), List.of("columns"), null));

    // exclude set -> everything but the listed fields fires.
    assertFalse(
        invokeFilter(
            List.of(fieldChange("columns.campaign_id.extension")), null, List.of("columns")));
    assertTrue(invokeFilter(List.of(fieldChange("description")), null, List.of("columns")));
  }

  @Test
  void testMultipleChangedFieldsPassIfAnyMatchesTriggerFields() throws Exception {
    List<FieldChange> changes = List.of(fieldChange("updatedAt"), fieldChange("schema"));

    assertTrue(invokeFilterFor("dataContract", changes, null, null));
  }

  @Test
  void testEmptyChangedFieldsReturnsFalse() throws Exception {
    assertFalse(invokeFilter(List.of(), null, null));
  }

  @Test
  void testAllChangedFieldsNonTriggerReturnsFalse() throws Exception {
    List<FieldChange> changes = List.of(fieldChange("updatedAt"), fieldChange("version"));

    assertFalse(invokeFilter(changes, null, null));
  }

  @Test
  void testNestedFieldMatchesParentTriggerField() throws Exception {
    assertTrue(
        invokeFilterFor("dataContract", List.of(fieldChange("sla.refreshFrequency")), null, null));
    assertTrue(invokeFilterFor("dataContract", List.of(fieldChange("sla.maxLatency")), null, null));
    assertTrue(
        invokeFilterFor("dataContract", List.of(fieldChange("semantics.0.ruleName")), null, null));
    assertTrue(
        invokeFilterFor("dataContract", List.of(fieldChange("schema.0.dataType")), null, null));
    assertTrue(
        invokeFilterFor(
            "dataContract", List.of(fieldChange("security.dataClassification")), null, null));
  }

  @Test
  void testNestedFieldDoesNotMatchSimilarPrefix() throws Exception {
    assertFalse(invokeFilterFor("dataContract", List.of(fieldChange("slaSpecial")), null, null));
    assertFalse(invokeFilterFor("dataContract", List.of(fieldChange("schemaVersion")), null, null));
    assertFalse(invokeFilterFor("dataContract", List.of(fieldChange("tagsExtra")), null, null));
  }

  @Test
  void testNestedFieldIncludeFilter() throws Exception {
    List<String> includeFields = List.of("sla");

    assertTrue(
        invokeFilterFor(
            "dataContract", List.of(fieldChange("sla.refreshFrequency")), includeFields, null));
    assertTrue(invokeFilterFor("dataContract", List.of(fieldChange("sla")), includeFields, null));
    assertFalse(
        invokeFilterFor("dataContract", List.of(fieldChange("schema")), includeFields, null));
  }

  @Test
  void testNestedFieldExcludeFilter() throws Exception {
    List<String> excludeFields = List.of("sla");

    assertFalse(
        invokeFilterFor(
            "dataContract", List.of(fieldChange("sla.refreshFrequency")), null, excludeFields));
    assertFalse(invokeFilterFor("dataContract", List.of(fieldChange("sla")), null, excludeFields));
    assertTrue(
        invokeFilterFor("dataContract", List.of(fieldChange("schema")), null, excludeFields));
  }

  // sanitizeFilterValue: guards against the historical UI bug where an incomplete
  // filter tree was serialized as a JSON-encoded empty string \"\" and persisted
  // per entity in the trigger config. Also handles \"{}\" and whitespace forms.

  @Test
  void testSanitizeFilterValueTreatsNullAsNoFilter() throws Exception {
    assertNull(invokeSanitize(null));
  }

  @Test
  void testSanitizeFilterValueTreatsEmptyStringAsNoFilter() throws Exception {
    assertNull(invokeSanitize(""));
    assertNull(invokeSanitize("   "));
  }

  @Test
  void testSanitizeFilterValueTreatsJsonEncodedEmptyAsNoFilter() throws Exception {
    assertNull(invokeSanitize("\"\""));
    assertNull(invokeSanitize("  \"\"  "));
  }

  @Test
  void testSanitizeFilterValueTreatsEmptyObjectAsNoFilter() throws Exception {
    assertNull(invokeSanitize("{}"));
    assertNull(invokeSanitize("  {}  "));
  }

  @Test
  void testSanitizeFilterValuePreservesRealFilter() throws Exception {
    String filter = "{\"==\":[{\"var\":\"name\"},\"foo\"]}";
    assertEquals(filter, invokeSanitize(filter));
  }

  // extractFromFilterMap: entity-specific value wins over default; poisoned values
  // are skipped instead of leaking into RuleEngine (which fails and would flip the
  // exclusion filter's fail-open semantics into a hard reject).

  @Test
  void testExtractFromFilterMapPrefersEntitySpecificOverDefault() throws Exception {
    Map<String, String> map = new HashMap<>();
    map.put("default", "{\"==\":[1,1]}");
    map.put("glossaryTerm", "{\"==\":[{\"var\":\"name\"},\"foo\"]}");
    assertEquals("{\"==\":[{\"var\":\"name\"},\"foo\"]}", invokeExtract(map, "glossaryTerm"));
  }

  @Test
  void testExtractFromFilterMapFallsBackToDefault() throws Exception {
    Map<String, String> map = new HashMap<>();
    map.put("default", "{\"==\":[1,1]}");
    assertEquals("{\"==\":[1,1]}", invokeExtract(map, "glossaryTerm"));
  }

  @Test
  void testExtractFromFilterMapPoisonedEntitySpecificFallsBackToDefault() throws Exception {
    Map<String, String> map = new HashMap<>();
    map.put("default", "{\"==\":[1,1]}");
    map.put("glossaryTerm", "\"\"");
    assertEquals("{\"==\":[1,1]}", invokeExtract(map, "glossaryTerm"));
  }

  @Test
  void testExtractFromFilterMapAllPoisonedReturnsNull() throws Exception {
    Map<String, String> map = new HashMap<>();
    map.put("default", "\"\"");
    map.put("glossaryTerm", "\"\"");
    assertNull(invokeExtract(map, "glossaryTerm"));
  }

  @Test
  void testExtractFromFilterMapEmptyMapReturnsNull() throws Exception {
    assertNull(invokeExtract(new HashMap<>(), "glossaryTerm"));
  }

  private boolean invokeFilter(
      List<FieldChange> changedFields, List<String> includeFields, List<String> excludeFields)
      throws Exception {
    // Common trigger fields are recognized for every entity type; "table" is a representative one.
    return invokeFilterFor("table", changedFields, includeFields, excludeFields);
  }

  private boolean invokeFilterFor(
      String entityType,
      List<FieldChange> changedFields,
      List<String> includeFields,
      List<String> excludeFields)
      throws Exception {
    return (boolean)
        passesFieldBasedFilter.invoke(
            filterEntity, entityType, changedFields, includeFields, excludeFields);
  }

  private String invokeSanitize(String filter) throws Exception {
    return WorkflowTriggerFilters.sanitizeFilterValue(filter);
  }

  private String invokeExtract(Map<String, String> map, String entityType) throws Exception {
    return WorkflowTriggerFilters.extractEntitySpecificFilter(map, entityType);
  }

  private FieldChange fieldChange(String name) {
    FieldChange fc = new FieldChange();
    fc.setName(name);
    return fc;
  }
}

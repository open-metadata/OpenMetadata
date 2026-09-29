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

package org.openmetadata.service.governance.workflows.elements.triggers.impl;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.lang.reflect.Method;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.type.FieldChange;

class FilterEntityImplTest {

  private FilterEntityImpl filterEntity;
  private Method passesFieldBasedFilter;
  private Method sanitizeFilterValue;
  private Method extractFromFilterMap;

  @BeforeEach
  void setUp() throws Exception {
    filterEntity = new FilterEntityImpl();
    passesFieldBasedFilter =
        FilterEntityImpl.class.getDeclaredMethod(
            "passesFieldBasedFilter", String.class, List.class, List.class, List.class);
    passesFieldBasedFilter.setAccessible(true);
    sanitizeFilterValue =
        FilterEntityImpl.class.getDeclaredMethod("sanitizeFilterValue", String.class);
    sanitizeFilterValue.setAccessible(true);
    extractFromFilterMap =
        FilterEntityImpl.class.getDeclaredMethod("extractFromFilterMap", Map.class, String.class);
    extractFromFilterMap.setAccessible(true);
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

  @Test
  void testUnknownFieldIsNotRecognizedAsTriggerField() throws Exception {
    assertFalse(invokeFilter(List.of(fieldChange("someUnknownField")), null, null));
    assertFalse(invokeFilter(List.of(fieldChange("updatedAt")), null, null));
    assertFalse(invokeFilter(List.of(fieldChange("version")), null, null));
    assertFalse(invokeFilter(List.of(fieldChange("href")), null, null));
  }

  @Test
  void testEntityStatusIsRecognizedAsTriggerField() throws Exception {
    assertTrue(invokeFilter(List.of(fieldChange("entityStatus")), null, null));
  }

  @Test
  void testEntityStatusCanBeExcludedPerWorkflow() throws Exception {
    List<String> excludeStatus = List.of("entityStatus");
    assertFalse(invokeFilter(List.of(fieldChange("entityStatus")), null, excludeStatus));
    assertTrue(
        invokeFilter(
            List.of(fieldChange("entityStatus"), fieldChange("description")), null, excludeStatus));
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
    return (String) sanitizeFilterValue.invoke(null, filter);
  }

  private String invokeExtract(Map<String, String> map, String entityType) throws Exception {
    return (String) extractFromFilterMap.invoke(filterEntity, map, entityType);
  }

  private FieldChange fieldChange(String name) {
    FieldChange fc = new FieldChange();
    fc.setName(name);
    return fc;
  }
}

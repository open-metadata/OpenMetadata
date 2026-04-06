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

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.lang.reflect.Method;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.type.FieldChange;

class FilterEntityImplTest {

  private FilterEntityImpl filterEntity;
  private Method passesFieldBasedFilter;

  @BeforeEach
  void setUp() throws Exception {
    filterEntity = new FilterEntityImpl();
    passesFieldBasedFilter =
        FilterEntityImpl.class.getDeclaredMethod(
            "passesFieldBasedFilter", List.class, List.class, List.class);
    passesFieldBasedFilter.setAccessible(true);
  }

  @Test
  void testExistingFieldsAreRecognizedAsTriggerFields() throws Exception {
    List<String> existingFields =
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
            "deleted",
            "synonyms",
            "relatedTerms",
            "references",
            "glossary",
            "parent",
            "children",
            "experts");

    for (String field : existingFields) {
      assertTrue(
          invokeFilter(List.of(fieldChange(field)), null, null),
          "Existing field should trigger workflow: " + field);
    }
  }

  @Test
  void testNewCommonFieldsAreRecognizedAsTriggerFields() throws Exception {
    assertTrue(invokeFilter(List.of(fieldChange("style")), null, null));
    assertTrue(invokeFilter(List.of(fieldChange("lifeCycle")), null, null));
  }

  @Test
  void testNewDataContractFieldsAreRecognizedAsTriggerFields() throws Exception {
    assertTrue(invokeFilter(List.of(fieldChange("schema")), null, null));
    assertTrue(invokeFilter(List.of(fieldChange("semantics")), null, null));
    assertTrue(invokeFilter(List.of(fieldChange("qualityExpectations")), null, null));
    assertTrue(invokeFilter(List.of(fieldChange("termsOfUse")), null, null));
    assertTrue(invokeFilter(List.of(fieldChange("security")), null, null));
    assertTrue(invokeFilter(List.of(fieldChange("sla")), null, null));
    assertTrue(invokeFilter(List.of(fieldChange("testSuite")), null, null));
    assertTrue(invokeFilter(List.of(fieldChange("latestResult")), null, null));
  }

  @Test
  void testNewDataProductFieldsAreRecognizedAsTriggerFields() throws Exception {
    assertTrue(invokeFilter(List.of(fieldChange("consumesFrom")), null, null));
    assertTrue(invokeFilter(List.of(fieldChange("providesTo")), null, null));
    assertTrue(invokeFilter(List.of(fieldChange("lifecycleStage")), null, null));
  }

  @Test
  void testUnknownFieldIsNotRecognizedAsTriggerField() throws Exception {
    assertFalse(invokeFilter(List.of(fieldChange("someUnknownField")), null, null));
    assertFalse(invokeFilter(List.of(fieldChange("updatedAt")), null, null));
    assertFalse(invokeFilter(List.of(fieldChange("version")), null, null));
    assertFalse(invokeFilter(List.of(fieldChange("href")), null, null));
    assertFalse(invokeFilter(List.of(fieldChange("entityStatus")), null, null));
  }

  @Test
  void testIncludeFilterAllowsOnlySpecifiedFields() throws Exception {
    List<String> includeFields = List.of("sla", "schema");

    assertTrue(invokeFilter(List.of(fieldChange("sla")), includeFields, null));
    assertTrue(invokeFilter(List.of(fieldChange("schema")), includeFields, null));
    assertFalse(invokeFilter(List.of(fieldChange("semantics")), includeFields, null));
    assertFalse(invokeFilter(List.of(fieldChange("tags")), includeFields, null));
  }

  @Test
  void testExcludeFilterBlocksSpecifiedFields() throws Exception {
    List<String> excludeFields = List.of("sla", "latestResult");

    assertFalse(invokeFilter(List.of(fieldChange("sla")), null, excludeFields));
    assertFalse(invokeFilter(List.of(fieldChange("latestResult")), null, excludeFields));
    assertTrue(invokeFilter(List.of(fieldChange("schema")), null, excludeFields));
    assertTrue(invokeFilter(List.of(fieldChange("semantics")), null, excludeFields));
  }

  @Test
  void testIncludeFilterTakesPriorityOverExcludeFilter() throws Exception {
    List<String> includeFields = List.of("sla");
    List<String> excludeFields = List.of("sla");

    assertTrue(invokeFilter(List.of(fieldChange("sla")), includeFields, excludeFields));
  }

  @Test
  void testMultipleChangedFieldsPassIfAnyMatchesTriggerFields() throws Exception {
    List<FieldChange> changes = List.of(fieldChange("updatedAt"), fieldChange("schema"));

    assertTrue(invokeFilter(changes, null, null));
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
    assertTrue(invokeFilter(List.of(fieldChange("sla.refreshFrequency")), null, null));
    assertTrue(invokeFilter(List.of(fieldChange("sla.maxLatency")), null, null));
    assertTrue(invokeFilter(List.of(fieldChange("semantics.0.ruleName")), null, null));
    assertTrue(invokeFilter(List.of(fieldChange("schema.0.dataType")), null, null));
    assertTrue(invokeFilter(List.of(fieldChange("security.dataClassification")), null, null));
  }

  @Test
  void testNestedFieldDoesNotMatchSimilarPrefix() throws Exception {
    assertFalse(invokeFilter(List.of(fieldChange("slaSpecial")), null, null));
    assertFalse(invokeFilter(List.of(fieldChange("schemaVersion")), null, null));
    assertFalse(invokeFilter(List.of(fieldChange("tagsExtra")), null, null));
  }

  @Test
  void testNestedFieldIncludeFilter() throws Exception {
    List<String> includeFields = List.of("sla");

    assertTrue(invokeFilter(List.of(fieldChange("sla.refreshFrequency")), includeFields, null));
    assertTrue(invokeFilter(List.of(fieldChange("sla")), includeFields, null));
    assertFalse(invokeFilter(List.of(fieldChange("schema")), includeFields, null));
  }

  @Test
  void testNestedFieldExcludeFilter() throws Exception {
    List<String> excludeFields = List.of("sla");

    assertFalse(invokeFilter(List.of(fieldChange("sla.refreshFrequency")), null, excludeFields));
    assertFalse(invokeFilter(List.of(fieldChange("sla")), null, excludeFields));
    assertTrue(invokeFilter(List.of(fieldChange("schema")), null, excludeFields));
  }

  private boolean invokeFilter(
      List<FieldChange> changedFields, List<String> includeFields, List<String> excludeFields)
      throws Exception {
    return (boolean)
        passesFieldBasedFilter.invoke(filterEntity, changedFields, includeFields, excludeFields);
  }

  private FieldChange fieldChange(String name) {
    FieldChange fc = new FieldChange();
    fc.setName(name);
    return fc;
  }
}

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

import static org.junit.jupiter.api.Assertions.assertEquals;

import java.lang.reflect.Field;
import java.lang.reflect.Method;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.openmetadata.service.governance.workflows.elements.nodes.automatedTask.impl.DataCompletenessImpl.QualityBand;

/**
 * Pins how the Data Completeness node scores custom properties.
 *
 * <p>Custom properties are stored under {@code extension.<name>}, but the workflow builder's field
 * picker emits the bare property name (e.g. {@code HyperLinkTest}). Before the extension fallback, a
 * bare name never resolved and every custom property was scored as missing, so a workflow gated on a
 * custom property (e.g. a certification flow) could never reach its target band. These tests exercise
 * the field resolution directly, without the Flowable engine.
 */
class DataCompletenessImplTest {

  private DataCompletenessImpl dataCompleteness;
  private Method calculateCompleteness;
  private Field scoreField;
  private Field filledFieldsCountField;

  private final List<QualityBand> bands = List.of(band("Gold", 100.0), band("None", 0.0));

  @BeforeEach
  void setUp() throws Exception {
    dataCompleteness = new DataCompletenessImpl();
    calculateCompleteness =
        DataCompletenessImpl.class.getDeclaredMethod(
            "calculateCompleteness", Map.class, List.class, List.class);
    calculateCompleteness.setAccessible(true);
    Class<?> resultClass =
        Class.forName(
            "org.openmetadata.service.governance.workflows.elements.nodes.automatedTask.impl.DataCompletenessImpl$DataCompletenessResult");
    scoreField = resultClass.getDeclaredField("score");
    scoreField.setAccessible(true);
    filledFieldsCountField = resultClass.getDeclaredField("filledFieldsCount");
    filledFieldsCountField.setAccessible(true);
  }

  @Test
  void testBareCustomPropertyResolvedUnderExtension() throws Exception {
    // The picker stores "HyperLinkTest"; the value lives at extension.HyperLinkTest.
    Map<String, Object> entity =
        entityWithExtension(Map.of("HyperLinkTest", "https://example.com"));

    Object result =
        calculateCompleteness.invoke(dataCompleteness, entity, List.of("HyperLinkTest"), bands);

    assertEquals(
        1, filledFieldsCount(result), "Bare custom property should resolve under extension");
    assertEquals(100.0, score(result), 0.001);
  }

  @Test
  void testMissingCustomPropertyCountedMissing() throws Exception {
    // Custom property declared on the type but never filled in on the entity.
    Map<String, Object> entity = entityWithExtension(new HashMap<>());

    Object result =
        calculateCompleteness.invoke(dataCompleteness, entity, List.of("HyperLinkTest"), bands);

    assertEquals(
        0, filledFieldsCount(result), "Absent custom property must still count as missing");
    assertEquals(0.0, score(result), 0.001);
  }

  @Test
  void testExplicitExtensionPathStillWorks() throws Exception {
    // Callers that already prefix extension. (query builder, older configs) must keep working.
    Map<String, Object> entity =
        entityWithExtension(Map.of("HyperLinkTest", "https://example.com"));

    Object result =
        calculateCompleteness.invoke(
            dataCompleteness, entity, List.of("extension.HyperLinkTest"), bands);

    assertEquals(1, filledFieldsCount(result));
    assertEquals(100.0, score(result), 0.001);
  }

  @Test
  void testStandardTopLevelFieldUnaffected() throws Exception {
    Map<String, Object> entity =
        entityWithExtension(Map.of("HyperLinkTest", "https://example.com"));
    entity.put("description", "a real description");

    Object result =
        calculateCompleteness.invoke(dataCompleteness, entity, List.of("description"), bands);

    assertEquals(
        1, filledFieldsCount(result), "Standard field must resolve at top level, not extension");
  }

  @Test
  void testNestedStandardPathNotDivertedToExtension() throws Exception {
    // "columns.description" must be read from the real columns array, never rewritten to extension.
    Map<String, Object> column = new HashMap<>();
    column.put("name", "id");
    column.put("description", "primary key");
    Map<String, Object> entity = entityWithExtension(Map.of("columns", "ignored"));
    entity.put("columns", List.of(column));

    Object result =
        calculateCompleteness.invoke(
            dataCompleteness, entity, List.of("columns.description"), bands);

    assertEquals(1, filledFieldsCount(result));
  }

  private Map<String, Object> entityWithExtension(Map<String, Object> extension) {
    Map<String, Object> entity = new HashMap<>();
    entity.put("extension", new HashMap<>(extension));
    return entity;
  }

  private int filledFieldsCount(Object result) throws Exception {
    return (int) filledFieldsCountField.get(result);
  }

  private double score(Object result) throws Exception {
    return (double) scoreField.get(result);
  }

  private static QualityBand band(String name, double minimumScore) {
    QualityBand band = new QualityBand();
    band.setName(name);
    band.setMinimumScore(minimumScore);
    return band;
  }
}

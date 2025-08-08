/*
 *  Copyright 2021 Collate
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

package org.openmetadata.dsl;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.when;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mock;
import org.mockito.MockitoAnnotations;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.type.ChangeEvent;

public class OpenMetadataDSLTest {

  private OpenMetadataDSL dsl;

  @Mock private ChangeEvent changeEvent;

  @Mock private EntityInterface entity;

  @BeforeEach
  void setUp() {
    MockitoAnnotations.openMocks(this);
    dsl = new OpenMetadataDSL();
  }

  @Test
  void testLiteralExpressions() {
    assertEquals("hello", dsl.evaluate("'hello'", changeEvent, entity));
    assertEquals(42.0, dsl.evaluate("42", changeEvent, entity));
    assertEquals(true, dsl.evaluate("true", changeEvent, entity));
    assertNull(dsl.evaluate("null", changeEvent, entity));
  }

  @Test
  void testBooleanConditions() {
    assertTrue(dsl.evaluateCondition("true", changeEvent, entity));
    assertFalse(dsl.evaluateCondition("false", changeEvent, entity));
    assertTrue(dsl.evaluateCondition("true AND true", changeEvent, entity));
    assertFalse(dsl.evaluateCondition("true AND false", changeEvent, entity));
    assertTrue(dsl.evaluateCondition("true OR false", changeEvent, entity));
    assertFalse(dsl.evaluateCondition("false OR false", changeEvent, entity));
  }

  @Test
  void testArithmeticOperations() {
    assertEquals(7.0, dsl.evaluate("3 + 4", changeEvent, entity));
    assertEquals(12.0, dsl.evaluate("3 * 4", changeEvent, entity));
    assertEquals(-1.0, dsl.evaluate("3 - 4", changeEvent, entity));
    assertEquals(0.75, dsl.evaluate("3 / 4", changeEvent, entity));
  }

  @Test
  void testComparisonOperations() {
    assertTrue(dsl.evaluateCondition("5 > 3", changeEvent, entity));
    assertFalse(dsl.evaluateCondition("3 > 5", changeEvent, entity));
    assertTrue(dsl.evaluateCondition("5 >= 5", changeEvent, entity));
    assertTrue(dsl.evaluateCondition("3 < 5", changeEvent, entity));
    assertTrue(dsl.evaluateCondition("5 <= 5", changeEvent, entity));
    assertTrue(dsl.evaluateCondition("5 == 5", changeEvent, entity));
    assertTrue(dsl.evaluateCondition("5 != 3", changeEvent, entity));
  }

  @Test
  void testStringOperations() {
    assertEquals("hello world", dsl.evaluate("'hello' + ' world'", changeEvent, entity));
    assertTrue(dsl.evaluateCondition("'test' == 'test'", changeEvent, entity));
    assertFalse(dsl.evaluateCondition("'test' == 'other'", changeEvent, entity));
  }

  @Test
  void testBuiltInFunctions() {
    assertEquals(5, dsl.evaluate("length('hello')", changeEvent, entity));
    assertTrue(dsl.evaluateCondition("contains('hello world', 'world')", changeEvent, entity));
    assertFalse(dsl.evaluateCondition("contains('hello', 'world')", changeEvent, entity));
    assertTrue(dsl.evaluateCondition("startsWith('hello world', 'hello')", changeEvent, entity));
    assertTrue(dsl.evaluateCondition("endsWith('hello world', 'world')", changeEvent, entity));
    assertTrue(dsl.evaluateCondition("isEmpty('')", changeEvent, entity));
    assertFalse(dsl.evaluateCondition("isEmpty('test')", changeEvent, entity));
  }

  @Test
  void testComplexExpressions() {
    String expr = "length('test') > 3 AND contains('hello world', 'world')";
    assertTrue(dsl.evaluateCondition(expr, changeEvent, entity));

    String expr2 = "(5 + 3) * 2 == 16";
    assertTrue(dsl.evaluateCondition(expr2, changeEvent, entity));
  }

  @Test
  void testFieldAccess() {
    when(entity.getName()).thenReturn("test_table");

    String expr = "entity.name == 'test_table'";
    assertTrue(dsl.evaluateCondition(expr, changeEvent, entity));
  }

  @Test
  void testExpressionValidation() {
    assertTrue(dsl.isValidExpression("true"));
    assertTrue(dsl.isValidExpression("5 + 3"));
    assertTrue(dsl.isValidExpression("entity.name == 'test'"));
  }

  @Test
  void testExpressionCaching() {
    assertEquals(0, dsl.getCacheSize());

    dsl.compile("true");
    assertEquals(1, dsl.getCacheSize());

    dsl.compile("true");
    assertEquals(1, dsl.getCacheSize());

    dsl.compile("false");
    assertEquals(2, dsl.getCacheSize());

    dsl.clearCache();
    assertEquals(0, dsl.getCacheSize());
  }
}

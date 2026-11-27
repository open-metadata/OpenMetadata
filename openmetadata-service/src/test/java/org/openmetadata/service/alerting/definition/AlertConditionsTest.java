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

package org.openmetadata.service.alerting.definition;

import static org.junit.jupiter.api.Assertions.assertEquals;

import java.util.List;
import org.junit.jupiter.api.Test;

class AlertConditionsTest {

  @Test
  void testConvertInputListToString_withSingleQuotes() {
    List<String> input = List.of("Jake's test bundle");
    String result = AlertConditions.convertInputListToString(input);
    assertEquals("'Jake''s test bundle'", result);
  }

  @Test
  void testConvertInputListToString_multipleSingleQuotes() {
    List<String> input = List.of("It's Jake's test");
    String result = AlertConditions.convertInputListToString(input);
    assertEquals("'It''s Jake''s test'", result);
  }

  @Test
  void testConvertInputListToString_multipleValuesWithQuotes() {
    List<String> input = List.of("Jake's bundle", "Mary's suite");
    String result = AlertConditions.convertInputListToString(input);
    assertEquals("'Jake''s bundle','Mary''s suite'", result);
  }

  @Test
  void testConvertInputListToString_noQuotes() {
    List<String> input = List.of("normal_name", "another_name");
    String result = AlertConditions.convertInputListToString(input);
    assertEquals("'normal_name','another_name'", result);
  }

  @Test
  void testConvertInputListToString_emptyList() {
    String result = AlertConditions.convertInputListToString(List.of());
    assertEquals("", result);
  }

  @Test
  void testConvertInputListToString_nullList() {
    String result = AlertConditions.convertInputListToString(null);
    assertEquals("", result);
  }

  @Test
  void testConvertInputListToString_singleValue() {
    List<String> input = List.of("single_value");
    String result = AlertConditions.convertInputListToString(input);
    assertEquals("'single_value'", result);
  }

  @Test
  void testConvertInputListToString_onlyQuote() {
    List<String> input = List.of("'");
    String result = AlertConditions.convertInputListToString(input);
    assertEquals("''''", result);
  }

  @Test
  void testConvertInputListToString_consecutiveQuotes() {
    List<String> input = List.of("test''value");
    String result = AlertConditions.convertInputListToString(input);
    assertEquals("'test''''value'", result);
  }
}

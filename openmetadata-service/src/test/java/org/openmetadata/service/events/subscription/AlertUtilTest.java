package org.openmetadata.service.events.subscription;

import static org.junit.jupiter.api.Assertions.assertEquals;

import java.util.List;
import org.junit.jupiter.api.Test;

class AlertUtilTest {

  @Test
  void testConvertInputListToString_withSingleQuotes() {
    List<String> input = List.of("Jake's test bundle");
    String result = AlertUtil.convertInputListToString(input);
    assertEquals("'Jake''s test bundle'", result);
  }

  @Test
  void testConvertInputListToString_multipleSingleQuotes() {
    List<String> input = List.of("It's Jake's test");
    String result = AlertUtil.convertInputListToString(input);
    assertEquals("'It''s Jake''s test'", result);
  }

  @Test
  void testConvertInputListToString_multipleValuesWithQuotes() {
    List<String> input = List.of("Jake's bundle", "Mary's suite");
    String result = AlertUtil.convertInputListToString(input);
    assertEquals("'Jake''s bundle','Mary''s suite'", result);
  }

  @Test
  void testConvertInputListToString_noQuotes() {
    List<String> input = List.of("normal_name", "another_name");
    String result = AlertUtil.convertInputListToString(input);
    assertEquals("'normal_name','another_name'", result);
  }

  @Test
  void testConvertInputListToString_emptyList() {
    String result = AlertUtil.convertInputListToString(List.of());
    assertEquals("", result);
  }

  @Test
  void testConvertInputListToString_nullList() {
    String result = AlertUtil.convertInputListToString(null);
    assertEquals("", result);
  }

  @Test
  void testConvertInputListToString_singleValue() {
    List<String> input = List.of("single_value");
    String result = AlertUtil.convertInputListToString(input);
    assertEquals("'single_value'", result);
  }

  @Test
  void testConvertInputListToString_onlyQuote() {
    List<String> input = List.of("'");
    String result = AlertUtil.convertInputListToString(input);
    assertEquals("''''", result);
  }

  @Test
  void testConvertInputListToString_consecutiveQuotes() {
    List<String> input = List.of("test''value");
    String result = AlertUtil.convertInputListToString(input);
    assertEquals("'test''''value'", result);
  }
}

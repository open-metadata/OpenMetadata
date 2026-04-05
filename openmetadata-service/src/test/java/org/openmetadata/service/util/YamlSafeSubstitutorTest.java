package org.openmetadata.service.util;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import org.apache.commons.text.TextStringBuilder;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.params.provider.ValueSource;

class YamlSafeSubstitutorTest {

  @ParameterizedTest
  @CsvSource(
      value = {
        "plainvalue, false",
        "value_with_underscore, false",
        "value-with-hyphen, false",
        "12345, false",
        "'', false",
        "'>value', true",
        "'|value', true",
        "'*value', true",
        "'&value', true",
        "'!value', true",
        "'%value', true",
        "'@value', true",
        "'`value', true",
        "''value', true",
        "'\"value', true",
        "'{value', true",
        "'[value', true",
        "'?value', true",
        "',value', true",
        "'#value', true",
        "'- value', true",
        "'-value', false",
        "'value #comment', true",
        "'value#nocomment', false",
        "'key: value', true",
        "'key:', true",
        "' key', true",
        "'key ', true",
        "'val\nval', true",
        "'val\rval', true",
        "'[flow, sequence]', false",
        "'{flow: mapping}', false",
        "' \"already_quoted\"', false",
        "\"'already_quoted'\", false"
      },
      nullValues = {"NULL"})
  void testNeedsYamlQuoting(String value, boolean expected) {
    assertEquals(expected, YamlSafeSubstitutor.needsYamlQuoting(value));
  }

  @ParameterizedTest
  @CsvSource({
    "'>value', \">                value\"",
    "'|value', \"|value\"",
    "'#value', \"#value\"",
    "'key: value', \"key: value\"",
    "' val ', \" val \"",
    "'val\nval', \"val\\nval\"",
    "'val\"quote', \"val\\\"quote\"",
    "'val\\back', \"val\\\\back\""
  })
  void testYamlDoubleQuote(String input, String expected) {
    assertEquals(expected, YamlSafeSubstitutor.yamlDoubleQuote(input));
  }

  @Test
  void testIsInlineSubstitution() {
    TextStringBuilder buf = new TextStringBuilder("jdbc:${DB_SCHEME}://localhost");
    // ${DB_SCHEME} is at [5, 17)
    assertTrue(YamlSafeSubstitutor.isInlineSubstitution(buf, 5, 17));

    buf = new TextStringBuilder("${DB_SCHEME}");
    assertFalse(YamlSafeSubstitutor.isInlineSubstitution(buf, 0, 12));

    buf = new TextStringBuilder("  ${DB_SCHEME}  ");
    assertFalse(YamlSafeSubstitutor.isInlineSubstitution(buf, 2, 14));

    buf = new TextStringBuilder("prefix${DB_SCHEME}");
    assertTrue(YamlSafeSubstitutor.isInlineSubstitution(buf, 6, 18));

    buf = new TextStringBuilder("${DB_SCHEME}suffix");
    assertTrue(YamlSafeSubstitutor.isInlineSubstitution(buf, 0, 12));
  }
}

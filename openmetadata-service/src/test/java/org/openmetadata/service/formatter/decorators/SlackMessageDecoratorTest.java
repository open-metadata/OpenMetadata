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

package org.openmetadata.service.formatter.decorators;

import static org.junit.jupiter.api.Assertions.*;
import static org.openmetadata.service.util.EntityUtil.encodeEntityFqnSafe;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

/**
 * Test class for SlackMessageDecorator, focusing on the URL encoding fix for Slack events.
 * This test validates that the encodeEntityFqnSafe method properly handles URL encoding
 * to prevent issues with email security systems like Outlook SafeLinks.
 */
public class SlackMessageDecoratorTest {

  @Test
  void testEncodeEntityFqnSafe_ComplexFqnFromDatabricks() {
    // Test the specific Databricks FQN that was causing issues
    String complexFqn = "Random.pro.silver.l0_purchase_order.TOs con curr INR tery dd ser INR";
    String encoded = encodeEntityFqnSafe(complexFqn);

    // Verify the encoding is correct
    assertEquals(
        "Random.pro.silver.l0_purchase_order.TOs%20con%20curr%20INR%20tery%20dd%20ser%20INR",
        encoded);

    // Verify no unencoded spaces remain
    assertFalse(encoded.contains(" "));

    // Verify spaces are properly encoded
    assertTrue(encoded.contains("%20"));
  }

  @Test
  void testEncodeEntityFqnSafe_NullAndEmptyHandling() {
    // Test null input
    assertEquals("", encodeEntityFqnSafe(null));

    // Test empty input
    assertEquals("", encodeEntityFqnSafe(""));

    // Test whitespace only
    assertEquals("", encodeEntityFqnSafe("   "));
  }

  @Test
  void testEncodeEntityFqnSafe_SimpleNames() {
    // Test simple names without special characters
    assertEquals("simple", encodeEntityFqnSafe("simple"));
    assertEquals("database.table", encodeEntityFqnSafe("database.table"));
    assertEquals(
        "service.database.schema.table", encodeEntityFqnSafe("service.database.schema.table"));
  }

  @ParameterizedTest
  @CsvSource({
    "'hello world', 'hello%20world'",
    "'test#hash', 'test%23hash'",
    "'query?param', 'query%3Fparam'",
    "'data&info', 'data%26info'",
    "'value+plus', 'value%2Bplus'",
    "'key=value', 'key%3Dvalue'",
    "'path/to/resource', 'path%2Fto%2Fresource'",
    "'back\\slash', 'back%5Cslash'",
    "'pipe|separated', 'pipe%7Cseparated'",
    "'\"quoted\"', '%22quoted%22'",
    "'''single''', '%27single%27'",
    "'<tag>', '%3Ctag%3E'",
    "'[bracket]', '%5Bbracket%5D'",
    "'{brace}', '%7Bbrace%7D'"
  })
  void testEncodeEntityFqnSafe_SpecialCharacters(String input, String expected) {
    assertEquals(expected, encodeEntityFqnSafe(input));
  }

  @Test
  void testEncodeEntityFqnSafe_EmailSecurityCompatibility() {
    // Test FQN that would be problematic with email security systems
    String problematicFqn = "Table Name & Data #1 + Test?param=value";
    String encoded = encodeEntityFqnSafe(problematicFqn);

    // Verify all problematic characters are encoded
    assertFalse(encoded.contains(" ")); // spaces
    assertFalse(encoded.contains("&")); // ampersand
    assertFalse(encoded.contains("#")); // hash
    assertFalse(encoded.contains("?")); // question mark
    assertFalse(encoded.contains("=")); // equals
    assertFalse(encoded.contains("+")); // plus

    String expected = "Table%20Name%20%26%20Data%20%231%20%2B%20Test%3Fparam%3Dvalue";
    assertEquals(expected, encoded);
  }

  @Test
  void testEncodeEntityFqnSafe_AvoidDoubleEncoding() {
    // Test that already encoded percent signs are handled correctly
    String inputWithPercent = "test%already%encoded";
    String encoded = encodeEntityFqnSafe(inputWithPercent);

    // The percent signs should be encoded to %25 to prevent double-encoding
    assertEquals("test%25already%25encoded", encoded);
  }

  @Test
  void testEncodeEntityFqnSafe_PreservesRegularCharacters() {
    // Test that alphanumeric characters and dots are preserved
    String regularFqn = "service123.database_name.schema-name.table.column";
    assertEquals(regularFqn, encodeEntityFqnSafe(regularFqn));
  }

  @Test
  void testEncodeEntityFqnSafe_MixedContent() {
    // Test mixed content with various special characters
    String mixed = "Test Table & Data #1 with (special) chars?";
    String encoded = encodeEntityFqnSafe(mixed);
    String expected = "Test%20Table%20%26%20Data%20%231%20with%20(special)%20chars%3F";
    assertEquals(expected, encoded);
  }

  @Test
  void testEncodeEntityFqnSafe_WhitespaceHandling() {
    // Test various whitespace scenarios
    assertEquals("test%20name", encodeEntityFqnSafe("test name"));
    assertEquals("test%20%20double", encodeEntityFqnSafe("test  double"));
    assertEquals("leading%20space", encodeEntityFqnSafe(" leading space"));
    assertEquals("trailing%20space", encodeEntityFqnSafe("trailing space "));
  }

  @Test
  void testEncodeEntityFqnSafe_UnicodeCharacters() {
    // Test that regular Unicode characters are preserved
    String unicodeFqn = "测试.データ.тест";
    assertEquals(unicodeFqn, encodeEntityFqnSafe(unicodeFqn));
  }

  @Test
  void testEncodeEntityFqnSafe_SlackUrlSafetyVerification() {
    // Test that the encoded result is safe for Slack URLs and email systems
    String testFqn = "Complex & FQN with spaces + special?chars=here";
    String encoded = encodeEntityFqnSafe(testFqn);

    // Verify the result contains no characters that could break URLs
    assertFalse(encoded.contains(" "));
    assertFalse(encoded.contains("&"));
    assertFalse(encoded.contains("+"));
    assertFalse(encoded.contains("?"));
    assertFalse(encoded.contains("="));

    // Verify it's properly encoded
    assertTrue(encoded.contains("%20")); // space
    assertTrue(encoded.contains("%26")); // ampersand
    assertTrue(encoded.contains("%2B")); // plus
    assertTrue(encoded.contains("%3F")); // question mark
    assertTrue(encoded.contains("%3D")); // equals
  }
}

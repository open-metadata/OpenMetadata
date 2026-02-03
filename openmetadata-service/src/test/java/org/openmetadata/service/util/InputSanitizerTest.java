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

package org.openmetadata.service.util;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import org.junit.jupiter.api.Test;

class InputSanitizerTest {

  @Test
  void testSanitize_NullInput() {
    assertNull(InputSanitizer.sanitize(null));
  }

  @Test
  void testSanitize_EmptyInput() {
    assertEquals("", InputSanitizer.sanitize(""));
  }

  @Test
  void testSanitize_PlainText() {
    String input = "This is plain text content";
    assertEquals(input, InputSanitizer.sanitize(input));
  }

  @Test
  void testSanitize_ScriptTag() {
    String input = "<script>alert('XSS')</script>";
    String sanitized = InputSanitizer.sanitize(input);
    assertFalse(sanitized.contains("<script>"));
    assertFalse(sanitized.contains("alert"));
  }

  @Test
  void testSanitize_ImgOnerror() {
    String input = "<img src=x onerror=\"alert('XSS')\">";
    String sanitized = InputSanitizer.sanitize(input);
    assertFalse(sanitized.contains("onerror"));
  }

  @Test
  void testSanitize_SvgOnload() {
    String input = "<svg onload=\"alert('XSS')\">";
    String sanitized = InputSanitizer.sanitize(input);
    assertFalse(sanitized.contains("onload"));
    assertFalse(sanitized.contains("<svg"));
  }

  @Test
  void testSanitize_DetailsTag() {
    String input = "<details open ontoggle=\"alert('XSS')\">";
    String sanitized = InputSanitizer.sanitize(input);
    assertFalse(sanitized.contains("ontoggle"));
  }

  @Test
  void testSanitize_JavascriptProtocol() {
    String input = "<a href=\"javascript:alert('XSS')\">click</a>";
    String sanitized = InputSanitizer.sanitize(input);
    assertFalse(sanitized.contains("javascript:"));
  }

  @Test
  void testSanitize_IframeSrc() {
    String input = "<iframe src=\"https://malicious.com\"></iframe>";
    String sanitized = InputSanitizer.sanitize(input);
    assertFalse(sanitized.contains("<iframe"));
  }

  @Test
  void testSanitize_PreserveEntityLinks() {
    String input = "Check out <#E::table::database.schema.table> for details";
    String sanitized = InputSanitizer.sanitize(input);
    assertTrue(sanitized.contains("<#E::table::database.schema.table>"));
  }

  @Test
  void testSanitize_PreserveMultipleEntityLinks() {
    String input =
        "See <#E::table::db.schema.table1> and <#E::database::db> for more";
    String sanitized = InputSanitizer.sanitize(input);
    assertTrue(sanitized.contains("<#E::table::db.schema.table1>"));
    assertTrue(sanitized.contains("<#E::database::db>"));
  }

  @Test
  void testSanitize_EntityLinkWithXss() {
    String input = "<#E::table::test> <script>alert('xss')</script>";
    String sanitized = InputSanitizer.sanitize(input);
    assertTrue(sanitized.contains("<#E::table::test>"));
    assertFalse(sanitized.contains("<script>"));
  }

  @Test
  void testSanitize_AllowSafeHtml() {
    String input = "<p>Hello <strong>world</strong></p>";
    String sanitized = InputSanitizer.sanitize(input);
    assertTrue(sanitized.contains("<p>"));
    assertTrue(sanitized.contains("<strong>"));
  }

  @Test
  void testSanitize_AllowLinks() {
    String input = "<a href=\"https://example.com\" title=\"Example\">Link</a>";
    String sanitized = InputSanitizer.sanitize(input);
    assertTrue(sanitized.contains("<a"));
    assertTrue(sanitized.contains("href"));
  }

  @Test
  void testSanitize_AllowListElements() {
    String input = "<ul><li>Item 1</li><li>Item 2</li></ul>";
    String sanitized = InputSanitizer.sanitize(input);
    assertTrue(sanitized.contains("<ul>"));
    assertTrue(sanitized.contains("<li>"));
  }

  @Test
  void testSanitize_AllowCodeBlocks() {
    String input = "<pre><code>const x = 1;</code></pre>";
    String sanitized = InputSanitizer.sanitize(input);
    assertTrue(sanitized.contains("<pre>"));
    assertTrue(sanitized.contains("<code>"));
  }

  @Test
  void testSanitize_AllowTableElements() {
    String input = "<table><tr><th>Header</th></tr><tr><td>Data</td></tr></table>";
    String sanitized = InputSanitizer.sanitize(input);
    assertTrue(sanitized.contains("<table>"));
    assertTrue(sanitized.contains("<tr>"));
    assertTrue(sanitized.contains("<th>"));
    assertTrue(sanitized.contains("<td>"));
  }

  @Test
  void testSanitize_AllowImages() {
    String input = "<img src=\"https://example.com/img.png\" alt=\"Image\">";
    String sanitized = InputSanitizer.sanitize(input);
    assertTrue(sanitized.contains("<img"));
    assertTrue(sanitized.contains("src="));
    assertTrue(sanitized.contains("alt="));
  }

  @Test
  void testSanitize_BlockDataProtocol() {
    String input = "<img src=\"data:image/svg+xml;base64,PHN2ZyBvbmxvYWQ9YWxlcnQoMSk+\">";
    String sanitized = InputSanitizer.sanitize(input);
    assertFalse(sanitized.contains("data:"));
  }
}

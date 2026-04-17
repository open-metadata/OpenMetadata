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

package org.openmetadata.service.util;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import org.junit.jupiter.api.Test;

class DescriptionSanitizerTest {

  @Test
  void nullInputReturnsNull() {
    assertNull(DescriptionSanitizer.sanitize(null));
  }

  @Test
  void allowedElementsArePreserved() {
    String input = "<p><strong>bold</strong> and <em>italic</em></p>";
    String result = DescriptionSanitizer.sanitize(input);

    assertTrue(result.contains("<strong>bold</strong>"));
    assertTrue(result.contains("<em>italic</em>"));
  }

  @Test
  void scriptTagIsStripped() {
    String result = DescriptionSanitizer.sanitize("<script>alert(1)</script><p>safe</p>");

    assertFalse(result.contains("<script"));
    assertFalse(result.contains("alert(1)"));
    assertTrue(result.contains("safe"));
  }

  @Test
  void imgOnerrorEventHandlerIsStripped() {
    String result =
        DescriptionSanitizer.sanitize("<img src=\"x\" onerror=\"alert(document.cookie)\">");

    assertFalse(result.contains("onerror"));
    assertFalse(result.contains("alert("));
  }

  @Test
  void iframeIsStripped() {
    String result = DescriptionSanitizer.sanitize("<iframe src=\"https://evil.com\"></iframe>safe");

    assertFalse(result.contains("<iframe"));
    assertTrue(result.contains("safe"));
  }

  @Test
  void javascriptHrefIsStripped() {
    String result = DescriptionSanitizer.sanitize("<a href=\"javascript:alert(1)\">click</a>");

    assertFalse(result.contains("javascript:"));
  }

  @Test
  void httpsHrefIsAllowed() {
    String result = DescriptionSanitizer.sanitize("<a href=\"https://example.com\">link</a>");

    assertTrue(result.contains("https://example.com"));
  }

  @Test
  void relativeHrefIsAllowed() {
    String result = DescriptionSanitizer.sanitize("<a href=\"/docs/page\">link</a>");

    assertTrue(result.contains("/docs/page"));
  }

  @Test
  void anchorHrefIsAllowed() {
    String result = DescriptionSanitizer.sanitize("<a href=\"#section\">jump</a>");

    assertTrue(result.contains("#section"));
  }

  @Test
  void targetAttributeIsStripped() {
    String result =
        DescriptionSanitizer.sanitize("<a href=\"https://example.com\" target=\"_blank\">link</a>");

    assertFalse(result.contains("target="));
  }

  @Test
  void safeRelValuesAreAllowed() {
    String result =
        DescriptionSanitizer.sanitize(
            "<a href=\"https://example.com\" rel=\"noopener noreferrer\">link</a>");

    assertTrue(result.contains("noopener noreferrer"));
  }

  @Test
  void unsafeRelValuesAreStripped() {
    String result =
        DescriptionSanitizer.sanitize(
            "<a href=\"https://example.com\" rel=\"stylesheet\">link</a>");

    assertFalse(result.contains("rel=\"stylesheet\""));
  }

  @Test
  void svgDataUriInImgIsStripped() {
    String result =
        DescriptionSanitizer.sanitize("<img src=\"data:image/svg+xml,<svg onload='alert(1)'/>\"/>");

    assertFalse(result.contains("svg+xml"));
    assertFalse(result.contains("onload"));
  }

  @Test
  void safeRasterDataUriIsAllowed() {
    String result =
        DescriptionSanitizer.sanitize("<img src=\"data:image/png;base64,abc123\" alt=\"test\">");

    assertTrue(result.contains("data:image/png;base64,abc123"));
  }

  @Test
  void httpsImgSrcIsAllowed() {
    String result =
        DescriptionSanitizer.sanitize("<img src=\"https://example.com/img.png\" alt=\"photo\">");

    assertTrue(result.contains("https://example.com/img.png"));
  }

  @Test
  void tableElementsArePreserved() {
    String input =
        "<table><thead><tr><th>H1</th></tr></thead><tbody><tr><td>D1</td></tr></tbody></table>";
    String result = DescriptionSanitizer.sanitize(input);

    assertTrue(result.contains("<table>"));
    assertTrue(result.contains("<th>"));
    assertTrue(result.contains("<td>"));
  }

  @Test
  void onclickAttributeIsStripped() {
    String result = DescriptionSanitizer.sanitize("<div onclick=\"evil()\">content</div>");

    assertFalse(result.contains("onclick"));
    assertTrue(result.contains("content"));
  }

  @Test
  void headingsArePreserved() {
    String result = DescriptionSanitizer.sanitize("<h1>Title</h1><h2>Sub</h2>");

    assertTrue(result.contains("<h1>Title</h1>"));
    assertTrue(result.contains("<h2>Sub</h2>"));
  }

  @Test
  void listsArePreserved() {
    String result = DescriptionSanitizer.sanitize("<ul><li>item</li></ul>");

    assertTrue(result.contains("<ul>"));
    assertTrue(result.contains("<li>item</li>"));
  }

  @Test
  void entityLinkTokensArePreserved() {
    String input = "<p>See <#E::table::bigquery.shopify.product> for details</p>";
    String result = DescriptionSanitizer.sanitize(input);

    assertTrue(result.contains("<#E::table::bigquery.shopify.product>"));
    assertTrue(result.contains("for details"));
  }

  @Test
  void entityLinkWithFallbackTextIsPreserved() {
    String input = "<#E::user::admin|[@Admin](/user/admin)>";
    String result = DescriptionSanitizer.sanitize(input);

    assertEquals("<#E::user::admin|[@Admin](/user/admin)>", result);
  }

  @Test
  void multipleEntityLinksArePreserved() {
    String input = "<p><#E::table::db.schema.t1> and <#E::table::db.schema.t2> are related</p>";
    String result = DescriptionSanitizer.sanitize(input);

    assertTrue(result.contains("<#E::table::db.schema.t1>"));
    assertTrue(result.contains("<#E::table::db.schema.t2>"));
  }

  @Test
  void entityLinkWithScriptInjectionIsStillSafe() {
    String input = "<p><#E::table::clean.fqn> and <script>alert(1)</script></p>";
    String result = DescriptionSanitizer.sanitize(input);

    assertTrue(result.contains("<#E::table::clean.fqn>"));
    assertFalse(result.contains("<script"));
  }
}

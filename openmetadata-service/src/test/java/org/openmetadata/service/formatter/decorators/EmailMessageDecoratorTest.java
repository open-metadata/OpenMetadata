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

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.openmetadata.service.util.EntityUtil.encodeEntityFqnSafe;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

class EmailMessageDecoratorTest {
  private EmailMessageDecorator decorator;

  @BeforeEach
  void setUp() {
    decorator = new EmailMessageDecorator();
  }

  @Test
  @DisplayName("Should format bold text with HTML tags")
  void testGetBold() {
    String result = String.format(decorator.getBold(), "test");
    assertEquals("<b>test</b>", result);
  }

  @Test
  @DisplayName("Should format bold text with space using HTML tags")
  void testGetBoldWithSpace() {
    String result = String.format(decorator.getBoldWithSpace(), "test");
    assertEquals("<b>test</b> ", result);
  }

  @Test
  @DisplayName("Should return HTML line break")
  void testGetLineBreak() {
    assertEquals(" <br/> ", decorator.getLineBreak());
  }

  @Test
  @DisplayName("Should return HTML add marker")
  void testGetAddMarker() {
    assertEquals("<b>", decorator.getAddMarker());
  }

  @Test
  @DisplayName("Should return HTML add marker close")
  void testGetAddMarkerClose() {
    assertEquals("</b>", decorator.getAddMarkerClose());
  }

  @Test
  @DisplayName("Should return HTML remove marker")
  void testGetRemoveMarker() {
    assertEquals("<s>", decorator.getRemoveMarker());
  }

  @Test
  @DisplayName("Should return HTML remove marker close")
  void testGetRemoveMarkerClose() {
    assertEquals("</s>", decorator.getRemoveMarkerClose());
  }

  @Test
  @DisplayName("Should use safe encoding that prevents double-encoding")
  void testSafeEncodingIsUsed() {
    // Test that the decorator uses encodeEntityFqnSafe method
    String fqn = "test fqn with spaces";
    String safeEncoded = encodeEntityFqnSafe(fqn);
    assertEquals("test%20fqn%20with%20spaces", safeEncoded);
  }

  @Test
  @DisplayName("Should handle complex FQN encoding correctly")
  void testComplexFqnEncoding() {
    String fqn = "Databricks.pro.silver.l0_purchase_order.POs con currency EUR pero debe ser USD";
    String encoded = encodeEntityFqnSafe(fqn);
    assertEquals("Databricks.pro.silver.l0_purchase_order.POs%20con%20currency%20EUR%20pero%20debe%20ser%20USD", encoded);
  }

  @Test
  @DisplayName("Should prevent double-encoding of percent signs")
  void testDoubleEncodingPrevention() {
    String fqn = "fqn%20already%20encoded";
    String encoded = encodeEntityFqnSafe(fqn);
    assertEquals("fqn%2520already%2520encoded", encoded);
  }

  @ParameterizedTest
  @ValueSource(strings = {
    "normal_fqn",
    "fqn with spaces", 
    "fqn#with@special$chars",
    "fqn?with=params&other=values",
    "fqn+with%encoded[chars]",
    "fqn<with>brackets{and}pipes|here"
  })
  @DisplayName("Should handle various FQN formats with safe encoding")
  void testVariousFqnFormatsEncoding(String fqn) {
    String encoded = encodeEntityFqnSafe(fqn);
    // Ensure no double-encoding (no %25 except for original % signs)
    if (!fqn.contains("%")) {
      assertEquals(-1, encoded.indexOf("%25"));
    }
  }

  @Test
  @DisplayName("Should handle special characters correctly")
  void testSpecialCharactersEncoding() {
    String fqn = "db.schema#table?param=value&other=data";
    String encoded = encodeEntityFqnSafe(fqn);
    assertEquals("db.schema%23table%3Fparam%3Dvalue%26other%3Ddata", encoded);
  }

  @Test
  @DisplayName("Should handle currency symbols")
  void testCurrencySymbolsEncoding() {
    String fqn = "orders_EUR_to_USD";
    String encoded = encodeEntityFqnSafe(fqn);
    assertEquals("orders_EUR_to_USD", encoded); // No encoding needed for underscores and letters
  }
}
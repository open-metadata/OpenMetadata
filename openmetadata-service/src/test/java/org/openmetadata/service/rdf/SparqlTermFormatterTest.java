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

package org.openmetadata.service.rdf;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.JsonNode;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.utils.JsonUtils;

class SparqlTermFormatterTest {

  @Test
  void rendersSimpleTermsAsTheirBareValue() {
    assertEquals(
        "https://example.com/s", display("{\"type\":\"uri\",\"value\":\"https://example.com/s\"}"));
    assertEquals("orders", display("{\"type\":\"literal\",\"value\":\"orders\"}"));
    assertEquals("b0", display("{\"type\":\"bnode\",\"value\":\"b0\"}"));
  }

  @Test
  void keepsLanguageAndDatatypeOffTopLevelLiteralsSoDisplayIsUnchanged() {
    assertEquals("cat", display("{\"type\":\"literal\",\"value\":\"cat\",\"xml:lang\":\"en\"}"));
    assertEquals(
        "7",
        display(
            "{\"type\":\"literal\",\"value\":\"7\",\"datatype\":\"http://www.w3.org/2001/XMLSchema#integer\"}"));
  }

  @Test
  void rendersATripleTermInRdf12Syntax() {
    final String rendered =
        display(
            """
            {"type":"triple","value":{
              "subject":{"type":"uri","value":"urn:s"},
              "predicate":{"type":"uri","value":"urn:p"},
              "object":{"type":"literal","value":"قطة","xml:lang":"ar","its:dir":"rtl"}}}
            """);

    assertEquals("<<( <urn:s> <urn:p> \"قطة\"@ar--rtl )>>", rendered);
  }

  @Test
  void rendersNestedTripleTermsAndTypedLiterals() {
    final String rendered =
        display(
            """
            {"type":"triple","value":{
              "subject":{"type":"triple","value":{
                "subject":{"type":"bnode","value":"b0"},
                "predicate":{"type":"uri","value":"urn:p"},
                "object":{"type":"literal","value":"7","datatype":"urn:int"}}},
              "predicate":{"type":"uri","value":"urn:q"},
              "object":{"type":"literal","value":"say \\"hi\\""}}}
            """);

    assertEquals(
        "<<( <<( _:b0 <urn:p> \"7\"^^<urn:int> )>> <urn:q> \"say \\\"hi\\\"\" )>>", rendered);
  }

  @Test
  void identifiesTripleTerms() {
    assertTrue(SparqlTermFormatter.isTripleTerm(node("{\"type\":\"triple\",\"value\":{}}")));
    assertFalse(SparqlTermFormatter.isTripleTerm(node("{\"type\":\"uri\",\"value\":\"urn:s\"}")));
  }

  private static String display(final String termJson) {
    return SparqlTermFormatter.displayText(node(termJson));
  }

  private static JsonNode node(final String json) {
    return JsonUtils.readTree(json);
  }
}

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

package org.openmetadata.mcp.tools;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.core.type.TypeReference;
import java.util.List;
import org.junit.jupiter.api.Test;

class SparqlResultSetTest {

  @JsonIgnoreProperties(ignoreUnknown = true)
  record Row(SparqlResultSet.Value entity, SparqlResultSet.Value statement) {}

  private static final TypeReference<SparqlResultSet<Row>> ROWS = new TypeReference<>() {};

  @Test
  void readsOrdinaryTermsAsTheirLexicalValue() {
    List<Row> rows =
        SparqlResultSet.rows(
            """
            {"head":{"vars":["entity"]},"results":{"bindings":[
              {"entity":{"type":"uri","value":"urn:table:orders"}}]}}
            """,
            ROWS);

    assertEquals("urn:table:orders", rows.getFirst().entity().value());
  }

  @Test
  void readsALanguageTaggedLiteralWithoutItsTag() {
    List<Row> rows =
        SparqlResultSet.rows(
            """
            {"head":{"vars":["entity"]},"results":{"bindings":[
              {"entity":{"type":"literal","value":"orders","xml:lang":"en"}}]}}
            """,
            ROWS);

    assertEquals("orders", rows.getFirst().entity().value());
  }

  /**
   * A triple term sends an object in {@code "value"}. Binding that to a String failed the whole
   * result, so a single RDF 1.2 row used to turn an otherwise good answer into a blanket 400.
   */
  @Test
  void readsAnRdf12TripleTermInsteadOfFailingTheWholeResult() {
    List<Row> rows =
        SparqlResultSet.rows(
            """
            {"head":{"vars":["statement","entity"]},"results":{"bindings":[
              {"statement":{"type":"triple","value":{
                 "subject":{"type":"uri","value":"urn:s"},
                 "predicate":{"type":"uri","value":"urn:p"},
                 "object":{"type":"literal","value":"cat","xml:lang":"ar","its:dir":"rtl"}}},
               "entity":{"type":"uri","value":"urn:table:orders"}}]}}
            """,
            ROWS);

    assertEquals(1, rows.size());
    assertEquals("<<( <urn:s> <urn:p> \"cat\"@ar--rtl )>>", rows.getFirst().statement().value());
    assertEquals("urn:table:orders", rows.getFirst().entity().value());
  }

  @Test
  void readsAnEmptyResultAsNoRows() {
    assertTrue(
        SparqlResultSet.rows("{\"head\":{\"vars\":[]},\"results\":{\"bindings\":[]}}", ROWS)
            .isEmpty());
  }
}

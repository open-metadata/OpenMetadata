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
import static org.junit.jupiter.api.Assertions.assertThrows;

import java.util.Map;
import org.junit.jupiter.api.Test;
import org.openmetadata.service.Entity;

class GetConceptContextToolTest {
  @Test
  void requiresConceptTypeAndFqn() {
    assertThrows(
        IllegalArgumentException.class, () -> GetConceptContextTool.Parameters.from(Map.of()));
    assertThrows(
        IllegalArgumentException.class,
        () ->
            GetConceptContextTool.Parameters.from(
                Map.of("entityType", Entity.TABLE, "fqn", "orders")));
    assertThrows(
        IllegalArgumentException.class,
        () ->
            GetConceptContextTool.Parameters.from(Map.of("entityType", Entity.METRIC, "fqn", " ")));
  }

  @Test
  void acceptsBothConceptTypesAndDefaultsToMarkdown() {
    GetConceptContextTool.Parameters parameters =
        GetConceptContextTool.Parameters.from(
            Map.of("entityType", Entity.GLOSSARY_TERM, "fqn", "Business.Revenue"));
    assertEquals("markdown", parameters.format());
    assertEquals(Entity.GLOSSARY_TERM, parameters.entityType());
    assertEquals("Business.Revenue", parameters.fqn());
    parameters =
        GetConceptContextTool.Parameters.from(
            Map.of(
                "entityType",
                Entity.METRIC,
                "fqn",
                "revenue",
                "format",
                "json",
                "query",
                "refunds"));
    assertEquals("json", parameters.format());
    assertEquals("refunds", parameters.query());
  }

  @Test
  void rejectsUnknownOutputFormats() {
    assertThrows(
        IllegalArgumentException.class,
        () ->
            GetConceptContextTool.Parameters.from(
                Map.of("entityType", Entity.METRIC, "fqn", "revenue", "format", "xml")));
  }
}

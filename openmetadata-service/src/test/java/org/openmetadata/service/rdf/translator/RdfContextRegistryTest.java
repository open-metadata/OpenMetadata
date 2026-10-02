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
package org.openmetadata.service.rdf.translator;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.Set;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

@DisplayName("RdfContextRegistry routing")
class RdfContextRegistryTest {

  /** Must stay in sync with the context files JsonLdTranslator.loadContexts registers. */
  private static final Set<String> LOADED_CONTEXT_NAMES =
      Set.of(
          "base",
          "dataAsset-complete",
          "service",
          "team",
          "thread",
          "entityRelationship",
          "governance",
          "quality",
          "operations",
          "lineage",
          "ai",
          "automation");

  @Test
  @DisplayName("every routed context name corresponds to a loaded context file")
  void routedNamesAreLoadedContexts() {
    Set<String> probes =
        Set.of(
            "table",
            "dashboardDataModel",
            "databaseService",
            "user",
            "thread",
            "glossaryTerm",
            "testCase",
            "ingestionPipeline",
            "llmModel",
            "workflow",
            "unknownFutureType");
    for (String entityType : probes) {
      String contextName = RdfContextRegistry.contextNameFor(entityType);
      assertNotNull(contextName);
      assertTrue(
          LOADED_CONTEXT_NAMES.contains(contextName),
          entityType + " routed to unloaded context " + contextName);
    }
  }

  @Test
  @DisplayName("types the old write-path switch misrouted to base now route to their real context")
  void previouslyMisroutedTypesNowResolve() {
    // Before the registry, the write path's own switch knew ~26 types; all of
    // these fell through to "base" and their fields became JSON-string literals.
    assertEquals("quality", RdfContextRegistry.contextNameFor("testCase"));
    assertEquals("quality", RdfContextRegistry.contextNameFor("testSuite"));
    assertEquals("governance", RdfContextRegistry.contextNameFor("domain"));
    assertEquals("governance", RdfContextRegistry.contextNameFor("dataProduct"));
    assertEquals("governance", RdfContextRegistry.contextNameFor("dataContract"));
    assertEquals("operations", RdfContextRegistry.contextNameFor("ingestionPipeline"));
    assertEquals("operations", RdfContextRegistry.contextNameFor("app"));
    assertEquals("operations", RdfContextRegistry.contextNameFor("kpi"));
    assertEquals("dataAsset-complete", RdfContextRegistry.contextNameFor("query"));
    assertEquals("dataAsset-complete", RdfContextRegistry.contextNameFor("metric"));
    assertEquals("service", RdfContextRegistry.contextNameFor("searchService"));
    assertEquals("team", RdfContextRegistry.contextNameFor("bot"));
    assertEquals("thread", RdfContextRegistry.contextNameFor("post"));
    assertEquals("ai", RdfContextRegistry.contextNameFor("llmModel"));
    assertEquals("automation", RdfContextRegistry.contextNameFor("workflow"));
  }

  @Test
  @DisplayName("types only the old write-path switch knew are preserved in the union")
  void writePathOnlyTypesArePreserved() {
    assertEquals("dataAsset-complete", RdfContextRegistry.contextNameFor("dashboardDataModel"));
  }

  @Test
  @DisplayName("unknown types fall back to base")
  void unknownTypesFallBackToBase() {
    assertEquals("base", RdfContextRegistry.contextNameFor("somethingBrandNew"));
  }
}

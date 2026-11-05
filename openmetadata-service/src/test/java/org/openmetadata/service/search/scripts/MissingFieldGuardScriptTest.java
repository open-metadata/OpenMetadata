/*
 *  Copyright 2026 Collate.
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
package org.openmetadata.service.search.scripts;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import org.junit.jupiter.api.Test;
import org.openmetadata.service.search.SearchClient;

/**
 * Guards the collection-mutating Painless scripts against a matched document that does not carry
 * the collection they mutate.
 *
 * <p>This is the defect class that produced the bare {@code [script_exception] runtime error} in
 * ADD_UPDATE_LINEAGE: {@code upstreamLineage} is seeded only for index classes implementing
 * {@code LineageIndex}, so a lineage edge whose target was a database schema, database or glossary
 * term hit a null dereference on the first PUT. {@code upstreamEntityRelationship} is narrower
 * still — only {@code TableIndex} seeds it.
 *
 * <p>The remaining scripts are currently reachable only through an {@code updateByQuery} filter on
 * the very collection they mutate, which is what keeps them from failing today. That invariant
 * lives three layers away in the caller, so these tests assert the guard is local to the script:
 * a caller that filters on anything else must not be able to reintroduce the defect.
 *
 * <p>There is no Painless engine on the test classpath, so the script cannot be executed here.
 * These assertions are on the script source, matching the precedent set by #28373.
 */
class MissingFieldGuardScriptTest {

  @Test
  void removeLineageScriptSkipsDocumentsWithoutUpstreamLineage() {
    assertTrue(
        SearchClient.REMOVE_LINEAGE_SCRIPT.contains("ctx._source.upstreamLineage != null"),
        "REMOVE_LINEAGE_SCRIPT must not dereference upstreamLineage before null-checking it");
    assertTrue(
        SearchClient.REMOVE_LINEAGE_SCRIPT.contains("ctx._source.upstreamLineage.removeIf("),
        "the guard must wrap the removal, not replace it");
  }

  @Test
  void removeEntityRelationshipScriptSkipsDocumentsWithoutTheField() {
    assertTrue(
        SearchClient.REMOVE_ENTITY_RELATIONSHIP.contains(
            "ctx._source.upstreamEntityRelationship != null"),
        "REMOVE_ENTITY_RELATIONSHIP must null-check before removeIf");
    assertTrue(
        SearchClient.REMOVE_ENTITY_RELATIONSHIP.contains(
            "ctx._source.upstreamEntityRelationship.removeIf("),
        "the guard must wrap the removal, not replace it");
  }

  @Test
  void addUpdateEntityRelationshipScriptInitializesMissingFieldBeforeUse() {
    String script = SearchClient.ADD_UPDATE_ENTITY_RELATIONSHIP;
    int initializedAt = script.indexOf("ctx._source.upstreamEntityRelationship = new ArrayList()");
    int firstUseAt = script.indexOf("ctx._source.upstreamEntityRelationship.size()");

    assertTrue(initializedAt >= 0, "script must initialize upstreamEntityRelationship when absent");
    assertTrue(firstUseAt >= 0, "script must still iterate upstreamEntityRelationship");
    assertTrue(
        initializedAt < firstUseAt,
        "initialization must precede the first dereference, or the script still throws");
  }

  /**
   * A malformed guard — an unbalanced brace from wrapping a script body — is the realistic
   * regression here, and it surfaces only as a runtime script_exception in production.
   */
  @Test
  void guardedScriptsAreStructurallyBalanced() {
    assertBalanced("REMOVE_LINEAGE_SCRIPT", SearchClient.REMOVE_LINEAGE_SCRIPT);
    assertBalanced("REMOVE_ENTITY_RELATIONSHIP", SearchClient.REMOVE_ENTITY_RELATIONSHIP);
    assertBalanced("ADD_UPDATE_ENTITY_RELATIONSHIP", SearchClient.ADD_UPDATE_ENTITY_RELATIONSHIP);
    assertBalanced("ADD_UPDATE_LINEAGE", SearchClient.ADD_UPDATE_LINEAGE);
  }

  private void assertBalanced(String name, String script) {
    assertEquals(countOf(script, '{'), countOf(script, '}'), name + " has unbalanced curly braces");
    assertEquals(countOf(script, '('), countOf(script, ')'), name + " has unbalanced parentheses");
  }

  private long countOf(String script, char c) {
    return script.chars().filter(ch -> ch == c).count();
  }
}

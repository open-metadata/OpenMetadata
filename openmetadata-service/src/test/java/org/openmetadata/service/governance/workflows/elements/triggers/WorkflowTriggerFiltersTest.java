/*
 *  Copyright 2026 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

package org.openmetadata.service.governance.workflows.elements.triggers;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

/**
 * Tests the shared trigger field/filter semantics used by both the eventBasedEntity trigger and the
 * approval gate. These are the rules that must stay identical on both sides.
 */
class WorkflowTriggerFiltersTest {

  // ---- matchesField ---------------------------------------------------------------------------

  @Test
  void matchesFieldExact() {
    assertTrue(WorkflowTriggerFilters.matchesField("description", "description"));
  }

  @Test
  void matchesFieldHierarchicalPrefix() {
    assertTrue(WorkflowTriggerFilters.matchesField("columns.address.description", "columns"));
  }

  @Test
  void matchesFieldRejectsNonSeparatorPrefix() {
    assertFalse(WorkflowTriggerFilters.matchesField("descriptionExtra", "description"));
  }

  @Test
  void matchesFieldRejectsUnrelated() {
    assertFalse(WorkflowTriggerFilters.matchesField("tags", "owners"));
  }

  // ---- isTriggerField -------------------------------------------------------------------------

  @Test
  void triggerFieldRecognized() {
    assertTrue(WorkflowTriggerFilters.isTriggerField("description"));
    assertTrue(WorkflowTriggerFilters.isTriggerField("tags"));
  }

  @Test
  void nonTriggerFieldNotRecognized() {
    assertFalse(WorkflowTriggerFilters.isTriggerField("sourceUrl"));
    assertFalse(WorkflowTriggerFilters.isTriggerField("retentionPeriod"));
  }

  // ---- fieldTriggers: include priority --------------------------------------------------------

  @Test
  void includedTriggerFieldTriggers() {
    assertTrue(WorkflowTriggerFilters.fieldTriggers("description", List.of("description"), null));
  }

  @Test
  void triggerFieldNotInIncludeDoesNotTrigger() {
    assertFalse(WorkflowTriggerFilters.fieldTriggers("tags", List.of("description"), null));
  }

  @Test
  void includeTakesPriorityOverExclude() {
    // include non-empty -> exclude is ignored entirely (schema: "Takes priority over exclude").
    assertTrue(
        WorkflowTriggerFilters.fieldTriggers(
            "description", List.of("description"), List.of("description")));
  }

  // ---- fieldTriggers: empty include falls back to exclude -------------------------------------

  @Test
  void emptyIncludeGatesAnyTriggerField() {
    assertTrue(WorkflowTriggerFilters.fieldTriggers("description", List.of(), List.of()));
  }

  @Test
  void emptyIncludeExcludedFieldDoesNotTrigger() {
    assertFalse(WorkflowTriggerFilters.fieldTriggers("owners", List.of(), List.of("owners")));
  }

  @Test
  void emptyIncludeNonExcludedTriggerFieldTriggers() {
    assertTrue(WorkflowTriggerFilters.fieldTriggers("tags", List.of(), List.of("owners")));
  }

  @Test
  void nullIncludeAndExcludeGatesAnyTriggerField() {
    assertTrue(WorkflowTriggerFilters.fieldTriggers("description", null, null));
  }

  // ---- fieldTriggers: trigger-field gate precedes include/exclude -----------------------------

  @Test
  void nonTriggerFieldNeverTriggersEvenIfIncluded() {
    assertFalse(WorkflowTriggerFilters.fieldTriggers("sourceUrl", List.of("sourceUrl"), null));
  }

  @Test
  void nonTriggerFieldNeverTriggersUnderEmptyInclude() {
    assertFalse(WorkflowTriggerFilters.fieldTriggers("sourceUrl", List.of(), List.of()));
  }

  // ---- extractEntitySpecificFilter ------------------------------------------------------------

  @Test
  void nullFilterYieldsNull() {
    assertNull(WorkflowTriggerFilters.extractEntitySpecificFilter(null, "table"));
  }

  @Test
  void plainStringFilterUnsupported() {
    assertNull(WorkflowTriggerFilters.extractEntitySpecificFilter("not-an-object", "table"));
  }

  @Test
  void emptyStringFilterYieldsNull() {
    assertNull(WorkflowTriggerFilters.extractEntitySpecificFilter("   ", "table"));
  }

  @Test
  void mapFilterResolvesEntityType() {
    Object filter = Map.of("table", "T_LOGIC", "default", "D_LOGIC");
    assertEquals("T_LOGIC", WorkflowTriggerFilters.extractEntitySpecificFilter(filter, "table"));
  }

  @Test
  void mapFilterFallsBackToDefault() {
    Object filter = Map.of("default", "D_LOGIC");
    assertEquals("D_LOGIC", WorkflowTriggerFilters.extractEntitySpecificFilter(filter, "table"));
  }

  @Test
  void objectEncodedAsStringResolves() {
    String filter = "{\"table\":\"T_LOGIC\"}";
    assertEquals("T_LOGIC", WorkflowTriggerFilters.extractEntitySpecificFilter(filter, "table"));
  }

  @Test
  void emptyObjectFilterYieldsNull() {
    assertNull(WorkflowTriggerFilters.extractEntitySpecificFilter(Map.of(), "table"));
  }

  @Test
  void jsonEncodedEmptyStringSanitizedToNull() {
    assertNull(WorkflowTriggerFilters.sanitizeFilterValue("\"\""));
    assertNull(WorkflowTriggerFilters.sanitizeFilterValue("{}"));
    assertNull(WorkflowTriggerFilters.sanitizeFilterValue("  "));
  }
}

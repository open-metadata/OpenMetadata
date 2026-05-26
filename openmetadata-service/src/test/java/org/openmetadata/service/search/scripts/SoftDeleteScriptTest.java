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
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import org.junit.jupiter.api.Test;
import org.openmetadata.service.search.capability.EntityIndexCapability;

class SoftDeleteScriptTest {

  @Test
  void rendersBooleanWithoutQuotes() {
    assertEquals(
        "ctx._source.put('deleted', true)",
        new SoftDeleteScript(true).painless(),
        "the latent quoting bug — '%s' wrapping the boolean — was the reason the field landed"
            + " as a string rather than a JSON boolean. The typed script must emit a JSON"
            + " boolean.");
    assertEquals("ctx._source.put('deleted', false)", new SoftDeleteScript(false).painless());
  }

  @Test
  void compatibleWithEntitiesThatCarryTheDeletedField() {
    SoftDeleteScript script = new SoftDeleteScript(true);

    assertTrue(script.compatibleWith(EntityIndexCapability.forEntity("table")));
    assertFalse(
        script.compatibleWith(EntityIndexCapability.forTimeSeries("testCaseResolutionStatus")),
        "time-series entities have no `deleted` field — the regression that broke Incident "
            + "Manager");
    assertFalse(
        script.compatibleWith(null),
        "unregistered entity types are treated as incompatible — fail-safe");
  }

  @Test
  void paramsAreEmpty() {
    assertEquals(0, new SoftDeleteScript(true).params().size());
  }
}

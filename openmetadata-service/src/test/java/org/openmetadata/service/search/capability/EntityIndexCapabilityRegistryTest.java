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
package org.openmetadata.service.search.capability;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class EntityIndexCapabilityRegistryTest {

  @BeforeEach
  @AfterEach
  void resetRegistry() {
    EntityIndexCapabilityRegistry.clear();
  }

  @Test
  void registeredEntityHasFieldDeletedAndIsNotTimeSeries() {
    EntityIndexCapabilityRegistry.register(EntityIndexCapability.forEntity("table"));

    EntityIndexCapability capability = EntityIndexCapabilityRegistry.get("table");
    assertTrue(capability.hasFieldDeleted());
    assertFalse(capability.isTimeSeries());
    assertEquals("table", capability.entityType());
  }

  @Test
  void registeredTimeSeriesEntityLacksFieldDeleted() {
    EntityIndexCapabilityRegistry.register(
        EntityIndexCapability.forTimeSeries("testCaseResolutionStatus"));

    EntityIndexCapability capability =
        EntityIndexCapabilityRegistry.get("testCaseResolutionStatus");
    assertFalse(
        capability.hasFieldDeleted(),
        "time-series entities never carry a top-level `deleted` field; scripts must opt out");
    assertTrue(capability.isTimeSeries());
  }

  @Test
  void getReturnsNullForUnknownEntityType() {
    assertNull(EntityIndexCapabilityRegistry.get("does-not-exist"));
    assertNull(EntityIndexCapabilityRegistry.get(null));
  }

  @Test
  void registrationOverwritesPriorCapability() {
    EntityIndexCapabilityRegistry.register(EntityIndexCapability.forTimeSeries("test"));
    EntityIndexCapabilityRegistry.register(EntityIndexCapability.forEntity("test"));

    assertTrue(EntityIndexCapabilityRegistry.get("test").hasFieldDeleted());
  }

  @Test
  void clearEmptiesTheRegistry() {
    EntityIndexCapabilityRegistry.register(EntityIndexCapability.forEntity("a"));
    EntityIndexCapabilityRegistry.register(EntityIndexCapability.forTimeSeries("b"));

    EntityIndexCapabilityRegistry.clear();

    assertEquals(0, EntityIndexCapabilityRegistry.all().size());
  }
}

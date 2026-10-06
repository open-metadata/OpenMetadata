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

package org.openmetadata.service.resources.context;

import static org.junit.jupiter.api.Assertions.assertEquals;

import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import org.openmetadata.schema.entity.context.ContextMemory;
import org.openmetadata.schema.entity.context.ContextMemorySourceType;
import org.openmetadata.schema.entity.context.ContextMemoryType;
import org.openmetadata.schema.entity.context.MemoryDispute;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.EntityStatus;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;

/** Pins lifecycle wire values shared with ai-platform and Collate. */
class ContextMemorySchemaTest {

  @Test
  void memoryRetirementStagesHaveDistinctWireValues() {
    assertEquals("Superseded", EntityStatus.fromValue("Superseded").value());
    assertEquals("Invalidated", EntityStatus.fromValue("Invalidated").value());
  }

  @Test
  void lifecycleEnumsCarryTheirWireValues() {
    assertEquals(ContextMemoryType.LEARNING, ContextMemoryType.fromValue("Learning"));
    assertEquals(
        ContextMemorySourceType.CONVERSATION_EXTRACTION,
        ContextMemorySourceType.fromValue("ConversationExtraction"));
    assertEquals(EntityStatus.DEPRECATED, EntityStatus.fromValue("Deprecated"));
    assertEquals(EntityStatus.REJECTED, EntityStatus.fromValue("Rejected"));
  }

  @ParameterizedTest
  @EnumSource(
      value = EntityStatus.class,
      names = {"DEPRECATED", "SUPERSEDED"})
  void lifecycleFieldsSurviveAJsonRoundTrip(EntityStatus status) {
    EntityReference keeper =
        new EntityReference().withId(UUID.randomUUID()).withType(Entity.CONTEXT_MEMORY);
    MemoryDispute dispute =
        new MemoryDispute()
            .withMemory(keeper)
            .withReason("The other owner says fiscal Q1 starts in February")
            .withDetectedAt(1_700_000_000_000L);
    ContextMemory memory =
        new ContextMemory()
            .withId(UUID.randomUUID())
            .withName("superseded-memory")
            .withEntityStatus(status)
            .withSupersededBy(keeper)
            .withStatusReason("Duplicate of the keeper")
            .withDisputes(List.of(dispute));

    ContextMemory copy = JsonUtils.readValue(JsonUtils.pojoToJson(memory), ContextMemory.class);

    assertEquals(status, copy.getEntityStatus());
    assertEquals(keeper, copy.getSupersededBy());
    assertEquals("Duplicate of the keeper", copy.getStatusReason());
    assertEquals(List.of(dispute), copy.getDisputes());
  }
}

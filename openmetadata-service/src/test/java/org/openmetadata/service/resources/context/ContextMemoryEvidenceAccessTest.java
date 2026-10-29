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
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.entity.context.ContextMemory;
import org.openmetadata.schema.type.ChangeDescription;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.FieldChange;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;

class ContextMemoryEvidenceAccessTest {

  private final EntityReference visibleQuery = query("Revenue by region");
  private final EntityReference hiddenQuery = query("Salaries of the executive team");
  private final EntityReference table =
      new EntityReference()
          .withId(UUID.randomUUID())
          .withType(Entity.TABLE)
          .withName("orders")
          .withFullyQualifiedName("svc.db.public.orders");
  private final ContextMemoryEvidenceAccess.QueryAccess access =
      query -> visibleQuery.getId().equals(query.getId());

  @Test
  void aQueryTheCallerMayNotViewKeepsOnlyItsIdAndTypeInPlace() {
    ContextMemory memory = memory(List.of(hiddenQuery, table, visibleQuery));

    ContextMemoryEvidenceAccess.redactUnviewableQueries(List.of(memory), access);

    List<EntityReference> related = memory.getRelatedEntities();
    assertEquals(
        List.of(hiddenQuery.getId(), table.getId(), visibleQuery.getId()),
        related.stream().map(EntityReference::getId).toList(),
        "the list keeps its order, so an edit sending it back still names every query");
    EntityReference redacted = related.getFirst();
    assertEquals(Entity.QUERY, redacted.getType());
    assertNull(redacted.getName());
    assertNull(redacted.getFullyQualifiedName());
    assertNull(redacted.getDisplayName());
    assertNull(redacted.getDescription());
    assertEquals(table, related.get(1), "only Query evidence is gated");
    assertEquals(visibleQuery, related.getLast());
  }

  @Test
  void aMemoryWithoutRelatedEntitiesIsUntouched() {
    ContextMemory memory = memory(null);

    ContextMemoryEvidenceAccess.redactUnviewableQueries(List.of(memory), access);

    assertNull(memory.getRelatedEntities());
  }

  @Test
  void everyVersionOfTheMemoryIsRedactedTheSameWay() {
    String version = JsonUtils.pojoToJson(memory(List.of(hiddenQuery, visibleQuery)));

    List<Object> redacted =
        ContextMemoryEvidenceAccess.redactVersions(List.of(version, version), access);

    for (Object json : redacted) {
      String text = (String) json;
      assertFalse(text.contains(hiddenQuery.getDisplayName()), text);
      assertTrue(text.contains(hiddenQuery.getId().toString()), text);
      assertTrue(text.contains(visibleQuery.getDisplayName()), text);
      ContextMemory read = JsonUtils.readValue(text, ContextMemory.class);
      assertEquals("amount_cents stores cents.", read.getAnswer());
    }
  }

  @Test
  void aChangeToTheLinksShowsAHiddenQueryOnlyByItsId() {
    ContextMemory memory =
        memory(List.of(table))
            .withChangeDescription(linkChange(List.of(hiddenQuery, visibleQuery)))
            .withIncrementalChangeDescription(linkChange(List.of(hiddenQuery)));

    ContextMemoryEvidenceAccess.redactUnviewableQueries(List.of(memory), access);

    for (ChangeDescription change :
        List.of(memory.getChangeDescription(), memory.getIncrementalChangeDescription())) {
      String removed = (String) change.getFieldsDeleted().getFirst().getOldValue();
      assertFalse(removed.contains(hiddenQuery.getDisplayName()), removed);
      assertFalse(removed.contains(hiddenQuery.getFullyQualifiedName()), removed);
      assertTrue(removed.contains(hiddenQuery.getId().toString()), removed);
    }
    String kept =
        (String) memory.getChangeDescription().getFieldsDeleted().getFirst().getOldValue();
    assertTrue(kept.contains(visibleQuery.getDisplayName()), kept);
    assertEquals(
        "Unprocessed",
        memory.getChangeDescription().getFieldsUpdated().getFirst().getOldValue(),
        "other field changes are untouched");
  }

  @Test
  void aVersionsChangeToTheLinksIsRedactedToo() {
    String version =
        JsonUtils.pojoToJson(
            memory(List.of()).withChangeDescription(linkChange(List.of(hiddenQuery))));

    String redacted =
        (String) ContextMemoryEvidenceAccess.redactVersions(List.of(version), access).getFirst();

    assertFalse(redacted.contains(hiddenQuery.getDisplayName()), redacted);
    assertTrue(redacted.contains(hiddenQuery.getId().toString()), redacted);
    ContextMemory read = JsonUtils.readValue(redacted, ContextMemory.class);
    assertEquals(1, read.getChangeDescription().getFieldsDeleted().size());
  }

  private static ChangeDescription linkChange(List<EntityReference> removed) {
    return new ChangeDescription()
        .withPreviousVersion(0.1)
        .withFieldsUpdated(
            List.of(
                new FieldChange()
                    .withName("entityStatus")
                    .withOldValue("Unprocessed")
                    .withNewValue("Draft")))
        .withFieldsDeleted(
            List.of(
                new FieldChange()
                    .withName("relatedEntities")
                    .withOldValue(JsonUtils.pojoToJson(removed))));
  }

  private static EntityReference query(String question) {
    UUID id = UUID.randomUUID();
    return new EntityReference()
        .withId(id)
        .withType(Entity.QUERY)
        .withName(id.toString())
        .withFullyQualifiedName("svc." + id)
        .withDisplayName(question)
        .withDescription(question);
  }

  private static ContextMemory memory(List<EntityReference> related) {
    UUID id = UUID.randomUUID();
    return new ContextMemory()
        .withId(id)
        .withName("memory-" + id)
        .withAnswer("amount_cents stores cents.")
        .withRelatedEntities(related == null ? null : List.copyOf(related));
  }
}

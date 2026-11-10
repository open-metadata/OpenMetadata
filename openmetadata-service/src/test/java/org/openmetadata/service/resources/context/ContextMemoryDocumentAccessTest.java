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
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.JsonNode;
import java.util.List;
import java.util.UUID;
import java.util.stream.Stream;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.entity.context.ContextMemory;
import org.openmetadata.schema.type.ChangeDescription;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.FieldChange;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;

class ContextMemoryDocumentAccessTest {

  private final EntityReference readable = file("Shared with the caller");
  private final EntityReference hidden = file("Private copy of the handbook");
  private final EntityReference article =
      new EntityReference()
          .withId(UUID.randomUUID())
          .withType(Entity.PAGE)
          .withName("Refund policy article");
  private final ContextMemoryDocumentAccess.FileAccess access =
      file -> readable.getId().equals(file.getId());

  /** A version written while the private copy anchored the memory names it nowhere. */
  @Test
  void aVersionNamesOnlyTheFilesTheCallerMayRead() {
    ContextMemory version =
        memory()
            .withPrimaryEntity(hidden)
            .withSourceEntity(hidden)
            .withSourceFile(hidden)
            .withRelatedEntities(List.of(readable, article))
            .withChangeDescription(anchorMovedTo(hidden));

    String redacted =
        JsonUtils.pojoToJson(ContextMemoryDocumentAccess.versionRedaction(access).apply(version));

    assertFalse(redacted.contains(hidden.getName()), redacted);
    JsonNode links = JsonUtils.readTree(redacted);
    for (String field : List.of("primaryEntity", "sourceEntity", "sourceFile")) {
      assertEquals(idOnly(hidden), JsonUtils.convertValue(links.get(field), EntityReference.class));
    }
    assertTrue(redacted.contains(readable.getName()), "a file the caller may read stays named");
    assertTrue(redacted.contains(article.getName()), "an article reads to everyone");
  }

  /** The list keeps its order, so an edit sending it back still names every document. */
  @Test
  void aHiddenRelatedFileKeepsItsPlaceAsIdAndType() {
    ContextMemory version = memory().withRelatedEntities(List.of(hidden, article, readable));

    List<EntityReference> related =
        ContextMemoryDocumentAccess.versionRedaction(access).apply(version).getRelatedEntities();

    assertEquals(List.of(idOnly(hidden), article, readable), related);
  }

  /** One operator redacts every version a history read returns. */
  @Test
  void everyVersionOfTheHistoryIsRedacted() {
    ContextMemory older = memory().withPrimaryEntity(hidden);
    ContextMemory latest = memory().withChangeDescription(anchorMovedTo(readable));

    Stream.of(older, latest)
        .map(ContextMemoryDocumentAccess.versionRedaction(access))
        .map(JsonUtils::pojoToJson)
        .forEach(version -> assertFalse(version.contains(hidden.getName()), version));
  }

  /**
   * The memory as read now keeps its links, which its readers may read; only the change its last
   * write recorded, which can name the file it moved from, is redacted.
   */
  @Test
  void theMemoryAsReadNowRedactsOnlyTheChangeItsLastWriteRecorded() {
    ContextMemory memory =
        memory()
            .withPrimaryEntity(readable)
            .withChangeDescription(anchorMovedTo(readable))
            .withIncrementalChangeDescription(anchorMovedTo(readable));

    ContextMemoryDocumentAccess.redactChanges(List.of(memory), access);

    assertEquals(readable, memory.getPrimaryEntity());
    for (ChangeDescription change :
        List.of(memory.getChangeDescription(), memory.getIncrementalChangeDescription())) {
      String recorded = JsonUtils.pojoToJson(change);
      assertFalse(recorded.contains(hidden.getName()), recorded);
      assertTrue(recorded.contains(hidden.getId().toString()), recorded);
      assertTrue(recorded.contains(readable.getName()), recorded);
    }
  }

  /** Only the link fields hold references; any other change says what it says. */
  @Test
  void aChangeToAnotherFieldIsUntouched() {
    String answer = "See " + hidden.getName();
    ContextMemory memory =
        memory()
            .withChangeDescription(
                new ChangeDescription()
                    .withFieldsUpdated(
                        List.of(
                            new FieldChange()
                                .withName("answer")
                                .withOldValue(answer)
                                .withNewValue(answer))));

    ContextMemoryDocumentAccess.redactChanges(List.of(memory), access);

    assertEquals(answer, memory.getChangeDescription().getFieldsUpdated().getFirst().getNewValue());
  }

  /**
   * How a lifecycle write records a moved anchor: the new anchor added and the old one deleted as
   * serialized lists, and the shown source updated in place.
   */
  private ChangeDescription anchorMovedTo(EntityReference anchor) {
    EntityReference previous = anchor == hidden ? readable : hidden;
    return new ChangeDescription()
        .withFieldsAdded(
            List.of(
                new FieldChange()
                    .withName("primaryEntity")
                    .withNewValue(JsonUtils.pojoToJson(List.of(anchor)))))
        .withFieldsDeleted(
            List.of(
                new FieldChange()
                    .withName("primaryEntity")
                    .withOldValue(JsonUtils.pojoToJson(List.of(previous)))))
        .withFieldsUpdated(
            List.of(
                new FieldChange()
                    .withName("sourceEntity")
                    .withOldValue(JsonUtils.pojoToJson(previous))
                    .withNewValue(JsonUtils.pojoToJson(anchor))));
  }

  private static ContextMemory memory() {
    return new ContextMemory()
        .withId(UUID.randomUUID())
        .withName("memory-" + UUID.randomUUID())
        .withQuestion("How long is the refund window?");
  }

  private static EntityReference file(String name) {
    return new EntityReference()
        .withId(UUID.randomUUID())
        .withType(Entity.CONTEXT_FILE)
        .withName(name)
        .withFullyQualifiedName(name)
        .withDisplayName(name);
  }

  private static EntityReference idOnly(EntityReference reference) {
    return new EntityReference().withId(reference.getId()).withType(reference.getType());
  }
}

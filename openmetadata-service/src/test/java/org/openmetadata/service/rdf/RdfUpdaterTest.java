/*
 *  Copyright 2025 Collate
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
package org.openmetadata.service.rdf;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertInstanceOf;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.lang.reflect.Field;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.function.Consumer;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.EntityRelationship;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.util.PostCommitActionQueue;

class RdfUpdaterTest {
  private final List<RdfLiveWrite> submitted = new ArrayList<>();
  private Object originalQueue;
  private Field queueField;

  @BeforeEach
  void setUp() throws ReflectiveOperationException {
    queueField = RdfUpdater.class.getDeclaredField("writeQueue");
    queueField.setAccessible(true);
    originalQueue = queueField.get(null);
    queueField.set(null, (Consumer<RdfLiveWrite>) submitted::add);
  }

  @AfterEach
  void tearDown() throws ReflectiveOperationException {
    PostCommitActionQueue.clear();
    queueField.set(null, originalQueue);
  }

  @Test
  void capturesOnlyEntityIdentityForDurableReplay() {
    final Table table = new Table().withId(UUID.randomUUID()).withName("original");
    PostCommitActionQueue.begin();
    RdfUpdater.updateEntity(table);
    table.setName("changed");
    assertTrue(submitted.isEmpty());

    PostCommitActionQueue.run(PostCommitActionQueue.drain());

    final RdfLiveWrite.EntityUpdate update =
        assertInstanceOf(RdfLiveWrite.EntityUpdate.class, submitted.getFirst());
    assertEquals(table.getId(), update.entityId());
    final String payload = JsonUtils.pojoToJson(update);
    assertFalse(payload.contains("original"));
    assertFalse(payload.contains("changed"));
  }

  @Test
  void discardedTransactionDoesNotEnqueueLiveWrites() {
    PostCommitActionQueue.begin();
    RdfUpdater.addGlossaryTermRelation(UUID.randomUUID(), UUID.randomUUID(), "relatedTo");
    PostCommitActionQueue.clear();
    assertTrue(submitted.isEmpty());
  }

  @Test
  void postCommitWritesRetainEntityAndRelationshipOrder() {
    final UUID id = UUID.randomUUID();
    PostCommitActionQueue.begin();
    RdfUpdater.updateEntity(new Table().withId(id).withName("table"));
    RdfUpdater.addGlossaryTermRelation(id, UUID.randomUUID(), "relatedTo");
    RdfUpdater.deleteEntity(new EntityReference().withType(Entity.TABLE).withId(id));

    PostCommitActionQueue.run(PostCommitActionQueue.drain());

    assertEquals(
        List.of(
            RdfLiveWrite.EntityUpdate.class,
            RdfLiveWrite.GlossaryRelationChange.class,
            RdfLiveWrite.EntityDelete.class),
        submitted.stream().map(Object::getClass).toList());
  }

  @ParameterizedTest
  @CsvSource({
    "glossaryTerm,glossaryTerm,RELATED_TO,false",
    "glossaryTerm,glossaryTerm,CONTAINS,true",
    "table,glossaryTerm,RELATED_TO,true",
    "dashboard,aiChart,CONTAINS,false",
    "aiChart,dashboard,CONTAINS,false"
  })
  void genericRelationshipHooksPreserveTypedOwnershipAndExcludedEntities(
      final String from, final String to, final Relationship type, final boolean expected) {
    final EntityRelationship relationship =
        new EntityRelationship()
            .withFromId(UUID.randomUUID())
            .withToId(UUID.randomUUID())
            .withFromEntity(from)
            .withToEntity(to)
            .withRelationshipType(type);
    RdfUpdater.addRelationship(relationship);
    RdfUpdater.removeRelationship(relationship);
    assertEquals(expected ? 2 : 0, submitted.size());
    if (expected) {
      assertFalse(((RdfLiveWrite.RelationshipChange) submitted.getFirst()).remove());
      assertTrue(((RdfLiveWrite.RelationshipChange) submitted.getLast()).remove());
    }
  }

  @Test
  void excludedDeletesAreNotEnqueued() {
    RdfUpdater.deleteEntity(new EntityReference().withType("aiChart").withId(UUID.randomUUID()));
    assertTrue(submitted.isEmpty());
  }

  @Test
  void typedGlossaryRemovalIsCaptured() {
    final UUID fromId = UUID.randomUUID();
    final UUID toId = UUID.randomUUID();
    RdfUpdater.removeGlossaryTermRelation(fromId, toId, "broader");
    assertEquals(
        List.of(new RdfLiveWrite.GlossaryRelationChange(fromId, toId, "broader", true)), submitted);
  }

  @Test
  void disabledUpdaterDoesNotCaptureWrites() throws ReflectiveOperationException {
    queueField.set(null, null);
    RdfUpdater.updateEntity(new Table().withId(UUID.randomUUID()).withName("table"));
    RdfUpdater.addGlossaryTermRelation(UUID.randomUUID(), UUID.randomUUID(), "relatedTo");
    assertFalse(RdfUpdater.isEnabled());
    assertTrue(submitted.isEmpty());
  }
}

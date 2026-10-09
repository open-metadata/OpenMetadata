package org.openmetadata.service.events.lifecycle;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.type.ChangeDescription;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.service.Entity;
import org.openmetadata.service.events.lifecycle.EntityLifecycleEventDispatcher.UpdateBatch;
import org.openmetadata.service.security.policyevaluator.SubjectContext;

class EntityLifecycleUpdateBatchTest {

  private EntityLifecycleEventDispatcher dispatcher;
  private RecordingHandler search;
  private RecordingHandler otherSync;

  @BeforeEach
  void setUp() {
    dispatcher = EntityLifecycleEventDispatcher.getInstance();
    dispatcher.clearHandlers();
    search = new RecordingHandler("search", true);
    otherSync = new RecordingHandler("otherSync", false);
    dispatcher.registerHandler(search);
    dispatcher.registerHandler(otherSync);
  }

  @AfterEach
  void tearDown() {
    dispatcher.clearHandlers();
  }

  @Test
  void updatesHeldInABatchReachABatchingHandlerTogetherPerType() {
    EntityInterface<?> firstTable = entity(Entity.TABLE);
    EntityInterface<?> secondTable = entity(Entity.TABLE);
    EntityInterface<?> topic = entity(Entity.TOPIC);

    try (UpdateBatch batch = dispatcher.openUpdateBatch()) {
      updated(firstTable, secondTable, topic);
      assertTrue(search.batches.isEmpty(), "nothing is delivered before the batch closes");
    }

    assertEquals(List.of(List.of(firstTable, secondTable), List.of(topic)), search.batches);
    assertTrue(search.singles.isEmpty());
  }

  @Test
  void aHandlerThatDoesNotBatchGetsEachUpdateAsItHappens() {
    EntityInterface<?> table = entity(Entity.TABLE);

    try (UpdateBatch batch = dispatcher.openUpdateBatch()) {
      updated(table);
      assertEquals(List.of(table), otherSync.singles);
    }

    assertTrue(otherSync.batches.isEmpty());
  }

  @Test
  void onlyTheLatestUpdateOfAnEntityIsDelivered() {
    EntityInterface<?> table = entity(Entity.TABLE);

    try (UpdateBatch batch = dispatcher.openUpdateBatch()) {
      updated(table, table);
    }

    assertEquals(List.of(List.of(table)), search.batches);
  }

  @Test
  void aNestedBatchJoinsTheOuterOneWhichDelivers() {
    EntityInterface<?> table = entity(Entity.TABLE);

    try (UpdateBatch outer = dispatcher.openUpdateBatch()) {
      try (UpdateBatch inner = dispatcher.openUpdateBatch()) {
        updated(table);
      }
      assertTrue(search.batches.isEmpty(), "the inner batch does not deliver");
    }

    assertEquals(List.of(List.of(table)), search.batches);
  }

  @Test
  void outsideABatchUpdatesAreDeliveredOneByOne() {
    EntityInterface<?> table = entity(Entity.TABLE);

    updated(table);

    assertEquals(List.of(table), search.singles);
    assertTrue(search.batches.isEmpty());
  }

  private void updated(EntityInterface<?>... entities) {
    for (EntityInterface<?> entity : entities) {
      dispatcher.onEntityUpdated(entity, new ChangeDescription(), null);
    }
  }

  private static EntityInterface<?> entity(String type) {
    EntityInterface<?> entity = mock(EntityInterface.class);
    UUID id = UUID.randomUUID();
    when(entity.getId()).thenReturn(id);
    when(entity.getEntityReference()).thenReturn(new EntityReference().withId(id).withType(type));
    return entity;
  }

  private static final class RecordingHandler implements EntityLifecycleEventHandler {
    private final String name;
    private final boolean batchesUpdates;
    private final List<EntityInterface<?>> singles = new ArrayList<>();
    private final List<List<EntityInterface<?>>> batches = new ArrayList<>();

    private RecordingHandler(String name, boolean batchesUpdates) {
      this.name = name;
      this.batchesUpdates = batchesUpdates;
    }

    @Override
    public void onEntityUpdated(
        EntityInterface<?> entity,
        ChangeDescription changeDescription,
        SubjectContext subjectContext) {
      singles.add(entity);
    }

    @Override
    public void onEntitiesUpdated(
        List<? extends EntityInterface<?>> entities,
        ChangeDescription changeDescription,
        SubjectContext subjectContext) {
      batches.add(List.copyOf(entities));
    }

    @Override
    public String getHandlerName() {
      return name;
    }

    @Override
    public boolean isAsync() {
      return false;
    }

    @Override
    public boolean batchesUpdates() {
      return batchesUpdates;
    }

    @Override
    public Set<String> getSupportedEntityTypes() {
      return Set.of();
    }
  }
}

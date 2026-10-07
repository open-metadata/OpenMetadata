package org.openmetadata.service.events.lifecycle;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.type.ChangeDescription;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.EventType;
import org.openmetadata.schema.type.FieldChange;
import org.openmetadata.service.Entity;
import org.openmetadata.service.security.policyevaluator.SubjectContext;

class EntityLifecycleBatchUpdatesTest {

  private EntityLifecycleEventDispatcher dispatcher;
  private BulkHandler bulkHandler;
  private DomainsOnlyHandler domainsOnlyHandler;

  @BeforeEach
  void setUp() {
    dispatcher = EntityLifecycleEventDispatcher.getInstance();
    dispatcher.clearHandlers();
    bulkHandler = new BulkHandler();
    domainsOnlyHandler = new DomainsOnlyHandler();
    dispatcher.registerHandler(bulkHandler);
    dispatcher.registerHandler(domainsOnlyHandler);
  }

  @AfterEach
  void tearDown() {
    dispatcher.clearHandlers();
  }

  @Test
  void updatesInsideTheScopeReachABulkHandlerInOneCallAfterTheWork() {
    EntityInterface first = table(change("tags"));
    EntityInterface second = table(change("tags"));

    dispatcher.batchUpdates(
        () -> {
          dispatcher.onEntityUpdated(first, first.getChangeDescription(), null);
          dispatcher.onEntityUpdated(second, second.getChangeDescription(), null);
          assertTrue(bulkHandler.batches.isEmpty(), "nothing is delivered before the work ends");
        });

    assertEquals(List.of(List.of(first, second)), bulkHandler.batches);
    assertEquals(List.of(true), bulkHandler.refreshes, "the batch must be searchable on delivery");
  }

  @Test
  void anEntityUpdatedTwiceIsDeliveredOnce() {
    EntityInterface table = table(change("tags"));

    dispatcher.batchUpdates(
        () -> {
          dispatcher.onEntityUpdated(table, table.getChangeDescription(), null);
          dispatcher.onEntityUpdated(table, table.getChangeDescription(), null);
        });

    assertEquals(List.of(List.of(table)), bulkHandler.batches);
  }

  @Test
  void aNestedScopeJoinsTheOuterOne() {
    EntityInterface outer = table(change("tags"));
    EntityInterface inner = table(change("tags"));

    dispatcher.batchUpdates(
        () -> {
          dispatcher.onEntityUpdated(outer, outer.getChangeDescription(), null);
          dispatcher.batchUpdates(
              () -> dispatcher.onEntityUpdated(inner, inner.getChangeDescription(), null));
          assertTrue(bulkHandler.batches.isEmpty(), "the inner scope must not flush on its own");
        });

    assertEquals(List.of(List.of(outer, inner)), bulkHandler.batches);
  }

  @Test
  void updatesOutsideAScopeAreDeliveredOneByOneAsBefore() {
    EntityInterface table = table(change("domains"));

    dispatcher.onEntityUpdated(table, table.getChangeDescription(), null);

    assertTrue(bulkHandler.batches.isEmpty());
    assertEquals(List.of(table), bulkHandler.single);
    assertEquals(List.of(table), domainsOnlyHandler.updated);
  }

  private static EntityInterface table(ChangeDescription change) {
    UUID id = UUID.randomUUID();
    EntityInterface entity = mock(EntityInterface.class);
    when(entity.getId()).thenReturn(id);
    when(entity.getEntityReference())
        .thenReturn(new EntityReference().withId(id).withType(Entity.TABLE));
    when(entity.getChangeDescription()).thenReturn(change);
    return entity;
  }

  private static ChangeDescription change(String field) {
    return new ChangeDescription()
        .withFieldsUpdated(new ArrayList<>(List.of(new FieldChange().withName(field))));
  }

  /** A sync handler that records bulk deliveries separately from single ones, like search. */
  private static final class BulkHandler implements EntityLifecycleEventHandler {
    private final List<List<EntityInterface>> batches = new ArrayList<>();
    private final List<Boolean> refreshes = new ArrayList<>();
    private final List<EntityInterface> single = new ArrayList<>();

    @Override
    public void onEntityUpdated(
        EntityInterface entity, ChangeDescription change, SubjectContext subjectContext) {
      single.add(entity);
    }

    @Override
    public void onEntitiesUpdated(
        List<? extends EntityInterface> entities,
        ChangeDescription change,
        SubjectContext subjectContext,
        EntityUpdateContext updateContext) {
      batches.add(List.copyOf(entities));
      refreshes.add(updateContext.refreshSearch());
    }

    @Override
    public String getHandlerName() {
      return "BulkHandler";
    }

    @Override
    public boolean isAsync() {
      return false;
    }
  }

  /** A sync handler that only acts on domain changes, like the domain sync handler. */
  private static final class DomainsOnlyHandler implements EntityLifecycleEventHandler {
    private final List<EntityInterface> updated = new ArrayList<>();

    @Override
    public boolean shouldProcess(EventType eventType, ChangeDescription change) {
      return change != null
          && change.getFieldsUpdated().stream().anyMatch(f -> "domains".equals(f.getName()));
    }

    @Override
    public void onEntityUpdated(
        EntityInterface entity, ChangeDescription change, SubjectContext subjectContext) {
      updated.add(entity);
    }

    @Override
    public String getHandlerName() {
      return "DomainsOnlyHandler";
    }

    @Override
    public boolean isAsync() {
      return false;
    }
  }
}

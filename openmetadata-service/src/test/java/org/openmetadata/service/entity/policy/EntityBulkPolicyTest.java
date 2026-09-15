package org.openmetadata.service.entity.policy;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;
import static org.openmetadata.schema.type.EventType.ENTITY_UPDATED;

import java.time.Clock;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.openmetadata.schema.entity.data.Container;
import org.openmetadata.schema.type.ChangeDescription;
import org.openmetadata.schema.type.ChangeEvent;
import org.openmetadata.schema.type.FieldChange;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.entity.EntityModuleDependencies;
import org.openmetadata.service.jdbi3.AccessControlDAOs.ChangeEventDAO;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.util.EntityUtil.Fields;
import org.openmetadata.service.util.EntityUtil.RelationIncludes;

class EntityBulkPolicyTest {
  @ParameterizedTest
  @ValueSource(booleans = {false, true})
  void persistedIncrementalEventsKeepTheActorAndExplicitPreviousVersion(boolean explicitVersion) {
    final var fixture = new Fixture();
    final Container original = entity().withVersion(0.1);
    final Container updated = JsonUtils.deepCopy(original, Container.class).withVersion(0.2);
    final ChangeDescription changes = change();
    changes.setPreviousVersion(explicitVersion ? 0.05 : null);
    fixture.policy.createAndInsertChangeEvent(original, updated, changes, ENTITY_UPDATED);

    assertEquals(1, fixture.rows.size());
    final ChangeEvent stored = JsonUtils.readValue(fixture.rows.getFirst(), ChangeEvent.class);
    assertNotNull(stored.getId());
    assertNotNull(stored.getTimestamp());
    assertEquals(original.getId(), stored.getEntityId());
    assertEquals(updated.getFullyQualifiedName(), stored.getEntityFullyQualifiedName());
    assertEquals("container", stored.getEntityType());
    assertEquals("importer", stored.getUserName());
    assertEquals(ENTITY_UPDATED, stored.getEventType());
    assertEquals(0.2, stored.getCurrentVersion());
    assertEquals(explicitVersion ? 0.05 : 0.1, stored.getPreviousVersion());
    assertEquals(stored.getPreviousVersion(), changes.getPreviousVersion());
    assertEquals(changes, stored.getChangeDescription());
    assertEquals(updated, JsonUtils.convertValue(stored.getEntity(), Container.class));
  }

  @Test
  void nullAndEmptyChangesDoNotInsertAuditEvents() {
    final var fixture = new Fixture();
    final Container entity = entity();
    fixture.policy.createAndInsertChangeEvent(entity, entity, null, ENTITY_UPDATED);
    fixture.policy.createAndInsertChangeEvent(
        entity, entity, new ChangeDescription(), ENTITY_UPDATED);
    assertTrue(fixture.rows.isEmpty());
  }

  @Test
  void eventActorCanDifferFromTheEntityUpdaterWithoutChangingTheEntity() {
    final var fixture = new Fixture();
    final Container entity = entity();
    final ChangeDescription change = change();
    final ChangeEvent explicit =
        fixture.policy.getChangeEvent(entity, change, "container", 0.1, "administrator");
    final ChangeEvent implicit = fixture.policy.getChangeEvent(entity, change, "container", 0.1);
    assertEquals("administrator", explicit.getUserName());
    assertEquals("importer", implicit.getUserName());
    assertEquals(entity.getId(), explicit.getEntityId());
    assertEquals(entity.getFullyQualifiedName(), implicit.getEntityFullyQualifiedName());
    assertEquals(change, explicit.getChangeDescription());
    assertEquals("importer", entity.getUpdatedBy());
    assertTrue(fixture.rows.isEmpty());
  }

  @ParameterizedTest
  @ValueSource(booleans = {false, true})
  void membershipDiffsRetainAddedAndRemovedValues(boolean adding) {
    final var policy = new Fixture().policy;
    final var added = List.of(UUID.randomUUID());
    final var removed = List.of(UUID.randomUUID());
    final ChangeDescription change =
        policy.addBulkAddRemoveChangeDescription(0.3, adding, added, removed);
    final var fields = adding ? change.getFieldsAdded() : change.getFieldsDeleted();
    assertEquals(0.3, change.getPreviousVersion());
    assertEquals(1, fields.size());
    assertEquals("assets", fields.getFirst().getName());
    assertEquals(added, fields.getFirst().getNewValue());
    assertEquals(removed, fields.getFirst().getOldValue());
    assertTrue((adding ? change.getFieldsDeleted() : change.getFieldsAdded()).isEmpty());
  }

  @Test
  void unsupportedCsvOperationsKeepTheirEntitySpecificError() {
    final var policy = new Fixture().policy;
    final String message =
        "Upload/download CSV for bulk operations is not supported for entity [container]";
    assertEquals(
        message,
        assertThrows(
                IllegalArgumentException.class, () -> policy.exportToCsv("name", "importer", false))
            .getMessage());
    assertEquals(
        message,
        assertThrows(
                IllegalArgumentException.class,
                () -> policy.importFromCsv("name", "csv", true, "importer", false))
            .getMessage());
    assertEquals(
        message,
        assertThrows(
                IllegalArgumentException.class,
                () -> policy.importFromCsv("name", "csv", true, "importer", false, "table"))
            .getMessage());
  }

  @Test
  void unsupportedAssetTagOperationsFailWithoutProducingAnAuditEvent() {
    final var fixture = new Fixture();
    final UUID id = UUID.randomUUID();
    assertEquals(
        "Bulk Add tags to Asset operation not supported",
        assertThrows(
                UnsupportedOperationException.class,
                () -> fixture.policy.bulkAddAndValidateTagsToAssets(id, null))
            .getMessage());
    assertEquals(
        "Bulk Remove tags to Asset operation not supported",
        assertThrows(
                UnsupportedOperationException.class,
                () -> fixture.policy.bulkRemoveAndValidateTagsToAssets(id, null))
            .getMessage());
    assertTrue(fixture.rows.isEmpty());
  }

  private static Container entity() {
    return new Container()
        .withId(UUID.randomUUID())
        .withName("container")
        .withFullyQualifiedName("storage.container")
        .withUpdatedBy("importer")
        .withVersion(0.2);
  }

  private static ChangeDescription change() {
    final var changes = new ChangeDescription();
    changes
        .getFieldsUpdated()
        .add(new FieldChange().withName("description").withOldValue("old").withNewValue("new"));
    return changes;
  }

  private static final class Fixture {
    private final List<String> rows = new ArrayList<>();
    private final FlatPolicy policy;

    private Fixture() {
      final CollectionDAO daos = mock(CollectionDAO.class);
      final ChangeEventDAO events = mock(ChangeEventDAO.class);
      when(daos.changeEventDAO()).thenReturn(events);
      doAnswer(
              call -> {
                rows.add(call.getArgument(0, String.class));
                return null;
              })
          .when(events)
          .insert(anyString());
      final var context =
          new EntityPolicyContext<>(
              new EntityPolicyContext.Schema<>("/containers", "container", Container.class, null),
              new EntityPolicyContext.WriteFields("", "", Set.of()),
              new EntityModuleDependencies(daos, null, null, null, Clock.systemUTC()));
      policy = new FlatPolicy(context);
      context.bind(policy);
    }
  }

  private record FlatPolicy(EntityPolicyContext<Container> context)
      implements EntityPolicy<Container> {
    @Override
    public void setFields(Container entity, Fields fields, RelationIncludes includes) {}

    @Override
    public void clearFields(Container entity, Fields fields) {}

    @Override
    public void prepare(Container entity, boolean update) {}

    @Override
    public void storeEntity(Container entity, boolean update) {}

    @Override
    public void storeRelationships(Container entity) {}
  }
}

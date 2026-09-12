package org.openmetadata.service.entity.write;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotSame;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;
import static org.openmetadata.schema.type.EventType.ENTITY_CREATED;
import static org.openmetadata.schema.type.EventType.ENTITY_NO_CHANGE;
import static org.openmetadata.schema.type.EventType.ENTITY_UPDATED;

import jakarta.json.Json;
import jakarta.json.JsonPatch;
import java.net.URI;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import java.util.function.Consumer;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import org.junit.jupiter.params.provider.ValueSource;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.type.ChangeDescription;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.EventType;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.entity.history.EntityHistoryType;
import org.openmetadata.service.entity.history.EntityVersionStore;
import org.openmetadata.service.entity.read.EntityReadService;
import org.openmetadata.service.entity.read.EntityReader;
import org.openmetadata.service.exception.EntityLockedException;
import org.openmetadata.service.exception.PreconditionFailedException;
import org.openmetadata.service.jdbi3.CoreRelationshipDAOs.EntityExtensionDAO;
import org.openmetadata.service.util.EntityETag;
import org.openmetadata.service.util.EntityUtil.Fields;

class EntityCommandServicesTest {
  private static final Clock CLOCK = Clock.fixed(Instant.ofEpochMilli(1000), ZoneOffset.UTC);
  private static final URI HREF = URI.create("http://localhost/api/v1/tables/example");
  private final Table original =
      new Table()
          .withId(UUID.randomUUID())
          .withName("example")
          .withFullyQualifiedName("service.database.schema.example")
          .withVersion(0.2)
          .withDescription("before")
          .withUpdatedBy("original")
          .withUpdatedAt(100L)
          .withImpersonatedBy("previous actor");
  private final EntityReference inheritedOwner =
      new EntityReference().withId(UUID.randomUUID()).withType("user");
  private final List<Table> rows = new ArrayList<>();
  private final Set<String> inheritedFields = new HashSet<>(Set.of("description", "owners"));
  private final List<Fields> inheritedSelections = new ArrayList<>();
  private final EntityVersionStore<Table> history =
      new EntityVersionStore<>(
          new EntityHistoryType<>("table", Table.class, "table_entity"),
          () -> mock(EntityExtensionDAO.class),
          JsonUtils::pojoToJson);
  private final EntityUpdateStore<Table> store =
      new EntityUpdateStore<>(
          history, new EntityUpdateStore.Rows<>(this::write, this::writeIfCurrent));
  private final EntityUpdateWorkflow<Table> workflow = new EntityUpdateWorkflow<>(history, store);
  private Double currentVersion = original.getVersion();

  @Test
  void explicitCreateReturnsHrefAfterPersistence() {
    final Table entity = JsonUtils.deepCopy(original, Table.class);
    final Table created =
        creationService(null, value -> {})
            .create(null, entity, new EntityCommandActor("editor", "acting-admin"));
    assertSame(entity, created);
    assertEquals(HREF, created.getHref());
    assertEquals("editor", rows.getFirst().getUpdatedBy());
    assertEquals("acting-admin", rows.getFirst().getImpersonatedBy());
    assertNull(rows.getFirst().getHref());
  }

  @ParameterizedTest
  @ValueSource(booleans = {false, true})
  void explicitCreateSetsActorAfterPreparation(boolean explicitActor) {
    final Table entity = JsonUtils.deepCopy(original, Table.class);
    final Table created =
        creationService(null, value -> {})
            .create(entity, new EntityCommandActor(explicitActor ? "editor" : null, null));
    assertSame(entity, created);
    assertEquals(explicitActor ? "editor" : "prepared", rows.getFirst().getUpdatedBy());
    assertNull(rows.getFirst().getImpersonatedBy());
  }

  @ParameterizedTest
  @ValueSource(booleans = {false, true})
  void missingUpsertPreservesPreparedAuditAndReturnsCreated(boolean importMode) {
    final Table entity = JsonUtils.deepCopy(original, Table.class).withUpdatedBy("prepared caller");
    final var response =
        creationService(null, value -> {})
            .upsert(null, entity, new EntityCommandActor("editor", "acting-admin"), importMode);
    assertEquals(ENTITY_CREATED, response.getChangeType());
    assertEquals(HREF, response.getEntity().getHref());
    assertEquals("prepared caller", rows.getFirst().getUpdatedBy());
    assertEquals("acting-admin", rows.getFirst().getImpersonatedBy());
    assertNull(rows.getFirst().getHref());
  }

  @ParameterizedTest
  @ValueSource(booleans = {false, true})
  void existingUpsertUsesTheSharedUpdateWorkflow(boolean importMode) {
    final Table entity = JsonUtils.deepCopy(original, Table.class).withDescription("after");
    final var response =
        creationService(original, value -> {})
            .upsert(null, entity, new EntityCommandActor("editor", null), importMode);
    assertEquals(ENTITY_UPDATED, response.getChangeType());
    assertEquals(0.3, rows.getFirst().getVersion());
    assertEquals("editor", rows.getFirst().getUpdatedBy());
    assertEquals(List.of(inheritedOwner), response.getEntity().getOwners());
    assertNull(rows.getFirst().getOwners());
  }

  @ParameterizedTest
  @ValueSource(booleans = {false, true})
  void deletionLocksRejectMutationsBeforePreparationOrPersistence(boolean upsert) {
    final EntityLockedException failure = new EntityLockedException("Parent is being deleted");
    final var service =
        creationService(
            null,
            entity -> {
              throw failure;
            });
    final Table entity = JsonUtils.deepCopy(original, Table.class);
    final EntityCommandActor actor = new EntityCommandActor("editor", null);
    assertSame(
        failure,
        assertThrows(
            EntityLockedException.class,
            () -> {
              if (upsert) {
                service.upsert(null, entity, actor, false);
              } else {
                service.create(entity, actor);
              }
            }));
    assertTrue(rows.isEmpty());
    assertEquals(original.getUpdatedBy(), entity.getUpdatedBy());
  }

  @Test
  void importUpsertRetainsItsExistingLockBypass() {
    final var service =
        creationService(
            null,
            entity -> {
              throw new EntityLockedException("Parent is being deleted");
            });
    final var response =
        service.upsert(null, original, new EntityCommandActor("editor", null), true);
    assertEquals(ENTITY_CREATED, response.getChangeType());
    assertEquals(1, rows.size());
  }

  private EntityCreates<Table> creationService(
      Table found, Consumer<Table> checkModificationAllowed) {
    return commands(found, checkModificationAllowed).creates();
  }

  @ParameterizedTest
  @EnumSource(EntityPutService.Mode.class)
  void putModesPreserveAuditHistoryAndInheritedResponse(EntityPutService.Mode mode) {
    final Table updated = JsonUtils.deepCopy(original, Table.class).withDescription("after");
    final var response =
        putService().update(null, original, updated, new EntityCommandActor("editor", null), mode);
    assertEquals("after", rows.getFirst().getDescription());
    assertEquals("editor", rows.getFirst().getUpdatedBy());
    assertEquals(1000L, rows.getFirst().getUpdatedAt());
    assertNull(rows.getFirst().getImpersonatedBy());
    assertEquals(0.3, response.getEntity().getVersion());
    assertEquals(List.of(inheritedOwner), response.getEntity().getOwners());
    assertEquals(HREF, response.getEntity().getHref());
    assertEquals(
        "before",
        response.getEntity().getChangeDescription().getFieldsUpdated().getFirst().getOldValue());
    assertNull(
        rows.getFirst().getOwners(), "Inherited response fields must not enter the stored row");
  }

  @Test
  void putNoOpRetainsOriginalAuditAndChangeDescription() {
    original.setChangeDescription(new ChangeDescription().withPreviousVersion(0.1));
    final Table updated = JsonUtils.deepCopy(original, Table.class);
    final var response =
        putService()
            .update(
                null,
                original,
                updated,
                new EntityCommandActor("editor", "impersonator"),
                EntityPutService.Mode.NORMAL);
    assertTrue(rows.isEmpty());
    assertEquals("original", response.getEntity().getUpdatedBy());
    assertEquals(100L, response.getEntity().getUpdatedAt());
    assertSame(original.getChangeDescription(), response.getEntity().getChangeDescription());
  }

  @Test
  void putRestoresSoftDeletedEntitiesBeforeUpdating() {
    original.setDeleted(true);
    final Table updated = JsonUtils.deepCopy(original, Table.class).withDescription("after");
    putService()
        .update(
            null,
            original,
            updated,
            new EntityCommandActor("editor", null),
            EntityPutService.Mode.IMPORT);
    assertFalse(original.getDeleted());
    assertEquals("after", rows.getFirst().getDescription());
  }

  @Test
  void optimisticPutPropagatesAConcurrentVersionConflict() {
    currentVersion = 0.3;
    final Table updated = JsonUtils.deepCopy(original, Table.class).withDescription("after");
    assertThrows(
        PreconditionFailedException.class,
        () ->
            putService()
                .update(
                    null,
                    original,
                    updated,
                    new EntityCommandActor("editor", null),
                    EntityPutService.Mode.OPTIMISTIC));
    assertTrue(rows.isEmpty());
    assertNull(updated.getOwners());
  }

  @ParameterizedTest
  @ValueSource(booleans = {false, true})
  void patchByIdAndNameHasTheSameProjectionAndAudit(boolean byName) {
    final var target =
        byName
            ? new EntityPatchService.Target.Name(original.getFullyQualifiedName())
            : new EntityPatchService.Target.Id(original.getId());
    final var response =
        patchService()
            .patch(
                target,
                descriptionPatch("after"),
                new EntityCommandActor("editor", "acting-admin"),
                null,
                new EntityPatchService.Options(null, null));
    assertEquals("after", rows.getFirst().getDescription());
    assertEquals("editor", rows.getFirst().getUpdatedBy());
    assertEquals("acting-admin", rows.getFirst().getImpersonatedBy());
    assertEquals(1000L, rows.getFirst().getUpdatedAt());
    assertEquals(List.of(inheritedOwner), response.entity().getOwners());
    assertEquals(HREF, response.entity().getHref());
    assertEquals(ENTITY_UPDATED, response.changeType());
    assertEquals("before", original.getDescription());
    assertNotSame(original, response.entity());
  }

  @Test
  void noOpPatchSkipsInheritanceAndKeepsAnEmptyIncrementalDescription() {
    final var response =
        patchService()
            .patch(
                new EntityPatchService.Target.Id(original.getId()),
                descriptionPatch("before"),
                new EntityCommandActor("editor", null),
                null,
                new EntityPatchService.Options(null, ""));
    assertTrue(rows.isEmpty());
    assertNull(response.entity().getOwners());
    assertEquals(ENTITY_NO_CHANGE, response.changeType());
    assertFalse(EntityChangeRecorder.hasChanges(response.entity().getChangeDescription()));
    assertEquals(100L, response.entity().getUpdatedAt());
  }

  @Test
  void matchingPatchETagStillChecksTheVersionAtPersistence() {
    currentVersion = 0.3;
    assertThrows(
        PreconditionFailedException.class,
        () ->
            patchService()
                .patch(
                    new EntityPatchService.Target.Id(original.getId()),
                    descriptionPatch("after"),
                    new EntityCommandActor("editor", null),
                    null,
                    new EntityPatchService.Options(null, EntityETag.generateWeakETag(original))));
    assertTrue(rows.isEmpty());
  }

  @Test
  void stalePatchETagFailsBeforeApplyingThePatch() {
    assertThrows(
        PreconditionFailedException.class,
        () ->
            patchService()
                .patch(
                    new EntityPatchService.Target.Id(original.getId()),
                    Json.createPatchBuilder().remove("/absent").build(),
                    new EntityCommandActor("editor", null),
                    null,
                    new EntityPatchService.Options(null, "W/\"0.1\"")));
    assertTrue(rows.isEmpty());
    assertEquals("before", original.getDescription());
  }

  private EntityPuts<Table> putService() {
    return commands(original, entity -> {}).puts();
  }

  @Test
  void putInheritsFieldsAddedAfterCommandConstruction() {
    final EntityCommands<Table> commands = commands(original, entity -> {});
    assertTrue(rows.isEmpty());
    assertTrue(inheritedSelections.isEmpty());
    inheritedFields.add("tags");
    final Table updated = JsonUtils.deepCopy(original, Table.class).withDescription("after");
    commands
        .puts()
        .update(
            null,
            original,
            updated,
            new EntityCommandActor("editor", null),
            EntityPutService.Mode.NORMAL);
    assertEquals(inheritedFields, new HashSet<>(inheritedSelections.getFirst().getFieldList()));
    assertEquals("after", rows.getFirst().getDescription());
  }

  private EntityPatches<Table> patchService() {
    return commands(original, entity -> {}).patches();
  }

  private EntityCommands<Table> commands(Table found, Consumer<Table> checkModificationAllowed) {
    return new EntityCommands<>(
        new EntityCommands.Selections(fields(), fields(), this::fields),
        new EntityCommands.Reads<>(
            Table.class, name -> found, detailReads(), (entity, fields) -> {}),
        new EntityCommands.Policies<>(
            (entity, fields) -> {
              inheritedSelections.add(fields);
              inherit(entity);
            },
            (uri, entity) -> entity.withHref(HREF),
            entity -> entity.setUpdatedBy("prepared"),
            patchPreparation()),
        new EntityCommands.Writes<>(
            (before, after, source, optimistic) -> new Command(before, after),
            (before, after, source, optimistic) -> new Command(before, after),
            (user, id) -> {
              assertEquals(original.getId(), id);
              assertEquals("editor", user);
              original.setDeleted(false);
            },
            checkModificationAllowed,
            entity -> {
              write(entity);
              return entity;
            }),
        CLOCK);
  }

  private Fields fields() {
    return new Fields(inheritedFields);
  }

  private EntityReader<Table> detailReads() {
    return new EntityReader<>() {
      @Override
      public Table byId(UUID id, EntityReadService.Query query) {
        assertEquals(original.getId(), id);
        assertPatchQuery(query);
        return original;
      }

      @Override
      public Table byName(String name, EntityReadService.Query query) {
        assertEquals(original.getFullyQualifiedName(), name);
        assertPatchQuery(query);
        return original;
      }
    };
  }

  private void assertPatchQuery(EntityReadService.Query query) {
    assertNull(query.uri());
    assertEquals(fields().getFieldList(), query.fields().getFieldList());
    assertEquals(Include.NON_DELETED, query.includes().getDefaultInclude());
    assertFalse(query.fromCache());
  }

  private EntityPatchPreparation<Table> patchPreparation() {
    return new EntityPatchPreparation<>(
        (before, after) -> after,
        new EntityPatchPreparation.Rules<>(
            entity -> {}, (before, after) -> {}, (before, after) -> {}),
        new EntityPatchPreparation.References(value -> value, value -> value),
        CLOCK);
  }

  private JsonPatch descriptionPatch(String value) {
    return Json.createPatchBuilder().replace("/description", value).build();
  }

  private void inherit(Table table) {
    table.setOwners(List.of(inheritedOwner));
  }

  private void write(Table table) {
    rows.add(JsonUtils.deepCopy(table, Table.class));
  }

  private void writeIfCurrent(Table table, Double expectedVersion) {
    if (!currentVersion.equals(expectedVersion)) {
      throw new PreconditionFailedException("Concurrent update");
    }
    write(table);
  }

  private final class Command extends MutationState<Table>
      implements EntityUpdateCommand, EntityUpdateWorkflow.Session<Table> {
    private Command(Table before, Table after) {
      super(before, after);
    }

    @Override
    public void update() {
      workflow.flush(this, false, false);
    }

    @Override
    public void updateForImport() {
      workflow.flush(this, false, true);
    }

    @Override
    public void updateWithOptimisticLocking() {
      workflow.flush(this, true, false);
    }

    @Override
    public boolean fieldsChanged() {
      return EntityChangeRecorder.hasChanges(getChangeDescription());
    }

    @Override
    public EventType getChangeType() {
      return EntityChangeRecorder.hasChanges(getIncrementalChangeDescription())
          ? ENTITY_UPDATED
          : ENTITY_NO_CHANGE;
    }

    @Override
    public boolean canConsolidateChanges() {
      return false;
    }

    @Override
    public void applyChanges(boolean importMode, boolean consolidatingChanges) {
      if (PatchFieldSelection.shouldCompare(getPatchedFields(), "description")
          && !Objects.equals(getOriginal().getDescription(), getUpdated().getDescription())) {
        EntityChangeRecorder.recordValue(
            getChangeDescription(),
            "description",
            getOriginal().getDescription(),
            getUpdated().getDescription(),
            false);
        setEntityChanged(true);
      }
    }
  }
}

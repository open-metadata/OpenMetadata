package org.openmetadata.service.entity.write;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.mock;
import static org.openmetadata.service.Entity.FIELD_DESCRIPTION;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.type.EventType;
import org.openmetadata.schema.type.ResourcePermission;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.entity.history.EntityHistoryServices;
import org.openmetadata.service.entity.history.EntityHistoryType;
import org.openmetadata.service.entity.history.EntityVersionHistory;
import org.openmetadata.service.entity.metadata.EntityCertificationUpdates;
import org.openmetadata.service.entity.metadata.EntityExtensionService;
import org.openmetadata.service.entity.metadata.EntityGovernanceUpdates;
import org.openmetadata.service.entity.metadata.EntityOwnershipWriter;
import org.openmetadata.service.entity.metadata.EntityRelationshipUpdates;
import org.openmetadata.service.entity.metadata.EntityRelationshipWriter;
import org.openmetadata.service.entity.metadata.EntityTagWriter;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.CoreRelationshipDAOs.EntityExtensionDAO;

class EntityMutationServicesTest {
  private static final Clock CLOCK = Clock.fixed(Instant.ofEpochMilli(1000), ZoneOffset.UTC);
  private final Map<UUID, String> rows = new HashMap<>();
  private final List<String> versions = new ArrayList<>();
  private final List<String> published = new ArrayList<>();
  private final List<String> reactions = new ArrayList<>();
  private boolean inTransaction;
  private boolean failWrite;
  private int commits;
  private int rollbacks;

  @Test
  void composedMutationRulesStoreTheirFieldAndHistoryInTheOwningFlush() {
    final Table original = original();
    final Table updated = updated(original, original.getDescription()).withRetentionPeriod("P30D");
    final var mutation = new RetentionMutation();
    final var updater =
        new EntityUpdater<>(
            context(),
            new EntityUpdateRequest<>(original, updated, EntityOperation.PATCH, null, false),
            mutation);
    updater.update();
    final Table stored = JsonUtils.readValue(rows.get(original.getId()), Table.class);
    assertEquals("P30D", stored.getRetentionPeriod());
    assertEquals(0.2, stored.getVersion());
    assertEquals(
        "retentionPeriod", stored.getChangeDescription().getFieldsAdded().getFirst().getName());
    assertEquals(0.1, JsonUtils.readValue(versions.getFirst(), Table.class).getVersion());
    assertEquals(1, commits);
    assertEquals(0, rollbacks);
    assertEquals(List.of(rows.get(original.getId())), published);
  }

  @Test
  void composedMutationGuardsResetAfterRollbackBeforeTheNextAttempt() {
    final Table original = original();
    final String initial = JsonUtils.pojoToJson(original);
    rows.put(original.getId(), initial);
    final Table updated = updated(original, original.getDescription()).withRetentionPeriod("P30D");
    final var mutation = new RetentionMutation();
    final var updater =
        new EntityUpdater<>(
            context(),
            new EntityUpdateRequest<>(original, updated, EntityOperation.PATCH, null, false),
            mutation);
    failWrite = true;
    assertThrows(IllegalStateException.class, updater::update);
    assertEquals(Map.of(original.getId(), initial), rows);
    assertTrue(versions.isEmpty());
    assertTrue(published.isEmpty());
    failWrite = false;
    updater.update();
    final Table stored = JsonUtils.readValue(rows.get(original.getId()), Table.class);
    assertEquals("P30D", stored.getRetentionPeriod());
    assertEquals(0.2, stored.getVersion());
    assertEquals(1, commits);
    assertEquals(1, rollbacks);
    assertEquals(1, versions.size());
    assertEquals(List.of(rows.get(original.getId())), published);
  }

  private static final class RetentionMutation implements EntitySpecificMutation<Table> {
    private boolean applied;

    @Override
    public void reset() {
      applied = false;
    }

    @Override
    public void update(EntityUpdater<Table> mutation, boolean consolidating) {
      if (!applied) {
        mutation.recordChange(
            "retentionPeriod",
            mutation.getOriginal().getRetentionPeriod(),
            mutation.getUpdated().getRetentionPeriod());
        applied = true;
      }
    }
  }

  @Test
  void sharedGraphPublishesTheStoredVersionAfterOneOwningFlush() {
    final EntityUpdateContext<Table> context = context();
    final Table original = original();
    final Table updated = updated(original, "  after  ");
    updater(context, original, updated, EntityOperation.PATCH).update();
    assertEquals(1, commits);
    assertEquals(0, rollbacks);
    assertEquals(1, versions.size());
    assertEquals("before", JsonUtils.readValue(versions.getFirst(), Table.class).getDescription());
    final Table stored = JsonUtils.readValue(rows.get(original.getId()), Table.class);
    assertEquals("after", stored.getDescription());
    assertEquals(0.2, stored.getVersion());
    assertEquals(List.of(rows.get(original.getId())), published);
    assertEquals(List.of("after"), reactions);
  }

  @Test
  void failedFlushRollsBackRowsAndHistoryWithoutPublishing() {
    final Table original = original();
    final String initial = JsonUtils.pojoToJson(original);
    rows.put(original.getId(), initial);
    failWrite = true;
    final EntityUpdater<Table> updater =
        updater(context(), original, updated(original, "after"), EntityOperation.PATCH);
    assertThrows(IllegalStateException.class, updater::update);
    assertEquals(Map.of(original.getId(), initial), rows);
    assertTrue(versions.isEmpty());
    assertTrue(published.isEmpty());
    assertTrue(reactions.isEmpty());
    assertEquals(0, commits);
    assertEquals(1, rollbacks);
  }

  @Test
  void deferredBulkMutationComputesAChangeWithoutOpeningAFlushOrPublishing() {
    final Table original = original();
    final Table updated = updated(original, "after");
    final EntityUpdater<Table> updater = updater(context(), original, updated, EntityOperation.PUT);
    updater.updateWithDeferredStore();
    assertEquals(EventType.ENTITY_UPDATED, updater.getChangeType());
    assertEquals("after", updated.getDescription());
    assertEquals(1, updated.getIncrementalChangeDescription().getFieldsUpdated().size());
    assertEquals(0, commits);
    assertTrue(rows.isEmpty());
    assertTrue(versions.isEmpty());
    assertTrue(published.isEmpty());
  }

  @Test
  void deleteSkipsOrdinaryFieldPoliciesAndRetainsThePreparedDescription() {
    final Table original = original();
    final Table updated = updated(original, "  preserved  ").withDeleted(true);
    final EntityUpdater<Table> updater =
        updater(context(), original, updated, EntityOperation.SOFT_DELETE);
    updater.update();
    assertTrue(updated.getDeleted());
    assertEquals("  preserved  ", updated.getDescription());
    assertEquals(
        List.of("deleted"),
        updated.getChangeDescription().getFieldsUpdated().stream()
            .map(change -> change.getName())
            .toList());
    assertEquals(1, commits);
    assertFalse(published.isEmpty());
  }

  private EntityUpdateContext<Table> context() {
    final CollectionDAO daos =
        mock(
            CollectionDAO.class,
            invocation -> {
              throw new AssertionError(
                  "Unexpected DAO access: " + invocation.getMethod().getName());
            });
    final EntityExtensionService extensions =
        new EntityExtensionService(
            this::extensionDao,
            new EntityExtensionService.Properties(
                "table", name -> name, name -> name, name -> name),
            false);
    final EntityRelationshipWriter relationships =
        new EntityRelationshipWriter(
            () -> daos.relationshipDAO(),
            new EntityRelationshipWriter.Effects(edge -> {}, edge -> {}, (type, id) -> {}));
    final EntityOwnershipWriter<Table> ownership =
        new EntityOwnershipWriter<>(
            "table",
            () -> daos.relationshipDAO(),
            relationships,
            new EntityOwnershipWriter.Writes<>(
                (entity, owners) -> {}, (entity, domains) -> {}, (id, domain) -> {}));
    final EntityTagWriter tags =
        new EntityTagWriter(
            () -> daos.tagUsageDAO(),
            new EntityTagWriter.Rdf((tag, target) -> {}, (tag, target) -> {}));
    final EntityHistoryServices<Table> history = history();
    return EntityMutationServices.create(
        new EntityMutationServices.Schema<>("table", Table.class, Set.of(FIELD_DESCRIPTION)),
        new EntityMutationServices.Metadata<>(
            daos,
            new EntityRelationshipUpdates(() -> daos.relationshipDAO(), relationships),
            ownership,
            tags,
            extensions),
        policies(),
        new EntityMutationServices.Execution<>(
            history,
            new EntityMutationLifecycle.Execution<>(
                this::transaction, history.updateWorkflow()::flush, () -> {}),
            (original, updated) -> {
              assertFalse(inTransaction);
              reactions.add(updated.getDescription());
            },
            hooks(),
            CLOCK));
  }

  private EntityMutationServices.Policies<Table> policies() {
    return new EntityMutationServices.Policies<>(
        value -> value == null ? null : value.strip(),
        value -> value,
        new EntityMutationServices.Governance(
            new EntityGovernanceUpdates.Validation(refs -> {}, refs -> {}, refs -> {}),
            new EntityGovernanceUpdates.Lineage((id, type, refs) -> {}, (id, type, refs) -> {}),
            (entity, actor) -> {}),
        new EntityMutationServices.Certification<>(
            () -> {
              throw new AssertionError("Unsupported certification must not read settings");
            },
            new EntityCertificationUpdates.Persistence<>(fqn -> {}, entity -> {}),
            () -> "Certification",
            labels -> {}));
  }

  private EntityHistoryServices<Table> history() {
    return new EntityHistoryServices<>(
        new EntityHistoryType<>("table", Table.class, "table_entity"),
        new EntityHistoryServices.Storage<>(
            this::extensionDao,
            JsonUtils::pojoToJson,
            new EntityUpdateStore.Rows<>(this::write, (entity, expected) -> write(entity))),
        new EntityHistoryServices.Hydration<>(
            id -> null,
            new EntityVersionHistory.Hydration<>(entity -> entity, entity -> {}),
            entities -> {}),
        new EntityHistoryServices.Changes(Set.of(), () -> 0L));
  }

  private EntityUpdateContext.Hooks<Table> hooks() {
    return new EntityUpdateContext.Hooks<>(
        name -> new User().withName(name).withIsBot(false),
        user ->
            new EntityMutationPermissions(
                () -> new ResourcePermission().withPermissions(List.of())),
        (entity, before, after) -> {},
        (entity, oldName) -> {
          assertFalse(inTransaction);
          published.add(rows.get(entity.getId()));
        });
  }

  private EntityExtensionDAO extensionDao() {
    assertTrue(inTransaction);
    final EntityExtensionDAO dao = mock(EntityExtensionDAO.class);
    doAnswer(
            invocation -> {
              versions.add(invocation.getArgument(3));
              return null;
            })
        .when(dao)
        .insert(any(UUID.class), anyString(), anyString(), anyString());
    return dao;
  }

  private void write(final Table entity) {
    assertTrue(inTransaction);
    rows.put(entity.getId(), JsonUtils.pojoToJson(entity));
    if (failWrite) {
      throw new IllegalStateException("row failed");
    }
  }

  private void transaction(final Runnable work) {
    assertFalse(inTransaction);
    final Map<UUID, String> before = Map.copyOf(rows);
    final List<String> oldVersions = List.copyOf(versions);
    inTransaction = true;
    try {
      work.run();
      commits++;
    } catch (RuntimeException failure) {
      rows.clear();
      rows.putAll(before);
      versions.clear();
      versions.addAll(oldVersions);
      rollbacks++;
      throw failure;
    } finally {
      inTransaction = false;
    }
  }

  private EntityUpdater<Table> updater(
      final EntityUpdateContext<Table> context,
      final Table original,
      final Table updated,
      final EntityOperation operation) {
    final EntityUpdater<Table> updater =
        new EntityUpdater<>(
            context, new EntityUpdateRequest<>(original, updated, operation, null, false));
    if (!operation.isDelete()) {
      updater.setPatchedFields(Set.of(FIELD_DESCRIPTION));
    }
    return updater;
  }

  private Table original() {
    return new Table()
        .withId(UUID.randomUUID())
        .withName("table")
        .withFullyQualifiedName("service.db.schema.table")
        .withDescription("before")
        .withVersion(0.1)
        .withDeleted(false)
        .withUpdatedBy("creator")
        .withUpdatedAt(100L);
  }

  private Table updated(final Table original, final String description) {
    return JsonUtils.deepCopy(original, Table.class)
        .withDescription(description)
        .withUpdatedBy("editor")
        .withUpdatedAt(1000L);
  }
}

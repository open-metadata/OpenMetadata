package org.openmetadata.service.entity.metadata;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.function.Supplier;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import org.junit.jupiter.params.provider.NullSource;
import org.junit.jupiter.params.provider.ValueSource;
import org.openmetadata.schema.entity.teams.Team;
import org.openmetadata.schema.type.ApiStatus;
import org.openmetadata.schema.type.ChangeDescription;
import org.openmetadata.schema.type.ChangeEvent;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.FieldChange;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.schema.type.api.BulkAssets;
import org.openmetadata.schema.type.api.BulkOperationResult;
import org.openmetadata.service.Entity;
import org.openmetadata.service.entity.metadata.EntityAssetMembership.Mode;
import org.openmetadata.service.entity.metadata.EntityAssetMembership.Target;

class EntityAssetMembershipTest {
  @ParameterizedTest
  @EnumSource(Mode.class)
  void mutationsPersistEdgesBeforeInvalidationAndSearchThenReadTheAuditSource(Mode mode) {
    final Fixture fixture = new Fixture();
    if (mode == Mode.REMOVE) {
      fixture.seed();
    }
    final var result = fixture.service.apply(fixture.target, fixture.request, mode, "editor");
    assertEquals(ApiStatus.SUCCESS, result.getStatus());
    assertFalse(result.getDryRun());
    assertEquals(2, result.getNumberOfRowsProcessed());
    assertEquals(2, result.getNumberOfRowsPassed());
    assertSame(fixture.assets.getFirst(), result.getSuccessRequest().getFirst().getRequest());
    assertEquals(mode == Mode.ADD ? 2 : 0, fixture.store.rows.size());
    assertEquals(
        List.of(
            "validate",
            "invalidate:alice",
            "index:alice",
            "invalidate:bob",
            "index:bob",
            "source",
            "event"),
        fixture.order);
    assertEquals(2, fixture.store.writes);
    final ChangeEvent event = fixture.events.getFirst();
    assertSame(fixture.owner, event.getEntity());
    assertEquals("editor", event.getUserName());
    assertEquals(0.7, event.getPreviousVersion());
    final List<FieldChange> changes =
        mode == Mode.ADD
            ? event.getChangeDescription().getFieldsAdded()
            : event.getChangeDescription().getFieldsDeleted();
    assertSame(fixture.assets, changes.getFirst().getNewValue());
    assertEquals("assets", changes.getFirst().getName());
    result.getSuccessRequest().clear();
    assertTrue(result.getSuccessRequest().isEmpty());
  }

  @ParameterizedTest
  @EnumSource(Mode.class)
  void dryRunsValidateAndHydrateReferencesWithoutWritingOrReadingAuditSource(Mode mode) {
    final Fixture fixture = new Fixture();
    fixture.request.setDryRun(true);
    final var result = fixture.service.apply(fixture.target, fixture.request, mode, "editor");
    assertTrue(result.getDryRun());
    assertEquals(2, result.getNumberOfRowsPassed());
    assertEquals(2, result.getNumberOfRowsProcessed());
    assertEquals("alice", fixture.assets.getFirst().getFullyQualifiedName());
    assertEquals(List.of("validate"), fixture.order);
    assertEquals(0, fixture.store.writes);
    assertTrue(fixture.events.isEmpty());
  }

  @ParameterizedTest
  @NullSource
  @ValueSource(booleans = {false, true})
  void emptyRequestsKeepTheNothingToValidateResponse(Boolean dryRun) {
    final Fixture fixture = new Fixture();
    fixture.request.setAssets(null);
    fixture.request.setDryRun(dryRun);
    final var result = fixture.service.apply(fixture.target, fixture.request, Mode.ADD, null);
    assertEquals("Nothing to Validate.", result.getSuccessRequest().getFirst().getMessage());
    assertEquals(Boolean.TRUE.equals(dryRun), result.getDryRun());
    assertEquals(0, result.getNumberOfRowsProcessed());
    assertEquals(0, result.getNumberOfRowsPassed());
    assertTrue(fixture.order.isEmpty());
    fixture.request.setAssets(List.of());
    assertEquals(result, fixture.service.apply(fixture.target, fixture.request, Mode.ADD, null));
  }

  @Test
  void omittedActorUsesTheSourceReadAfterMembershipChanges() {
    final Fixture fixture = new Fixture();
    fixture.service.apply(fixture.target, fixture.request, Mode.ADD, null);
    assertEquals("latest-editor", fixture.events.getFirst().getUserName());
  }

  @Test
  void validationFailurePrecedesEveryWrite() {
    final Fixture fixture = new Fixture();
    final var failure = new IllegalArgumentException("Missing asset");
    fixture.validationFailure = failure;
    assertSame(
        failure,
        assertThrows(
            IllegalArgumentException.class,
            () -> fixture.service.apply(fixture.target, fixture.request, Mode.ADD, null)));
    assertTrue(fixture.store.rows.isEmpty());
    assertTrue(fixture.events.isEmpty());
    assertEquals(List.of("validate"), fixture.order);
  }

  @Test
  void failedRelationshipDoesNotInvalidateMetadataIndexOrRecordAnEvent() {
    final Fixture fixture = new Fixture();
    final var failure = new IllegalStateException("Database unavailable");
    fixture.store.failure = failure;
    assertSame(
        failure,
        assertThrows(
            IllegalStateException.class,
            () -> fixture.service.apply(fixture.target, fixture.request, Mode.ADD, null)));
    assertTrue(fixture.store.rows.isEmpty());
    assertEquals(List.of("validate"), fixture.order);
  }

  @Test
  void aFailedInTransactionEffectRollsBackMembership() {
    final Fixture fixture = new Fixture();
    final var failure = new IllegalStateException("Search unavailable");
    fixture.indexFailure = failure;
    assertSame(
        failure,
        assertThrows(
            IllegalStateException.class,
            () -> fixture.service.apply(fixture.target, fixture.request, Mode.ADD, null)));
    assertEquals(0, fixture.store.rows.size());
    assertEquals(List.of("validate", "invalidate:alice", "index:alice"), fixture.order);
    assertTrue(fixture.events.isEmpty());
  }

  @Test
  void failedAuditInsertRollsBackAllEdgesAndItsEvent() {
    final Fixture fixture = new Fixture();
    final var failure = new IllegalStateException("Audit unavailable");
    fixture.auditFailure = failure;
    assertSame(
        failure,
        assertThrows(
            IllegalStateException.class,
            () -> fixture.service.apply(fixture.target, fixture.request, Mode.ADD, "editor")));
    assertTrue(fixture.store.rows.isEmpty());
    assertTrue(fixture.events.isEmpty());
  }

  @Test
  void replayBuildsFreshResponseCountersForTheAcceptedAttempt() {
    final Fixture fixture = new Fixture();
    fixture.replay = true;
    final var result = fixture.service.apply(fixture.target, fixture.request, Mode.ADD, "editor");
    assertEquals(2, result.getNumberOfRowsProcessed());
    assertEquals(2, result.getNumberOfRowsPassed());
    assertEquals(2, result.getSuccessRequest().size());
    assertEquals(2, fixture.store.rows.size());
    assertEquals(1, fixture.events.size());
    assertEquals(1, fixture.order.stream().filter("validate"::equals).count());
  }

  private static final class Fixture {
    private final RelationshipStoreFixture store = new RelationshipStoreFixture();
    private final Team owner =
        new Team().withId(UUID.randomUUID()).withVersion(0.1).withUpdatedBy("earlier-editor");
    private final Target target = new Target(owner.getId(), Entity.TEAM, Relationship.HAS);
    private final List<EntityReference> assets = List.of(reference("alice"), reference("bob"));
    private final BulkAssets request = new BulkAssets().withAssets(assets);
    private final List<String> order = new ArrayList<>();
    private final List<ChangeEvent> events = new ArrayList<>();
    private RuntimeException validationFailure;
    private RuntimeException indexFailure;
    private RuntimeException auditFailure;
    private boolean replay;
    private final EntityAssetMembership service =
        new EntityAssetMembership(
            new EntityAssetMembership.References(
                values -> {
                  order.add("validate");
                  if (validationFailure != null) {
                    throw validationFailure;
                  }
                  values.forEach(value -> value.setFullyQualifiedName(value.getName()));
                },
                (type, id) -> {
                  assertEquals(Entity.TEAM, type);
                  assertEquals(owner.getId(), id);
                  order.add("source");
                  return owner.withVersion(0.7).withUpdatedBy("latest-editor");
                }),
            store.writer(),
            new EntityAssetMembership.Effects(
                value -> {
                  assertTrue(store.writes > 0);
                  order.add("invalidate:" + value.getFullyQualifiedName());
                },
                value -> {
                  order.add("index:" + value.getName());
                  if (indexFailure != null) {
                    throw indexFailure;
                  }
                }),
            new EntityAssetMembership.Events(
                Fixture::change,
                (entity, change, type, version, actor) ->
                    new ChangeEvent()
                        .withEntity(entity)
                        .withEntityType(type)
                        .withPreviousVersion(version)
                        .withUserName(actor)
                        .withChangeDescription(change),
                event -> {
                  order.add("event");
                  events.add(event);
                  if (auditFailure != null) {
                    throw auditFailure;
                  }
                }),
            this::transaction);

    private BulkOperationResult transaction(Supplier<BulkOperationResult> work) {
      assertFalse(Boolean.TRUE.equals(request.getDryRun()));
      final var originalRows = new ArrayList<>(store.rows);
      final var originalEvents = new ArrayList<>(events);
      final Runnable restore =
          () -> {
            store.rows.clear();
            store.rows.addAll(originalRows);
            events.clear();
            events.addAll(originalEvents);
          };
      try {
        if (replay) {
          work.get();
          restore.run();
        }
        return work.get();
      } catch (RuntimeException failure) {
        restore.run();
        throw failure;
      }
    }

    private void seed() {
      for (final var asset : assets) {
        store
            .writer()
            .add(
                new EntityRelationshipWriter.Edge(
                    owner.getId(), asset.getId(), Entity.TEAM, asset.getType(), Relationship.HAS),
                EntityRelationshipWriter.Value.EMPTY,
                false);
      }
      store.writes = 0;
    }

    private static ChangeDescription change(
        Double version, boolean add, Object values, Object previous) {
      final var change = new ChangeDescription().withPreviousVersion(version);
      final var field =
          new FieldChange().withName("assets").withNewValue(values).withOldValue(previous);
      (add ? change.getFieldsAdded() : change.getFieldsDeleted()).add(field);
      return change;
    }

    private static EntityReference reference(String name) {
      return new EntityReference().withId(UUID.randomUUID()).withType(Entity.USER).withName(name);
    }
  }
}

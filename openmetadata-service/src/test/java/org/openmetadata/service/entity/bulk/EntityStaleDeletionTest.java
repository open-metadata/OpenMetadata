package org.openmetadata.service.entity.bulk;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.type.ApiStatus;
import org.openmetadata.schema.type.api.BulkDeleteStaleRequest;
import org.openmetadata.service.exception.BadRequestException;
import org.openmetadata.service.jdbi3.EntityDAO.EntityIdFqnPair;

class EntityStaleDeletionTest {
  @Test
  void recursiveDeletionCountsCoveredChildrenWithoutDeletingThemTwice() {
    final Fixture fixture = new Fixture();
    final var result = fixture.deletion.reconcile(request(), "admin");
    assertEquals(ApiStatus.SUCCESS, result.getStatus());
    assertEquals(2, result.getNumberOfRowsPassed());
    assertEquals(2, result.getNumberOfRowsProcessed());
    assertTrue(fixture.rows.isEmpty());
    assertEquals(List.of(new Deletion("scope.parent", "admin", true, false)), fixture.deleted);
  }

  @Test
  void aFailedAncestorDoesNotSuppressItsDescendant() {
    final Fixture fixture = new Fixture();
    fixture.failParent = true;
    final var result = fixture.deletion.reconcile(request(), "ingestion");
    assertEquals(ApiStatus.PARTIAL_SUCCESS, result.getStatus());
    assertEquals(1, result.getNumberOfRowsPassed());
    assertEquals(1, result.getNumberOfRowsFailed());
    assertEquals("scope.parent", result.getFailedRequest().getFirst().getRequest());
    assertEquals(500, result.getFailedRequest().getFirst().getStatus());
    assertEquals("Parent is protected", result.getFailedRequest().getFirst().getMessage());
    assertEquals(List.of("scope.parent"), fixture.rows.stream().map(row -> row.fqn).toList());
  }

  @Test
  void dryRunOnlyReportsCandidates() {
    final Fixture fixture = new Fixture();
    final var result = fixture.deletion.reconcile(request().withDryRun(true), "admin");
    assertTrue(result.getDryRun());
    assertEquals(2, result.getNumberOfRowsPassed());
    assertEquals(
        List.of("scope.parent", "scope.parent.child"),
        result.getSuccessRequest().stream()
            .map(response -> response.getRequest().toString())
            .toList());
    assertEquals(2, fixture.rows.size());
    assertTrue(fixture.deleted.isEmpty());
  }

  @Test
  void passesExplicitDeleteOptionsAndPreservesAllFailureStatus() {
    final Fixture fixture = new Fixture();
    fixture.rows.removeIf(row -> row.fqn.endsWith(".child"));
    final var result =
        fixture.deletion.reconcile(request().withRecursive(false).withHardDelete(true), "admin");
    assertFalse(result.getDryRun());
    assertEquals(List.of(new Deletion("scope.parent", "admin", false, true)), fixture.deleted);
    final Fixture failing = new Fixture();
    failing.failParent = true;
    failing.rows.removeIf(row -> row.fqn.endsWith(".child"));
    final var failed = failing.deletion.reconcile(request(), "admin");
    assertEquals(ApiStatus.PARTIAL_SUCCESS, failed.getStatus());
    assertEquals(0, failed.getNumberOfRowsPassed());
    assertEquals(1, failed.getNumberOfRowsFailed());
  }

  @Test
  void missingScopesAndEmptySeenListsLeaveRowsUntouched() {
    final Fixture fixture = new Fixture();
    assertEquals(
        0,
        fixture
            .deletion
            .reconcile(request().withSeenFqns(List.of()), "admin")
            .getNumberOfRowsProcessed());
    assertEquals(
        0,
        fixture
            .deletion
            .reconcile(request().withSeenFqns(null), "admin")
            .getNumberOfRowsProcessed());
    assertEquals(
        0,
        fixture
            .deletion
            .reconcile(request().withScopeFqn("missing"), "admin")
            .getNumberOfRowsProcessed());
    assertEquals(2, fixture.rows.size());
    assertTrue(fixture.deleted.isEmpty());
  }

  @Test
  void resolvesTheGenericServiceScope() {
    final Fixture fixture = new Fixture();
    assertEquals(
        2,
        fixture
            .deletion
            .reconcile(request().withScopeEntityType("service"), "admin")
            .getNumberOfRowsPassed());
    assertTrue(fixture.rows.isEmpty());
  }

  @Test
  void validatesScopeFieldsBeforeAnyDeletion() {
    final Fixture fixture = new Fixture();
    assertThrows(
        BadRequestException.class,
        () -> fixture.deletion.reconcile(request().withScopeFqn(""), "admin"));
    assertThrows(
        BadRequestException.class,
        () -> fixture.deletion.reconcile(request().withScopeEntityType(null), "admin"));
    assertThrows(
        BadRequestException.class,
        () -> fixture.deletion.reconcile(request().withScopeEntityType("unknown"), "admin"));
    assertEquals(2, fixture.rows.size());
  }

  private BulkDeleteStaleRequest request() {
    return new BulkDeleteStaleRequest()
        .withScopeEntityType("databaseSchema")
        .withScopeFqn("scope")
        .withSeenFqns(List.of("scope.seen"));
  }

  private record Deletion(String fqn, String actor, boolean recursive, boolean hard) {}

  private static final class Fixture {
    private final List<EntityIdFqnPair> rows =
        new ArrayList<>(
            List.of(
                new EntityIdFqnPair(UUID.randomUUID(), "scope.parent.child"),
                new EntityIdFqnPair(UUID.randomUUID(), "scope.parent")));
    private final List<Deletion> deleted = new ArrayList<>();
    private boolean failParent;
    private final EntityStaleDeletion deletion =
        new EntityStaleDeletion(
            "table",
            new EntityStaleDeletion.Scopes(
                Set.of("databaseSchema", "databaseService")::contains,
                (type, fqn) ->
                    Set.of("databaseSchema", "databaseService").contains(type)
                        && "scope".equals(fqn),
                type -> "databaseService"),
            fqn -> List.copyOf(rows),
            this::delete);

    private void delete(String actor, UUID id, boolean recursive, boolean hard) {
      final var row = rows.stream().filter(value -> value.id.equals(id)).findFirst().orElseThrow();
      if (failParent && "scope.parent".equals(row.fqn)) {
        throw new IllegalStateException("Parent is protected");
      }
      rows.removeIf(
          value -> value.id.equals(id) || recursive && value.fqn.startsWith(row.fqn + "."));
      deleted.add(new Deletion(row.fqn, actor, recursive, hard));
    }
  }
}

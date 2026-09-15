package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.sql.SQLException;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Isolated;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.openmetadata.it.factories.UserTestFactory;
import org.openmetadata.it.tests.EntityTransactionBoundaryIT.TransactionCounter;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.SqlFailureProbe;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.teams.CreateTeam;
import org.openmetadata.schema.api.teams.CreateTeam.TeamType;
import org.openmetadata.schema.entity.teams.Team;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.type.ChangeEvent;
import org.openmetadata.schema.type.EventType;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.schema.type.api.BulkAssets;
import org.openmetadata.schema.type.api.BulkOperationResult;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.CoreRelationshipDAOs.EntityRelationshipRecord;
import org.openmetadata.service.jdbi3.TeamRepository;
import org.openmetadata.service.util.RequestEntityCache;

@Isolated("Counts membership commits and injects audit failures without affecting background jobs")
@ExtendWith(TestNamespaceExtension.class)
class EntityAssetMembershipIT {
  private static final String AUDIT_INSERT = "insert into change_event";

  @AfterEach
  void clearRequestCache() {
    RequestEntityCache.clear();
  }

  @ParameterizedTest
  @ValueSource(booleans = {false, true})
  void membershipAndAuditShareOneCommit(final boolean add, final TestNamespace ns) {
    final Fixture fixture = fixture(ns, !add);
    final long before = events(fixture).size();
    try (var transactions = new TransactionCounter(Entity.getJdbi())) {
      assertResult(mutate(fixture, add, false), false);
      assertEquals(1, transactions.commits());
      assertEquals(0, transactions.rollbacks());
    }
    assertStored(fixture, add);
    assertVisible(fixture, add);
    final List<ChangeEvent> events = events(fixture);
    assertEquals(before + 1, events.size());
    assertTrue(events.stream().allMatch(event -> "admin".equals(event.getUserName())));
  }

  @ParameterizedTest
  @ValueSource(booleans = {false, true})
  void dryRunsValidateWithoutOpeningAWriteTransaction(final boolean add, final TestNamespace ns) {
    final Fixture fixture = fixture(ns, !add);
    final int before = events(fixture).size();
    try (var transactions = new TransactionCounter(Entity.getJdbi())) {
      assertResult(mutate(fixture, add, true), true);
      assertEquals(0, transactions.commits());
      assertEquals(0, transactions.rollbacks());
    }
    assertStored(fixture, !add);
    assertVisible(fixture, !add);
    assertEquals(before, events(fixture).size());
  }

  @ParameterizedTest
  @ValueSource(booleans = {false, true})
  void auditFailureRollsBackEveryMembership(final boolean add, final TestNamespace ns) {
    final Fixture fixture = fixture(ns, !add);
    final int before = events(fixture).size();
    try (var transactions = new TransactionCounter(Entity.getJdbi());
        var failure =
            new SqlFailureProbe(
                Entity.getJdbi(),
                AUDIT_INSERT,
                () -> new IllegalStateException("Injected audit failure"))) {
      assertThrows(RuntimeException.class, () -> mutate(fixture, add, false));
      assertStored(fixture, !add);
      assertEquals(0, transactions.commits());
      assertEquals(1, transactions.rollbacks());
    }
    assertEquals(before, events(fixture).size());
    assertVisible(fixture, !add);
  }

  @ParameterizedTest
  @ValueSource(booleans = {false, true})
  void deadlockReplayDoesNotDuplicateCountsOrAudit(final boolean add, final TestNamespace ns) {
    final Fixture fixture = fixture(ns, !add);
    final int before = events(fixture).size();
    try (var transactions = new TransactionCounter(Entity.getJdbi());
        var failure =
            new SqlFailureProbe(
                Entity.getJdbi(),
                AUDIT_INSERT,
                () ->
                    new RuntimeException(
                        new SQLException("Injected audit deadlock", "40001", 1213)))) {
      assertResult(mutate(fixture, add, false), false);
      assertEquals(1, transactions.commits());
      assertEquals(1, transactions.rollbacks());
    }
    assertStored(fixture, add);
    assertVisible(fixture, add);
    assertEquals(before + 1, events(fixture).size());
  }

  @ParameterizedTest
  @ValueSource(booleans = {false, true})
  void enclosingRollbackKeepsMembershipAndAuditUnpublished(
      final boolean add, final TestNamespace ns) {
    final Fixture fixture = fixture(ns, !add);
    final int before = events(fixture).size();
    try (var transactions = new TransactionCounter(Entity.getJdbi())) {
      assertThrows(
          IllegalStateException.class,
          () ->
              teams()
                  .executeInTransaction(
                      () -> {
                        assertResult(mutate(fixture, add, false), false);
                        assertStored(fixture, add);
                        throw new IllegalStateException("Injected outer rollback");
                      }));
      assertEquals(0, transactions.commits());
      assertEquals(1, transactions.rollbacks());
    }
    assertStored(fixture, !add);
    assertVisible(fixture, !add);
    assertEquals(before, events(fixture).size());
  }

  private Fixture fixture(final TestNamespace ns, final boolean member) {
    final Team team =
        ns.trackRoot(
            Entity.TEAM,
            SdkClients.adminClient()
                .teams()
                .create(
                    new CreateTeam()
                        .withName(ns.prefix("membership"))
                        .withTeamType(TeamType.GROUP)));
    final Fixture fixture =
        new Fixture(
            team,
            List.of(
                UserTestFactory.createUser(ns, "first_member"),
                UserTestFactory.createUser(ns, "second_member")));
    if (member) {
      mutate(fixture, true, false);
    }
    assertVisible(fixture, member);
    return fixture;
  }

  private BulkOperationResult mutate(
      final Fixture fixture, final boolean add, final boolean dryRun) {
    final BulkAssets request =
        new BulkAssets()
            .withDryRun(dryRun)
            .withAssets(fixture.users().stream().map(User::getEntityReference).toList());
    return add
        ? teams().bulkAddAssets(fixture.team().getName(), request, "admin")
        : teams().bulkRemoveAssets(fixture.team().getName(), request, "admin");
  }

  private void assertResult(final BulkOperationResult result, final boolean dryRun) {
    assertEquals(dryRun, result.getDryRun());
    assertEquals(2, result.getNumberOfRowsProcessed());
    assertEquals(2, result.getNumberOfRowsPassed());
    assertEquals(2, result.getSuccessRequest().size());
  }

  private void assertStored(final Fixture fixture, final boolean member) {
    final Set<UUID> actual =
        Entity.getCollectionDAO()
            .relationshipDAO()
            .findTo(fixture.team().getId(), Entity.TEAM, Relationship.HAS.ordinal(), Entity.USER)
            .stream()
            .map(EntityRelationshipRecord::getId)
            .collect(Collectors.toSet());
    final Set<UUID> expected =
        member ? fixture.users().stream().map(User::getId).collect(Collectors.toSet()) : Set.of();
    assertEquals(expected, actual, "Every membership in the request must share the outcome");
  }

  private void assertVisible(final Fixture fixture, final boolean member) {
    final var users = SdkClients.adminClient().users();
    for (final User user : fixture.users()) {
      assertMembership(fixture, users.get(user.getId().toString(), "teams"), member);
      assertMembership(fixture, users.getByName(user.getFullyQualifiedName(), "teams"), member);
    }
  }

  private void assertMembership(final Fixture fixture, final User user, final boolean member) {
    assertEquals(
        member,
        user.getTeams() != null
            && user.getTeams().stream()
                .anyMatch(team -> fixture.team().getId().equals(team.getId())));
  }

  private List<ChangeEvent> events(final Fixture fixture) {
    return Entity.getCollectionDAO().changeEventDAO().listUnprocessedEvents(0).stream()
        .map(json -> JsonUtils.readValue(json, ChangeEvent.class))
        .filter(
            event ->
                fixture.team().getId().equals(event.getEntityId())
                    && event.getEventType() == EventType.ENTITY_UPDATED)
        .toList();
  }

  private TeamRepository teams() {
    return (TeamRepository) Entity.getEntityRepository(Entity.TEAM);
  }

  private record Fixture(Team team, List<User> users) {}
}

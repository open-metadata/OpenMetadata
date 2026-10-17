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
package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.time.Duration;
import java.util.EnumMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import java.util.stream.IntStream;
import org.jdbi.v3.core.Handle;
import org.jdbi.v3.core.Jdbi;
import org.jdbi.v3.core.statement.UnableToExecuteStatementException;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.MethodSource;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.CoreRelationshipDAOs.EntityRelationshipDAO;
import org.openmetadata.service.projection.ProjectionTarget;
import org.openmetadata.service.projection.RelationshipSnapshot;

@Execution(ExecutionMode.SAME_THREAD)
class RelationshipBulkCaptureIT {
  private static final Map<RdfTestDatabase.Backend, RelationshipCaptureFixture> DATABASES =
      new EnumMap<>(RdfTestDatabase.Backend.class);
  private static final int HAS = Relationship.HAS.ordinal();

  @BeforeAll
  static void startDatabases() {
    for (final var backend : RdfTestDatabase.backends().toList()) {
      DATABASES.put(backend, new RelationshipCaptureFixture(backend));
    }
  }

  @AfterAll
  static void stopDatabases() {
    DATABASES.values().forEach(RelationshipCaptureFixture::close);
    DATABASES.clear();
  }

  @BeforeEach
  void clearRows() {
    DATABASES.values().forEach(RelationshipCaptureFixture::clear);
  }

  @ParameterizedTest
  @MethodSource("org.openmetadata.it.tests.RdfTestDatabase#backends")
  void inheritedRepointRetainsBothDomainsAndPreservesExplicitAssignments(
      final RdfTestDatabase.Backend backend) {
    final var fixture = DATABASES.get(backend);
    final var membership = membership(fixture.jdbi());
    assertEquals(
        1,
        fixture
            .dao()
            .repointInheritedFrom(
                membership.oldDomain(),
                membership.newDomain(),
                Entity.DOMAIN,
                Entity.TABLE,
                HAS,
                List.of(membership.inherited().toString(), membership.explicit().toString())));
    assertEquals(Set.of(membership.inherited()), targets(fixture.jdbi(), membership.newDomain()));
    assertEquals(
        Set.of(membership.explicit(), membership.outside()),
        targets(fixture.jdbi(), membership.oldDomain()));
    final var retained = retained(fixture);
    assertEquals(Set.of(membership.oldDomain(), membership.newDomain()), fromIds(retained));
    assertEquals(Set.of(membership.inherited()), toIds(retained));
  }

  @ParameterizedTest
  @MethodSource("org.openmetadata.it.tests.RdfTestDatabase#backends")
  void joinedRepointRetainsOnlyInheritedMembersReachableThroughTheParent(
      final RdfTestDatabase.Backend backend) {
    final var fixture = DATABASES.get(backend);
    final var membership = membership(fixture.jdbi());
    assertEquals(
        1,
        fixture
            .dao()
            .repointInheritedVia(
                membership.oldDomain(),
                membership.newDomain(),
                Entity.DOMAIN,
                Entity.TABLE,
                HAS,
                membership.parent(),
                Entity.DATABASE,
                HAS));
    assertEquals(Set.of(membership.inherited()), targets(fixture.jdbi(), membership.newDomain()));
    assertEquals(
        Set.of(membership.explicit(), membership.outside()),
        targets(fixture.jdbi(), membership.oldDomain()));
    final var retained = retained(fixture);
    assertEquals(Set.of(membership.oldDomain(), membership.newDomain()), fromIds(retained));
    assertEquals(Set.of(membership.inherited()), toIds(retained));
  }

  @ParameterizedTest
  @MethodSource("org.openmetadata.it.tests.RdfTestDatabase#backends")
  void joinedRemovalRetainsDetachedMembersWithoutDeletingExplicitAssignments(
      final RdfTestDatabase.Backend backend) {
    final var fixture = DATABASES.get(backend);
    final var membership = membership(fixture.jdbi());
    assertEquals(
        1,
        fixture
            .dao()
            .removeInheritedVia(
                membership.oldDomain(),
                Entity.DOMAIN,
                Entity.TABLE,
                HAS,
                membership.parent(),
                Entity.DATABASE,
                HAS));
    assertEquals(
        Set.of(membership.explicit(), membership.outside()),
        targets(fixture.jdbi(), membership.oldDomain()));
    assertEquals(
        Set.of(membership.inherited(), membership.explicit()),
        targets(fixture.jdbi(), membership.parent()));
    final var retained = retained(fixture);
    assertEquals(Set.of(membership.oldDomain()), fromIds(retained));
    assertEquals(Set.of(membership.inherited()), toIds(retained));
  }

  @ParameterizedTest
  @MethodSource("org.openmetadata.it.tests.RdfTestDatabase#backends")
  void bulkRepointCapturesAllPagesAndKeepsTheOriginalRowMetadata(
      final RdfTestDatabase.Backend backend) {
    final var fixture = DATABASES.get(backend);
    final UUID oldDomain = UUID.randomUUID();
    final UUID newDomain = UUID.randomUUID();
    final List<UUID> tables = IntStream.range(0, 205).mapToObj(i -> UUID.randomUUID()).toList();
    fixture
        .jdbi()
        .useTransaction(
            handle ->
                tables.forEach(
                    table ->
                        seed(handle, oldDomain, table, Entity.DOMAIN, "{\"inherited\":false}")));
    fixture
        .dao()
        .bulkUpdateFromId(
            oldDomain,
            newDomain,
            tables.stream().map(UUID::toString).toList(),
            Entity.DOMAIN,
            Entity.TABLE,
            HAS);
    assertEquals(Set.copyOf(tables), targets(fixture.jdbi(), newDomain));
    assertTrue(targets(fixture.jdbi(), oldDomain).isEmpty());
    final var retained = retained(fixture);
    assertEquals(410, retained.size());
    assertEquals(Set.of(oldDomain, newDomain), fromIds(retained));
    assertEquals(Set.copyOf(tables), toIds(retained));
    assertTrue(
        fixture
            .jdbi()
            .withHandle(
                handle ->
                    handle
                        .createQuery("SELECT json FROM entity_relationship")
                        .mapTo(String.class)
                        .list())
            .stream()
            .allMatch(json -> json.contains("false")));
  }

  @ParameterizedTest
  @MethodSource("org.openmetadata.it.tests.RdfTestDatabase#backends")
  void failedRepointRestoresAllSourceRowsAndDiscardsItsFacts(
      final RdfTestDatabase.Backend backend) {
    final var fixture = DATABASES.get(backend);
    final var membership = membership(fixture.jdbi());
    fixture
        .jdbi()
        .useHandle(
            handle ->
                seed(handle, membership.newDomain(), membership.inherited(), Entity.DOMAIN, "{}"));
    fixture
        .jdbi()
        .useTransaction(
            handle -> {
              assertThrows(
                  UnableToExecuteStatementException.class,
                  () ->
                      handle
                          .attach(EntityRelationshipDAO.class)
                          .repointInheritedVia(
                              membership.oldDomain(),
                              membership.newDomain(),
                              Entity.DOMAIN,
                              Entity.TABLE,
                              HAS,
                              membership.parent(),
                              Entity.DATABASE,
                              HAS));
              assertEquals(
                  3,
                  handle
                      .createQuery("SELECT COUNT(*) FROM entity_relationship WHERE fromId = ?")
                      .bind(0, membership.oldDomain().toString())
                      .mapTo(Integer.class)
                      .one());
            });
    assertEquals(
        0,
        fixture
            .jdbi()
            .withHandle(
                handle ->
                    handle
                        .createQuery("SELECT COUNT(*) FROM metadata_projection_mutation")
                        .mapTo(Integer.class)
                        .one())
            .intValue());
  }

  @ParameterizedTest
  @MethodSource("org.openmetadata.it.tests.RdfTestDatabase#backends")
  void addingInheritedMembershipCapturesOnlyUnassignedReachableChildren(
      final RdfTestDatabase.Backend backend) {
    final var fixture = DATABASES.get(backend);
    final var membership = membership(fixture.jdbi());
    final UUID unassigned = UUID.randomUUID();
    fixture
        .jdbi()
        .useHandle(handle -> seed(handle, membership.parent(), unassigned, Entity.DATABASE, null));
    assertEquals(
        1,
        fixture
            .dao()
            .addInheritedVia(
                membership.newDomain(),
                Entity.DOMAIN,
                Entity.TABLE,
                HAS,
                membership.parent(),
                Entity.DATABASE,
                HAS));
    assertEquals(Set.of(unassigned), targets(fixture.jdbi(), membership.newDomain()));
    assertEquals(
        Set.of(membership.inherited(), membership.explicit(), membership.outside()),
        targets(fixture.jdbi(), membership.oldDomain()));
    final var retained = retained(fixture);
    assertEquals(Set.of(membership.newDomain()), fromIds(retained));
    assertEquals(Set.of(unassigned), toIds(retained));
    assertEquals(
        0,
        fixture
            .dao()
            .addInheritedVia(
                membership.newDomain(),
                Entity.DOMAIN,
                Entity.TABLE,
                HAS,
                membership.parent(),
                Entity.DATABASE,
                HAS));
  }

  @ParameterizedTest
  @MethodSource("org.openmetadata.it.tests.RdfTestDatabase#backends")
  void bulkInsertRetainsInsertedMembershipWithoutOverwritingExistingMetadata(
      final RdfTestDatabase.Backend backend) {
    final var fixture = DATABASES.get(backend);
    final UUID domain = UUID.randomUUID();
    final List<UUID> tables = IntStream.range(0, 205).mapToObj(i -> UUID.randomUUID()).toList();
    fixture
        .jdbi()
        .useHandle(
            handle ->
                seed(handle, domain, tables.getFirst(), Entity.DOMAIN, "{\"inherited\":true}"));
    fixture.dao().bulkInsertToRelationship(domain, tables, Entity.DOMAIN, Entity.TABLE, HAS);
    assertEquals(Set.copyOf(tables), targets(fixture.jdbi(), domain));
    assertEquals(Set.copyOf(tables), toIds(retained(fixture)));
    assertTrue(fixture.dao().getRelation(domain, tables.getFirst(), HAS).contains("true"));
  }

  @ParameterizedTest
  @MethodSource("org.openmetadata.it.tests.RdfTestDatabase#backends")
  void insertFromCatalogRetainsMembershipAndHonorsExclusions(
      final RdfTestDatabase.Backend backend) {
    final var fixture = DATABASES.get(backend);
    final UUID domain = UUID.randomUUID();
    final UUID included = UUID.randomUUID();
    final UUID excluded = UUID.randomUUID();
    fixture
        .jdbi()
        .useHandle(
            handle -> {
              handle.execute("CREATE TABLE projection_test_entity (id VARCHAR(36) PRIMARY KEY)");
              handle.execute(
                  "INSERT INTO projection_test_entity (id) VALUES (?), (?)",
                  included.toString(),
                  excluded.toString());
            });
    try {
      fixture
          .dao()
          .bulkInsertAllToRelationshipWithExclusions(
              List.of(excluded.toString()),
              domain,
              Entity.DOMAIN,
              Entity.TABLE,
              HAS,
              "projection_test_entity");
      assertEquals(Set.of(included), targets(fixture.jdbi(), domain));
      assertEquals(Set.of(included), toIds(retained(fixture)));
      fixture
          .dao()
          .bulkInsertAllToRelationship(
              domain, Entity.DOMAIN, Entity.TABLE, HAS, "projection_test_entity");
      assertEquals(Set.of(included, excluded), targets(fixture.jdbi(), domain));
      assertEquals(Set.of(included, excluded), toIds(retained(fixture)));
    } finally {
      fixture.jdbi().useHandle(handle -> handle.execute("DROP TABLE projection_test_entity"));
    }
  }

  private static Membership membership(final Jdbi jdbi) {
    final var membership =
        new Membership(
            UUID.randomUUID(),
            UUID.randomUUID(),
            UUID.randomUUID(),
            UUID.randomUUID(),
            UUID.randomUUID(),
            UUID.randomUUID());
    jdbi.useTransaction(
        handle -> {
          seed(
              handle,
              membership.oldDomain(),
              membership.inherited(),
              Entity.DOMAIN,
              "{\"inherited\":true}");
          seed(
              handle,
              membership.oldDomain(),
              membership.explicit(),
              Entity.DOMAIN,
              "{\"inherited\":false}");
          seed(
              handle,
              membership.oldDomain(),
              membership.outside(),
              Entity.DOMAIN,
              "{\"inherited\":true}");
          seed(handle, membership.parent(), membership.inherited(), Entity.DATABASE, null);
          seed(handle, membership.parent(), membership.explicit(), Entity.DATABASE, null);
        });
    return membership;
  }

  private static void seed(
      final Handle handle,
      final UUID from,
      final UUID to,
      final String fromType,
      final String json) {
    handle.execute(
        "INSERT INTO entity_relationship (fromId, toId, fromEntity, toEntity, relation, json) VALUES (?, ?, ?, ?, ?, CAST(? AS JSON))",
        from.toString(),
        to.toString(),
        fromType,
        Entity.TABLE,
        HAS,
        json);
  }

  private static Set<UUID> targets(final Jdbi jdbi, final UUID from) {
    return jdbi
        .withHandle(
            handle ->
                handle
                    .createQuery("SELECT toId FROM entity_relationship WHERE fromId = ?")
                    .bind(0, from.toString())
                    .mapTo(String.class)
                    .list())
        .stream()
        .map(UUID::fromString)
        .collect(Collectors.toSet());
  }

  private static List<RelationshipSnapshot> retained(final RelationshipCaptureFixture fixture) {
    final var claims =
        fixture.journal().claim(ProjectionTarget.SEARCH, 100, Duration.ofSeconds(30));
    assertEquals(1, claims.size());
    return fixture.snapshots().page(claims.getFirst().id(), 0, 1000);
  }

  private static Set<UUID> fromIds(final List<RelationshipSnapshot> rows) {
    return rows.stream().map(row -> row.from().id()).collect(Collectors.toSet());
  }

  private static Set<UUID> toIds(final List<RelationshipSnapshot> rows) {
    return rows.stream().map(row -> row.to().id()).collect(Collectors.toSet());
  }

  private record Membership(
      UUID oldDomain, UUID newDomain, UUID parent, UUID inherited, UUID explicit, UUID outside) {}
}

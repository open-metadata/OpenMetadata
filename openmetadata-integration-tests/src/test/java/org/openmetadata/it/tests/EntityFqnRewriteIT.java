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
import static org.openmetadata.it.tests.EntityFqnTestData.chart;
import static org.openmetadata.it.tests.EntityFqnTestData.fixture;
import static org.openmetadata.it.tests.EntityFqnTestData.id;
import static org.openmetadata.it.tests.EntityFqnTestData.seed;
import static org.openmetadata.it.tests.EntityFqnTestData.seedCharts;

import java.time.Clock;
import java.time.Duration;
import java.util.ArrayList;
import java.util.EnumMap;
import java.util.EnumSet;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.stream.IntStream;
import org.jdbi.v3.core.Jdbi;
import org.jdbi.v3.core.statement.SqlLogger;
import org.jdbi.v3.core.statement.StatementContext;
import org.jdbi.v3.core.statement.UnableToExecuteStatementException;
import org.jdbi.v3.core.transaction.TransactionIsolationLevel;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.MethodSource;
import org.openmetadata.schema.entity.data.Chart;
import org.openmetadata.schema.entity.data.Container;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.ColumnDataType;
import org.openmetadata.schema.type.ContainerDataModel;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.jdbi3.DataAssetServiceDAOs.ContainerDAO;
import org.openmetadata.service.jdbi3.EntityDataDAOs.ChartDAO;
import org.openmetadata.service.jdbi3.FqnPrefixRewrite;
import org.openmetadata.service.jdbi3.locator.ConnectionType;
import org.openmetadata.service.projection.EntityMutation;
import org.openmetadata.service.projection.EntityPrefixMembers;
import org.openmetadata.service.projection.EntityPrefixMembers.Member;
import org.openmetadata.service.projection.EntityPrefixMutation;
import org.openmetadata.service.projection.MutationFacts;
import org.openmetadata.service.projection.ProjectionJournal;
import org.openmetadata.service.projection.ProjectionOwnerLookup;
import org.openmetadata.service.projection.ProjectionTarget;
import org.openmetadata.service.util.FullyQualifiedName;

/** Exercises the production DAO and migrated tables with and without capture. */
@Execution(ExecutionMode.SAME_THREAD)
class EntityFqnRewriteIT {
  private static final String CHARTS = "chart_entity";
  private static final String CONTAINERS = "storage_container_entity";
  private static final Map<RdfTestDatabase.Backend, EntityCaptureFixture> CAPTURED =
      new EnumMap<>(RdfTestDatabase.Backend.class);
  private static final Map<RdfTestDatabase.Backend, EntityCaptureFixture> BASELINE =
      new EnumMap<>(RdfTestDatabase.Backend.class);

  @BeforeAll
  static void startDatabases() {
    for (final var backend : RdfTestDatabase.backends().toList()) {
      CAPTURED.put(backend, fixture(backend, true));
      BASELINE.put(backend, fixture(backend, false));
    }
  }

  @AfterAll
  static void stopDatabases() {
    CAPTURED.values().forEach(EntityCaptureFixture::close);
    BASELINE.values().forEach(EntityCaptureFixture::close);
    CAPTURED.clear();
    BASELINE.clear();
  }

  @BeforeEach
  void clearRows() {
    for (final var databases : List.of(CAPTURED, BASELINE)) {
      databases
          .values()
          .forEach(
              fixture ->
                  fixture
                      .jdbi()
                      .useHandle(
                          handle -> {
                            for (final String table :
                                List.of(
                                    "metadata_projection_consumer",
                                    "metadata_projection_mutation",
                                    CHARTS,
                                    CONTAINERS)) {
                              handle.execute("DELETE FROM " + table);
                            }
                          }));
    }
  }

  @ParameterizedTest
  @MethodSource("org.openmetadata.it.tests.RdfTestDatabase#backends")
  void oneRewriteStatementRecordsOnePrefixFactForEveryDescendant(
      final RdfTestDatabase.Backend backend) {
    final Jdbi jdbi = CAPTURED.get(backend).jdbi();
    seedCharts(jdbi, 205);
    seed(jdbi, chart(1000, "service.before"), CHARTS);
    seed(jdbi, chart(1001, "service.beforeSibling.child"), CHARTS);
    final var rewrites = new AtomicInteger();
    final var journalInserts = new AtomicInteger();
    jdbi.setSqlLogger(
        new SqlLogger() {
          @Override
          public void logAfterExecution(final StatementContext context) {
            if (isRewrite(context)) {
              rewrites.incrementAndGet();
            } else if (context.getRenderedSql().startsWith("INSERT INTO metadata_projection_")) {
              journalInserts.incrementAndGet();
            }
          }
        });
    try {
      jdbi.onDemand(ChartDAO.class).updateFqn("service.before", "service.after");
    } finally {
      jdbi.setSqlLogger(SqlLogger.NOP_SQL_LOGGER);
    }
    assertEquals(1, rewrites.get(), "Capture must not split the rewrite into pages");
    assertEquals(2, journalInserts.get(), "One fact and its consumers, not one per descendant");
    final var expected = new EntityPrefixMutation(1, "chart", "service.before", "service.after");
    for (final var target : ProjectionTarget.values()) {
      assertEquals(List.of(expected), facts(jdbi, target));
    }
    final List<Member> members = members(backend, jdbi, expected, CHARTS);
    assertEquals(
        IntStream.range(0, 205).mapToObj(EntityFqnTestData::id).sorted().toList(),
        members.stream().map(Member::id).sorted().toList());
    for (final Member member : members) {
      assertEquals(
          "service.before" + member.afterFqn().substring("service.after".length()),
          member.beforeFqn());
      assertStored(jdbi, CHARTS, member.id(), member.afterFqn());
    }
    assertStored(jdbi, CHARTS, id(1000), "service.before");
    assertStored(jdbi, CHARTS, id(1001), "service.beforeSibling.child");
  }

  @ParameterizedTest
  @MethodSource("org.openmetadata.it.tests.RdfTestDatabase#backends")
  void literalPrefixesAndRepeatedSegmentsMatchWithAndWithoutCapture(
      final RdfTestDatabase.Backend backend) {
    final String before = FullyQualifiedName.build("service", "O'Reilly\\東京.$[a]");
    final String after = FullyQualifiedName.build("service", "new'\\雪.$1");
    for (final var databases : List.of(CAPTURED, BASELINE)) {
      final Jdbi jdbi = databases.get(backend).jdbi();
      final String suffix = ".leaf." + before + ".again";
      seed(jdbi, chart(1, before + suffix), CHARTS);
      jdbi.onDemand(ChartDAO.class).updateFqn(before, after);
      assertStored(jdbi, CHARTS, id(1), after + suffix);
      final var facts = facts(jdbi, ProjectionTarget.SEARCH);
      if (databases == CAPTURED) {
        final var rewrite = new EntityPrefixMutation(1, "chart", before, after);
        assertEquals(List.of(rewrite), facts);
        final Member member = members(backend, jdbi, rewrite, CHARTS).getFirst();
        assertEquals(before + suffix, member.beforeFqn());
        assertEquals(after + suffix, member.afterFqn());
      } else {
        assertTrue(facts.isEmpty());
      }
    }
  }

  @ParameterizedTest
  @MethodSource("org.openmetadata.it.tests.RdfTestDatabase#backends")
  void containerMoveRewritesNestedColumnsAndGeneratedParentHash(
      final RdfTestDatabase.Backend backend) {
    for (final var databases : List.of(CAPTURED, BASELINE)) {
      final Jdbi jdbi = databases.get(backend).jdbi();
      final String oldPrefix = FullyQualifiedName.build("service", "parent'\\東京.dot");
      final String newPrefix = FullyQualifiedName.build("service", "parent'\\雪.dot");
      final String before = oldPrefix + ".child";
      seed(jdbi, container(before), CONTAINERS);
      final ContainerDAO dao = jdbi.onDemand(ContainerDAO.class);
      dao.updateFqn(oldPrefix, newPrefix);
      final Container stored =
          JsonUtils.readValue(dao.findById(dao.getTableName(), id(1), ""), Container.class);
      assertEquals(newPrefix + ".child", stored.getFullyQualifiedName());
      final Column column = stored.getDataModel().getColumns().getFirst();
      assertEquals(newPrefix + ".child.record", column.getFullyQualifiedName());
      assertEquals(
          newPrefix + ".child.record.leaf",
          column.getChildren().getFirst().getFullyQualifiedName());
      assertEquals(
          FullyQualifiedName.buildHash(newPrefix),
          jdbi.withHandle(
              handle ->
                  handle
                      .createQuery("SELECT parentFqnHash FROM " + CONTAINERS + " WHERE id = :id")
                      .bind("id", id(1).toString())
                      .mapTo(String.class)
                      .one()));
      final var facts = facts(jdbi, ProjectionTarget.SEARCH);
      if (databases == CAPTURED) {
        final var rewrite = new EntityPrefixMutation(1, "container", oldPrefix, newPrefix);
        assertEquals(List.of(rewrite), facts);
        final Member member = members(backend, jdbi, rewrite, CONTAINERS).getFirst();
        assertEquals(id(1), member.id());
        assertEquals(before, member.beforeFqn());
        assertEquals(stored.getFullyQualifiedName(), member.afterFqn());
      } else {
        assertTrue(facts.isEmpty());
      }
    }
  }

  @ParameterizedTest
  @MethodSource("org.openmetadata.it.tests.RdfTestDatabase#backends")
  void entityRewriteLeavesReferencesToOtherEntitiesUnderThePrefix(
      final RdfTestDatabase.Backend backend) {
    for (final var databases : List.of(CAPTURED, BASELINE)) {
      final Jdbi jdbi = databases.get(backend).jdbi();
      final EntityReference dashboard =
          new EntityReference()
              .withId(id(2))
              .withType("dashboard")
              .withFullyQualifiedName("service.before.dashboard");
      seed(jdbi, chart(1, "service.before.child").withDashboards(List.of(dashboard)), CHARTS);
      jdbi.onDemand(ChartDAO.class).updateFqn("service.before", "service.after");
      final Chart stored =
          JsonUtils.readValue(
              jdbi.onDemand(ChartDAO.class).findById(CHARTS, id(1), ""), Chart.class);
      assertEquals("service.after.child", stored.getFullyQualifiedName());
      assertEquals(
          "service.before.dashboard", stored.getDashboards().getFirst().getFullyQualifiedName());
    }
  }

  @ParameterizedTest
  @MethodSource("org.openmetadata.it.tests.RdfTestDatabase#backends")
  void rewriteWithoutDescendantsHasNoMembers(final RdfTestDatabase.Backend backend) {
    final Jdbi jdbi = CAPTURED.get(backend).jdbi();
    jdbi.onDemand(ChartDAO.class).updateFqn("absent", "new");
    final var rewrite = new EntityPrefixMutation(1, "chart", "absent", "new");
    assertEquals(List.of(rewrite), facts(jdbi, ProjectionTarget.SEARCH));
    assertTrue(members(backend, jdbi, rewrite, CHARTS).isEmpty());
  }

  @ParameterizedTest
  @MethodSource("org.openmetadata.it.tests.RdfTestDatabase#backends")
  void differentTableCannotMasqueradeAsTheDaoOwner(final RdfTestDatabase.Backend backend) {
    final Jdbi jdbi = CAPTURED.get(backend).jdbi();
    assertThrows(
        IllegalArgumentException.class,
        () ->
            jdbi.onDemand(ChartDAO.class)
                .updateFqnInternal(
                    CONTAINERS, new FqnPrefixRewrite("a", "b", FqnPrefixRewrite.Scope.ENTITY)));
    assertTrue(facts(jdbi, ProjectionTarget.SEARCH).isEmpty());
  }

  @ParameterizedTest
  @MethodSource("org.openmetadata.it.tests.RdfTestDatabase#backends")
  void uniqueConflictRollsBackTheRewriteAndItsFact(final RdfTestDatabase.Backend backend) {
    final Jdbi jdbi = CAPTURED.get(backend).jdbi();
    seedCharts(jdbi, 205);
    seed(jdbi, chart(1000, "service.after.child150"), CHARTS);
    assertThrows(
        UnableToExecuteStatementException.class,
        () -> jdbi.onDemand(ChartDAO.class).updateFqn("service.before", "service.after"));
    assertOriginalCharts(jdbi, 205);
    assertTrue(facts(jdbi, ProjectionTarget.SEARCH).isEmpty());
  }

  @ParameterizedTest
  @MethodSource("org.openmetadata.it.tests.RdfTestDatabase#backends")
  void caughtRewriteFailurePreservesTheEnclosingTransaction(final RdfTestDatabase.Backend backend) {
    final Jdbi jdbi = CAPTURED.get(backend).jdbi();
    seedCharts(jdbi, 205);
    jdbi.setSqlLogger(
        new SqlLogger() {
          @Override
          public void logAfterExecution(final StatementContext context) {
            if (isRewrite(context)) {
              throw new IllegalStateException("failure after the rewrite statement");
            }
          }
        });
    try {
      jdbi.useTransaction(
          handle -> {
            final ChartDAO dao = handle.attach(ChartDAO.class);
            final Chart survivor = chart(1000, "survivor");
            dao.insert(survivor, survivor.getFullyQualifiedName());
            assertThrows(
                IllegalStateException.class,
                () -> dao.updateFqn("service.before", "service.after"));
            survivor.setDescription("outer transaction still usable");
            dao.update(survivor);
          });
    } finally {
      jdbi.setSqlLogger(SqlLogger.NOP_SQL_LOGGER);
    }
    assertOriginalCharts(jdbi, 205);
    final var facts = facts(jdbi, ProjectionTarget.SEARCH);
    assertEquals(2, facts.size());
    assertTrue(
        facts.stream()
            .allMatch(
                fact ->
                    fact instanceof EntityMutation entity && id(1000).equals(entity.entityId())));
  }

  @ParameterizedTest
  @MethodSource("org.openmetadata.it.tests.RdfTestDatabase#backends")
  void rollbackDiscardsTheRewriteAndItsBufferedFact(final RdfTestDatabase.Backend backend) {
    final Jdbi jdbi = CAPTURED.get(backend).jdbi();
    seedCharts(jdbi, 205);
    assertThrows(
        IllegalStateException.class,
        () ->
            jdbi.useTransaction(
                handle -> {
                  handle.attach(ChartDAO.class).updateFqn("service.before", "service.after");
                  assertEquals(
                      0,
                      handle
                          .createQuery("SELECT COUNT(*) FROM metadata_projection_mutation")
                          .mapTo(Integer.class)
                          .one(),
                      "The fact is buffered until commit");
                  throw new IllegalStateException("rollback after rewrite");
                }));
    assertOriginalCharts(jdbi, 205);
    assertTrue(facts(jdbi, ProjectionTarget.SEARCH).isEmpty());
  }

  @ParameterizedTest
  @MethodSource("org.openmetadata.it.tests.RdfTestDatabase#backends")
  void journalFailurePreventsTheRenameFromCommitting(final RdfTestDatabase.Backend backend) {
    final Jdbi jdbi = CAPTURED.get(backend).jdbi();
    seedCharts(jdbi, 1);
    jdbi.setSqlLogger(
        new SqlLogger() {
          @Override
          public void logBeforeExecution(final StatementContext context) {
            if (context.getRenderedSql().startsWith("INSERT INTO metadata_projection_mutation")) {
              throw new IllegalStateException("journal unavailable");
            }
          }
        });
    try {
      assertThrows(
          IllegalStateException.class,
          () -> jdbi.onDemand(ChartDAO.class).updateFqn("service.before", "service.after"));
    } finally {
      jdbi.setSqlLogger(SqlLogger.NOP_SQL_LOGGER);
    }
    assertOriginalCharts(jdbi, 1);
    assertTrue(facts(jdbi, ProjectionTarget.SEARCH).isEmpty());
  }

  @ParameterizedTest
  @MethodSource("org.openmetadata.it.tests.RdfTestDatabase#backends")
  void rowsCommittedBeforeTheRewriteAreMembersOfItsPrefixFact(final RdfTestDatabase.Backend backend)
      throws Exception {
    final Jdbi jdbi = CAPTURED.get(backend).jdbi();
    seedCharts(jdbi, 1);
    final var selected = new CompletableFuture<Void>();
    final var release = new CompletableFuture<Void>();
    jdbi.setSqlLogger(
        new SqlLogger() {
          @Override
          public void logBeforeExecution(final StatementContext context) {
            if (isRewrite(context)) {
              selected.complete(null);
              release.orTimeout(30, TimeUnit.SECONDS).join();
            }
          }
        });
    final var rewrite =
        CompletableFuture.runAsync(
            () ->
                jdbi.useTransaction(
                    TransactionIsolationLevel.READ_COMMITTED,
                    handle ->
                        handle.attach(ChartDAO.class).updateFqn("service.before", "service.after")),
            DedicatedThreads.EXECUTOR);
    try {
      selected.orTimeout(30, TimeUnit.SECONDS).join();
      seed(jdbi, chart(1000, "service.before.concurrent"), CHARTS);
    } finally {
      release.complete(null);
      rewrite
          .whenComplete((result, failure) -> jdbi.setSqlLogger(SqlLogger.NOP_SQL_LOGGER))
          .get(30, TimeUnit.SECONDS);
    }
    assertStored(jdbi, CHARTS, id(1000), "service.after.concurrent");
    final var fact = new EntityPrefixMutation(1, "chart", "service.before", "service.after");
    assertEquals(List.of(fact), facts(jdbi, ProjectionTarget.SEARCH));
    final List<Member> members = members(backend, jdbi, fact, CHARTS);
    assertEquals(List.of(id(0), id(1000)), members.stream().map(Member::id).sorted().toList());
    assertTrue(
        members.stream()
            .anyMatch(member -> "service.before.concurrent".equals(member.beforeFqn())));
  }

  @ParameterizedTest
  @MethodSource("org.openmetadata.it.tests.RdfTestDatabase#backends")
  void overlappingPrefixesEnumerateEveryRewrittenIdentityOnce(
      final RdfTestDatabase.Backend backend) {
    final Jdbi jdbi = CAPTURED.get(backend).jdbi();
    seedCharts(jdbi, 200);
    jdbi.onDemand(ChartDAO.class).updateFqn("service.before", "service.before.nested");
    final var fact =
        new EntityPrefixMutation(1, "chart", "service.before", "service.before.nested");
    assertEquals(List.of(fact), facts(jdbi, ProjectionTarget.SEARCH));
    final List<Member> members = members(backend, jdbi, fact, CHARTS);
    assertEquals(200, members.size());
    assertEquals(200, members.stream().map(Member::id).distinct().count());
    for (final Member member : members) {
      assertTrue(member.beforeFqn().startsWith("service.before.child"));
      assertStored(
          jdbi,
          CHARTS,
          member.id(),
          "service.before.nested" + member.beforeFqn().substring("service.before".length()));
    }
  }

  private static Container container(final String fqn) {
    return new Container()
        .withId(id(1))
        .withName("child")
        .withFullyQualifiedName(fqn)
        .withUpdatedAt(1L)
        .withUpdatedBy("test")
        .withDeleted(false)
        .withDataModel(
            new ContainerDataModel()
                .withColumns(
                    List.of(
                        new Column()
                            .withName("record")
                            .withDataType(ColumnDataType.STRUCT)
                            .withFullyQualifiedName(fqn + ".record")
                            .withChildren(
                                List.of(
                                    new Column()
                                        .withName("leaf")
                                        .withDataType(ColumnDataType.INT)
                                        .withFullyQualifiedName(fqn + ".record.leaf"))))));
  }

  private static boolean isRewrite(final StatementContext context) {
    return context.getRenderedSql().startsWith("UPDATE chart_entity SET json = CASE");
  }

  private static void assertStored(
      final Jdbi jdbi, final String table, final UUID id, final String fqn) {
    jdbi.useHandle(
        handle -> {
          final var stored =
              handle
                  .createQuery("SELECT json, fqnHash FROM <table> WHERE id = :id")
                  .define("table", table)
                  .bind("id", id.toString())
                  .mapToMap()
                  .one();
          assertEquals(
              fqn,
              JsonUtils.readTree(stored.get("json").toString()).get("fullyQualifiedName").asText());
          assertEquals(FullyQualifiedName.buildHash(fqn), stored.get("fqnhash"));
        });
  }

  private static void assertOriginalCharts(final Jdbi jdbi, final int count) {
    final List<String> actual =
        jdbi.withHandle(
            handle ->
                handle
                    .createQuery("SELECT json FROM chart_entity ORDER BY id")
                    .mapTo(String.class)
                    .list());
    assertTrue(actual.size() >= count);
    for (int index = 0; index < count; index++) {
      assertEquals(
          "service.before.child" + index,
          JsonUtils.readTree(actual.get(index)).get("fullyQualifiedName").asText());
    }
  }

  private static List<MutationFacts> facts(final Jdbi jdbi, final ProjectionTarget target) {
    return new ProjectionJournal(jdbi, Clock.systemUTC(), EnumSet.allOf(ProjectionTarget.class))
        .claim(target, 1000, Duration.ofSeconds(30)).stream()
            .map(ProjectionJournal.Claim::mutation)
            .toList();
  }

  private static List<Member> members(
      final RdfTestDatabase.Backend backend,
      final Jdbi jdbi,
      final EntityPrefixMutation rewrite,
      final String table) {
    final var reader = new EntityPrefixMembers(jdbi, ConnectionType.valueOf(backend.name()));
    final var source =
        new ProjectionOwnerLookup.Source(rewrite.entityType(), table, "fqnHash", false);
    final List<Member> members = new ArrayList<>();
    List<Member> page;
    String after = null;
    do {
      page = reader.page(source, rewrite, after, 100);
      members.addAll(page);
      after = page.isEmpty() ? after : page.getLast().hash();
    } while (page.size() == 100);
    return members;
  }
}

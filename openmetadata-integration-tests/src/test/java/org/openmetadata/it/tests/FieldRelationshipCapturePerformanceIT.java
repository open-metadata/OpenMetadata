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
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.time.Duration;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.EnumSet;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.stream.IntStream;
import org.jdbi.v3.core.Jdbi;
import org.jdbi.v3.core.statement.SqlLogger;
import org.jdbi.v3.core.statement.StatementContext;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.MethodSource;
import org.openmetadata.it.util.MutableClock;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.service.jdbi3.CoreRelationshipDAOs.FieldRelationshipDAO;
import org.openmetadata.service.projection.FieldRelationshipSnapshot;
import org.openmetadata.service.projection.ProjectionJournal;
import org.openmetadata.service.projection.ProjectionTarget;
import org.openmetadata.service.util.FullyQualifiedName;

class FieldRelationshipCapturePerformanceIT extends FieldRelationshipCaptureTestBase {
  @ParameterizedTest
  @MethodSource("org.openmetadata.it.tests.RdfTestDatabase#backends")
  void largeDeletionUsesBoundedStatementsAndRecoverableIndependentPages(
      final RdfTestDatabase.Backend backend) {
    final var fixture = fixture(backend);
    fixture.seedFanout(6005);
    final List<Integer> statementSizes = new ArrayList<>();
    fixture
        .jdbi()
        .setSqlLogger(
            new SqlLogger() {
              @Override
              public void logBeforeExecution(final StatementContext context) {
                if (CaptureStatements.deletes(context, "field_relationship")) {
                  statementSizes.add(context.getParsedSql().getParameters().getParameterCount());
                }
              }
            });
    try {
      fixture.dao().deleteAllByPrefix("service.table");
    } finally {
      fixture.jdbi().setSqlLogger(SqlLogger.NOP_SQL_LOGGER);
    }
    assertEquals(List.of(backend == RdfTestDatabase.Backend.POSTGRES ? 3 : 1), statementSizes);
    assertEquals(0, fixture.count("field_relationship"));
    final var search = fixture.claims(ProjectionTarget.SEARCH).getFirst();
    final var rdf = fixture.claims(ProjectionTarget.RDF).getFirst();
    final var firstPage = fixture.snapshots().page(search.id(), 0, 1000);
    final long after = firstPage.getLast().id();
    assertEquals(1000, firstPage.size());
    assertTrue(fixture.journal().advance(search, Long.toString(after), false, handle -> {}));
    final MutableClock clock = new MutableClock();
    final var restarted =
        new ProjectionJournal(fixture.jdbi(), clock, EnumSet.allOf(ProjectionTarget.class));
    final var resumed =
        restarted.claim(ProjectionTarget.SEARCH, 10, Duration.ofSeconds(30)).getFirst();
    assertEquals(Long.toString(after), resumed.cursor());
    assertNull(rdf.cursor());
    final Set<String> targets =
        new HashSet<>(firstPage.stream().map(row -> row.to().fqnHash()).toList());
    targets.addAll(readTargets(fixture, resumed.id(), Long.parseLong(resumed.cursor())));
    final Set<String> expected = new HashSet<>();
    IntStream.range(0, 6005)
        .forEach(i -> expected.add(FullyQualifiedName.buildHash("service.table.column" + i)));
    assertEquals(expected, targets);
    assertTrue(restarted.advance(resumed, null, true, handle -> {}));
    assertEquals(expected, readTargets(fixture, rdf.id(), 0));
    assertTrue(restarted.retry(rdf, "RDF unavailable", Duration.ofSeconds(1)));
    assertTrue(restarted.claim(ProjectionTarget.SEARCH, 10, Duration.ofSeconds(30)).isEmpty());
    assertTrue(restarted.claim(ProjectionTarget.RDF, 10, Duration.ofSeconds(30)).isEmpty());
    clock.advance(Duration.ofSeconds(1));
    assertEquals(
        1, restarted.claim(ProjectionTarget.RDF, 10, Duration.ofSeconds(30)).getFirst().attempts());
  }

  @ParameterizedTest
  @MethodSource("org.openmetadata.it.tests.RdfTestDatabase#backends")
  void batchCaptureDoesNotAddAPointQueryPerRow(final RdfTestDatabase.Backend backend) {
    final var fixture = fixture(backend);
    final var rows =
        IntStream.range(0, 205)
            .mapToObj(
                i ->
                    FieldRelationshipCaptureFixture.relationship(
                        "thread", "service.table.column" + i, Relationship.IS_ABOUT.ordinal()))
            .toList();
    final AtomicInteger statements = new AtomicInteger();
    final List<Integer> captureSizes = new ArrayList<>();
    fixture
        .jdbi()
        .setSqlLogger(
            new SqlLogger() {
              @Override
              public void logBeforeExecution(final StatementContext context) {
                statements.incrementAndGet();
                if (context
                    .getRenderedSql()
                    .startsWith("INSERT INTO metadata_projection_field_relationship")) {
                  captureSizes.add(context.getParsedSql().getParameters().getParameterCount());
                }
              }
            });
    try {
      fixture.dao().insertMany(rows);
    } finally {
      fixture.jdbi().setSqlLogger(SqlLogger.NOP_SQL_LOGGER);
    }
    assertEquals(6, statements.get());
    assertEquals(List.of(301, 301, 16), captureSizes);
    assertEquals(205, fixture.count("field_relationship"));
    assertEquals(205, fixture.retained().size());
  }

  @ParameterizedTest
  @EnabledIfSystemProperty(named = "projection.capture.benchmark", matches = "true")
  @MethodSource("org.openmetadata.it.tests.RdfTestDatabase#backends")
  void pointCaptureAddsConstantDatabaseWork(final RdfTestDatabase.Backend backend) {
    final var captured = fixture(backend);
    try (var baseline = new FieldRelationshipCaptureFixture(backend, false)) {
      for (final boolean upsert : List.of(false, true)) {
        baseline.clear();
        captured.clear();
        final Sample without = measure(baseline.jdbi(), upsert);
        final Sample with = measure(captured.jdbi(), upsert);
        assertEquals(120, without.statements());
        // Per transaction: the write and its read-back (an upsert adds its guard and locked
        // before-image read), then one header, snapshot and consumer insert at commit.
        assertEquals(upsert ? 840 : 600, with.statements());
        assertEquals(120, captured.count("field_relationship"));
        assertEquals(upsert ? 240 : 120, captured.count("metadata_projection_field_relationship"));
        System.out.printf(
            Locale.ROOT,
            "Field relationship %s %s diagnostic: baseline p50=%.3f ms p95=%.3f ms; captured p50=%.3f ms p95=%.3f ms%n",
            backend,
            upsert ? "upsert" : "insert",
            without.p50Millis(),
            without.p95Millis(),
            with.p50Millis(),
            with.p95Millis());
      }
    }
  }

  private static Set<String> readTargets(
      final FieldRelationshipCaptureFixture fixture, final long mutationId, final long cursor) {
    final Set<String> targets = new HashSet<>();
    long after = cursor;
    List<FieldRelationshipSnapshot> page;
    do {
      page = fixture.snapshots().page(mutationId, after, 1000);
      assertTrue(page.size() <= 1000);
      targets.addAll(page.stream().map(row -> row.to().fqnHash()).toList());
      if (!page.isEmpty()) {
        after = page.getLast().id();
      }
    } while (!page.isEmpty());
    return targets;
  }

  private static Sample measure(final Jdbi jdbi, final boolean upsert) {
    final AtomicInteger statements = new AtomicInteger();
    final long[] nanos = new long[100];
    jdbi.setSqlLogger(
        new SqlLogger() {
          @Override
          public void logAfterExecution(final StatementContext context) {
            statements.incrementAndGet();
          }
        });
    try {
      jdbi.useHandle(
          handle -> {
            final var dao = handle.attach(FieldRelationshipDAO.class);
            for (int i = -20; i < nanos.length; i++) {
              final String to = "table.column_" + i;
              final long started = System.nanoTime();
              handle.useTransaction(
                  transaction -> {
                    if (upsert) {
                      dao.upsert("thread", to, "thread", to, "THREAD", "table", 3, null, null);
                    } else {
                      dao.insert("thread", to, "thread", to, "THREAD", "table", 3, null);
                    }
                  });
              if (i >= 0) {
                nanos[i] = System.nanoTime() - started;
              }
            }
          });
    } finally {
      jdbi.setSqlLogger(SqlLogger.NOP_SQL_LOGGER);
    }
    Arrays.sort(nanos);
    return new Sample(nanos[49] / 1_000_000.0, nanos[94] / 1_000_000.0, statements.get());
  }

  private record Sample(double p50Millis, double p95Millis, int statements) {}
}

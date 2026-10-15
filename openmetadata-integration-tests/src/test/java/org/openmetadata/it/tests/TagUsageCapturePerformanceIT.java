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
import static org.junit.jupiter.api.Assertions.assertNotNull;

import java.util.Arrays;
import java.util.Locale;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicLong;
import java.util.concurrent.atomic.AtomicReference;
import java.util.stream.Collectors;
import java.util.stream.IntStream;
import org.jdbi.v3.core.Jdbi;
import org.jdbi.v3.core.statement.SqlLogger;
import org.jdbi.v3.core.statement.StatementContext;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.MethodSource;
import org.openmetadata.service.jdbi3.ClassificationTagDAOs.TagUsageDAO;
import org.openmetadata.service.util.FullyQualifiedName;

@Execution(ExecutionMode.SAME_THREAD)
@EnabledIfSystemProperty(named = "projection.capture.benchmark", matches = "true")
class TagUsageCapturePerformanceIT {
  private static final String MATCHED_TAG = "Glossary.Matched";

  @ParameterizedTest
  @MethodSource("org.openmetadata.it.tests.RdfTestDatabase#backends")
  void retainedDeleteUsesOneSourceStatementForLargeMembership(
      final RdfTestDatabase.Backend backend) {
    final double baselineMillis = measureUncapturedDelete(backend);
    try (var fixture = new TagUsageCaptureFixture(backend)) {
      seedLargeMembership(fixture);
      if (backend == RdfTestDatabase.Backend.MYSQL) {
        fixture.jdbi().useHandle(handle -> handle.execute("ANALYZE TABLE tag_usage"));
      }
      final var deletes = new AtomicInteger();
      final var statements = new AtomicInteger();
      final var explainNanos = new AtomicLong();
      final var plan = new AtomicReference<String>();
      fixture
          .jdbi()
          .setSqlLogger(
              new SqlLogger() {
                @Override
                public void logBeforeExecution(final StatementContext context) {
                  statements.incrementAndGet();
                  if (CaptureStatements.deletes(context, "tag_usage")) {
                    deletes.incrementAndGet();
                    final long started = System.nanoTime();
                    plan.set(CaptureQueryPlan.explainRetainedDelete(context, backend));
                    if (backend == RdfTestDatabase.Backend.MYSQL) {
                      CaptureQueryPlan.assertIndexedSourceLookup(plan.get(), "tag_usage", 1);
                    }
                    explainNanos.addAndGet(System.nanoTime() - started);
                  }
                }
              });
      final long started = System.nanoTime();
      try {
        fixture.dao().deleteTagLabels(1, MATCHED_TAG);
      } finally {
        fixture.jdbi().setSqlLogger(SqlLogger.NOP_SQL_LOGGER);
      }
      final double millis = (System.nanoTime() - started - explainNanos.get()) / 1_000_000.0;
      assertEquals(1, deletes.get());
      assertEquals(backend == RdfTestDatabase.Backend.POSTGRES ? 3 : 4, statements.get());
      assertEquals(10000, fixture.count("tag_usage"));
      assertEquals(100000, fixture.count("metadata_projection_tag_usage"));
      assertNotNull(plan.get());
      System.out.printf(
          Locale.ROOT,
          "Retained tag delete %s: 100000 matches, %d statements, baseline %.3f ms, captured %.3f ms excluding EXPLAIN; plan=%s%n",
          backend,
          statements.get(),
          baselineMillis,
          millis,
          plan.get());
    }
  }

  private static double measureUncapturedDelete(final RdfTestDatabase.Backend backend) {
    try (final var fixture = new TagUsageCaptureFixture(backend, false)) {
      seedLargeMembership(fixture);
      final long started = System.nanoTime();
      fixture.dao().deleteTagLabels(1, MATCHED_TAG);
      final double millis = (System.nanoTime() - started) / 1_000_000.0;
      assertEquals(10000, fixture.count("tag_usage"));
      assertEquals(0, fixture.count("metadata_projection_tag_usage"));
      return millis;
    }
  }

  private static void seedLargeMembership(final TagUsageCaptureFixture fixture) {
    final String values =
        IntStream.range(0, 1000)
            .mapToObj(index -> "(1, :tag, :tagHash, :target" + index + ", 0, 1)")
            .collect(Collectors.joining(","));
    fixture
        .jdbi()
        .useTransaction(
            handle -> {
              for (int start = 0; start < 110000; start += 1000) {
                final var insert =
                    handle.createUpdate(
                        "INSERT INTO tag_usage (source, tagFQN, tagFQNHash, targetFQNHash, labelType, state) VALUES "
                            + values);
                final String tag = start < 100000 ? MATCHED_TAG : "Glossary.Other";
                insert.bind("tag", tag).bind("tagHash", FullyQualifiedName.buildHash(tag));
                for (int offset = 0; offset < 1000; offset++) {
                  insert.bind(
                      "target" + offset,
                      FullyQualifiedName.buildHash("service.table.column" + (start + offset)));
                }
                insert.execute();
              }
            });
  }

  @ParameterizedTest
  @MethodSource("org.openmetadata.it.tests.RdfTestDatabase#backends")
  void pointCaptureAddsConstantSqlWork(final RdfTestDatabase.Backend backend) {
    try (var baseline = new TagUsageCaptureFixture(backend, false);
        var captured = new TagUsageCaptureFixture(backend)) {
      final Sample without = measure(baseline.jdbi());
      final Sample with = measure(captured.jdbi());
      assertEquals(120, without.statements());
      assertEquals(480, with.statements());
      assertEquals(120, captured.count("tag_usage"));
      assertEquals(120, captured.count("metadata_projection_tag_usage"));
      System.out.printf(
          Locale.ROOT,
          "Tag capture diagnostic %s: baseline p50=%.3f ms p95=%.3f ms; captured p50=%.3f ms p95=%.3f ms%n",
          backend,
          without.p50Millis(),
          without.p95Millis(),
          with.p50Millis(),
          with.p95Millis());
    }
  }

  private static Sample measure(final Jdbi jdbi) {
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
            final TagUsageDAO dao = handle.attach(TagUsageDAO.class);
            for (int i = -20; i < nanos.length; i++) {
              final String target = "service.table.column_" + i;
              final long started = System.nanoTime();
              handle.useTransaction(
                  transaction ->
                      dao.applyTag(
                          1,
                          "Glossary.Customer",
                          "Glossary.Customer",
                          target,
                          0,
                          1,
                          null,
                          "admin"));
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

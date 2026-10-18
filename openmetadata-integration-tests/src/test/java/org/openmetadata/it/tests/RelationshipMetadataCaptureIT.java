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
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.time.Duration;
import java.util.Arrays;
import java.util.EnumMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.stream.Collectors;
import lombok.extern.slf4j.Slf4j;
import org.jdbi.v3.core.Jdbi;
import org.jdbi.v3.core.statement.SqlLogger;
import org.jdbi.v3.core.statement.StatementContext;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.MethodSource;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.CoreRelationshipDAOs.EntityRelationshipDAO;
import org.openmetadata.service.projection.ProjectionJournal;
import org.openmetadata.service.projection.ProjectionTarget;

@Slf4j
@Execution(ExecutionMode.SAME_THREAD)
class RelationshipMetadataCaptureIT {
  private static final Map<RdfTestDatabase.Backend, RelationshipCaptureFixture> DATABASES =
      new EnumMap<>(RdfTestDatabase.Backend.class);

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
  void ontologyReplacementAndTypedDeletionRetainTheCorrectIdentifiers(
      final RdfTestDatabase.Backend backend) {
    final var fixture = DATABASES.get(backend);
    final UUID from = UUID.randomUUID();
    final UUID to = UUID.randomUUID();
    final UUID oldId = UUID.randomUUID();
    final UUID newId = UUID.randomUUID();
    final UUID oldType = UUID.randomUUID();
    final UUID newType = UUID.randomUUID();
    final int relation = Relationship.RELATED_TO.ordinal();
    fixture
        .dao()
        .insertOntologyRelationship(
            from,
            to,
            Entity.GLOSSARY_TERM,
            Entity.GLOSSARY_TERM,
            relation,
            "synonym",
            oldId,
            oldType,
            null);
    fixture
        .dao()
        .insertOntologyRelationship(
            from,
            to,
            Entity.GLOSSARY_TERM,
            Entity.GLOSSARY_TERM,
            relation,
            "synonym",
            newId,
            newType,
            null);
    fixture
        .dao()
        .insert(from, to, Entity.GLOSSARY_TERM, Entity.GLOSSARY_TERM, relation, "seeAlso", null);
    final var writes = claims(fixture);
    final var replaced = fixture.snapshots().page(writes.get(1).id(), 0, 10);
    assertEquals(
        Set.of(oldId, newId),
        replaced.stream()
            .map(row -> row.relatedIds().relationshipId())
            .collect(Collectors.toSet()));
    assertEquals(
        Set.of(oldType, newType),
        replaced.stream()
            .map(row -> row.relatedIds().relationshipTypeId())
            .collect(Collectors.toSet()));
    assertEquals(
        1,
        fixture
            .dao()
            .deleteWithRelationType(
                from, Entity.GLOSSARY_TERM, to, Entity.GLOSSARY_TERM, relation, "synonym"));
    final var removed = fixture.snapshots().page(claims(fixture).getFirst().id(), 0, 10);
    assertEquals(1, removed.size());
    assertEquals(newId, removed.getFirst().relatedIds().relationshipId());
    assertEquals(newType, removed.getFirst().relatedIds().relationshipTypeId());
    assertEquals("synonym", removed.getFirst().relation().type());
    assertEquals(
        List.of("seeAlso"),
        fixture
            .jdbi()
            .withHandle(
                handle ->
                    handle
                        .createQuery("SELECT relationType FROM entity_relationship")
                        .mapTo(String.class)
                        .list()));
  }

  @ParameterizedTest
  @MethodSource("org.openmetadata.it.tests.RdfTestDatabase#backends")
  void lineageCleanupRetainsPipelineAndEndpointDependenciesWithItsSourceFilter(
      final RdfTestDatabase.Backend backend) {
    final var fixture = DATABASES.get(backend);
    final UUID pipeline = UUID.randomUUID();
    final UUID otherPipeline = UUID.randomUUID();
    final UUID table = UUID.randomUUID();
    final UUID manualSource = UUID.randomUUID();
    final UUID connectorSource = UUID.randomUUID();
    final int relation = Relationship.UPSTREAM.ordinal();
    fixture
        .dao()
        .insert(
            manualSource, table, Entity.TABLE, Entity.TABLE, relation, lineage(pipeline, "manual"));
    fixture
        .dao()
        .insert(
            connectorSource,
            table,
            Entity.TABLE,
            Entity.TABLE,
            relation,
            lineage(pipeline, "connector"));
    fixture
        .dao()
        .insert(
            connectorSource,
            pipeline,
            Entity.TABLE,
            Entity.PIPELINE,
            relation,
            lineage(otherPipeline, "connector"));
    claims(fixture);
    fixture.dao().deleteLineageBySourcePipeline(pipeline, "connector", relation);
    final var removed = fixture.snapshots().page(claims(fixture).getFirst().id(), 0, 10);
    assertEquals(
        Set.of(pipeline, otherPipeline),
        removed.stream().map(row -> row.relatedIds().pipelineId()).collect(Collectors.toSet()));
    assertEquals(
        Set.of(table, pipeline),
        removed.stream().map(row -> row.to().id()).collect(Collectors.toSet()));
    assertEquals(
        List.of(manualSource.toString()),
        fixture
            .jdbi()
            .withHandle(
                handle ->
                    handle
                        .createQuery("SELECT fromId FROM entity_relationship")
                        .mapTo(String.class)
                        .list()));
    fixture.dao().deleteLineageBySource(table, Entity.TABLE, "manual", relation);
    final var last = fixture.snapshots().page(claims(fixture).getFirst().id(), 0, 10);
    assertEquals(1, last.size());
    assertEquals(manualSource, last.getFirst().from().id());
    assertEquals(pipeline, last.getFirst().relatedIds().pipelineId());
    assertEquals(0, fixture.dao().getTotalRelationshipCount());
  }

  @ParameterizedTest
  @MethodSource("org.openmetadata.it.tests.RdfTestDatabase#backends")
  void listDeletionRetainsOnlyTheRequestedEntityTypes(final RdfTestDatabase.Backend backend) {
    final var fixture = DATABASES.get(backend);
    final UUID domain = UUID.randomUUID();
    final UUID table = UUID.randomUUID();
    final UUID user = UUID.randomUUID();
    final int relation = Relationship.HAS.ordinal();
    fixture.dao().insert(domain, table, Entity.DOMAIN, Entity.TABLE, relation);
    fixture.dao().insert(domain, user, Entity.DOMAIN, Entity.USER, relation);
    claims(fixture);
    fixture
        .dao()
        .deleteToMany(
            List.of(table.toString(), user.toString()), Entity.TABLE, relation, Entity.DOMAIN);
    final var removed = fixture.snapshots().page(claims(fixture).getFirst().id(), 0, 10);
    assertEquals(List.of(table), removed.stream().map(row -> row.to().id()).toList());
    assertEquals(
        List.of(user.toString()),
        fixture
            .jdbi()
            .withHandle(
                handle ->
                    handle
                        .createQuery("SELECT toId FROM entity_relationship")
                        .mapTo(String.class)
                        .list()));
  }

  @EnabledIfSystemProperty(named = "projection.capture.benchmark", matches = "true")
  @ParameterizedTest
  @MethodSource("org.openmetadata.it.tests.RdfTestDatabase#backends")
  void pointCaptureUsesConstantSqlAndReportsLocalTransactionCost(
      final RdfTestDatabase.Backend backend) {
    try (final var baseline = new RelationshipCaptureFixture(backend, false)) {
      for (final Relationship relation : List.of(Relationship.HAS, Relationship.UPSTREAM)) {
        final Sample before = measure(baseline.jdbi(), relation);
        final Sample captured = measure(DATABASES.get(backend).jdbi(), relation);
        assertEquals(120, before.statements());
        assertEquals(capturedStatements(backend, relation), captured.statements());
        log.info(
            "Relationship capture diagnostic {} {}: 100 warmed transactions, baseline p50={}ms p95={}ms, capture p50={}ms p95={}ms",
            backend,
            relation,
            before.p50Millis(),
            before.p95Millis(),
            captured.p50Millis(),
            captured.p95Millis());
      }
    }
  }

  /**
   * Statements for 120 one-write transactions, each committing one header, one snapshot insert and
   * its consumers. A buffered upsert adds only its own statement. Lineage keeps its before-image:
   * PostgreSQL inserts and captures the first row in one statement, then locks, reads and upserts
   * with RETURNING; MySQL guards, reads, upserts and reads again.
   */
  private static int capturedStatements(
      final RdfTestDatabase.Backend backend, final Relationship relation) {
    if (relation != Relationship.UPSTREAM) {
      return 120 * 4;
    }
    return backend == RdfTestDatabase.Backend.POSTGRES ? 4 + 119 * 6 : 120 * 7;
  }

  private static Sample measure(final Jdbi jdbi, final Relationship relation) {
    final AtomicInteger statements = new AtomicInteger();
    final long[] nanos = new long[100];
    final UUID from = UUID.randomUUID();
    final UUID to = UUID.randomUUID();
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
            final var dao = handle.attach(EntityRelationshipDAO.class);
            for (int i = -20; i < nanos.length; i++) {
              final long started = System.nanoTime();
              handle.useTransaction(
                  transaction ->
                      dao.insert(from, to, Entity.TABLE, Entity.TABLE, relation.ordinal(), "{}"));
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

  private static String lineage(final UUID pipeline, final String source) {
    return "{\"pipeline\":{\"id\":\"" + pipeline + "\"},\"source\":\"" + source + "\"}";
  }

  private static List<ProjectionJournal.Claim> claims(final RelationshipCaptureFixture fixture) {
    final var claims =
        fixture.journal().claim(ProjectionTarget.SEARCH, 1000, Duration.ofSeconds(30));
    assertTrue(!claims.isEmpty());
    return claims;
  }

  private record Sample(double p50Millis, double p95Millis, int statements) {}
}

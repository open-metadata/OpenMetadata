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

import java.util.UUID;
import java.util.concurrent.atomic.AtomicReference;
import org.jdbi.v3.core.Jdbi;
import org.jdbi.v3.core.statement.SqlLogger;
import org.jdbi.v3.core.statement.StatementContext;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIf;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.openmetadata.service.util.FullyQualifiedName;

@Execution(ExecutionMode.SAME_THREAD)
@EnabledIf("org.openmetadata.it.tests.RdfTestDatabase#mysqlEnabled")
class RetainedMembershipQueryPlanIT {
  private static final RdfTestDatabase.Backend BACKEND = RdfTestDatabase.Backend.MYSQL;

  @Test
  void tagDeleteUsesHashKeysBeyondTheCommonSourcePrefix() {
    try (final var fixture = new TagUsageCaptureFixture(BACKEND)) {
      fixture
          .jdbi()
          .useTransaction(
              handle -> {
                final var batch =
                    handle.prepareBatch(
                        """
            INSERT INTO tag_usage (source, tagFQN, tagFQNHash, targetFQNHash, labelType, state)
            VALUES (1, 'Glossary.Term', :tag, :target, 0, 1)
            """);
                for (int i = 0; i < 1000; i++) {
                  batch
                      .bind("tag", FullyQualifiedName.buildHash("Glossary.Term"))
                      .bind("target", FullyQualifiedName.buildHash("service.table.column" + i))
                      .add();
                }
                batch.execute();
              });
      fixture.jdbi().useHandle(handle -> handle.execute("ANALYZE TABLE tag_usage"));
      final var plan = observe(fixture.jdbi());
      fixture
          .dao()
          .deleteTagUsage(
              1,
              FullyQualifiedName.buildHash("Glossary.Term"),
              FullyQualifiedName.buildHash("service.table.column0"));
      CaptureQueryPlan.assertIndexedSourceLookup(plan.get(), "tag_usage", 1);
      assertEquals(999, fixture.count("tag_usage"));
      assertEquals(1, fixture.count("metadata_projection_tag_usage"));
    }
  }

  @Test
  void fieldDeleteUsesBothEndpointHashes() {
    try (final var fixture = new FieldRelationshipCaptureFixture(BACKEND)) {
      fixture.seedFanout(1000);
      fixture.jdbi().useHandle(handle -> handle.execute("ANALYZE TABLE field_relationship"));
      final var plan = observe(fixture.jdbi());
      fixture.dao().delete("thread", "service.table.column0", "THREAD", "table", 3);
      CaptureQueryPlan.assertIndexedSourceLookup(plan.get(), "field_relationship", 2);
      assertEquals(999, fixture.count("field_relationship"));
      assertEquals(1, fixture.count("metadata_projection_field_relationship"));
    }
  }

  @ParameterizedTest
  @ValueSource(strings = {"utf8mb4_unicode_ci", "utf8mb4_0900_ai_ci"})
  void relationshipDeletePreservesIndexedKeysAndUnicodeSubtypes(final String collation) {
    try (final var fixture = new RelationshipCaptureFixture(BACKEND)) {
      final UUID from = UUID.randomUUID();
      final UUID to = UUID.randomUUID();
      final String subtype = "東京\"\\関連";
      fixture
          .jdbi()
          .useHandle(
              handle ->
                  handle.execute(
                      "ALTER TABLE entity_relationship CONVERT TO CHARACTER SET utf8mb4 COLLATE "
                          + collation));
      seedRelationships(fixture.jdbi(), from, to, subtype);
      fixture.jdbi().useHandle(handle -> handle.execute("ANALYZE TABLE entity_relationship"));
      final var plan = observe(fixture.jdbi());
      assertEquals(1, fixture.dao().deleteWithRelationType(from, "table", to, "table", 0, subtype));
      CaptureQueryPlan.assertIndexedSourceLookup(plan.get(), "entity_relationship", 4);
      final int remaining =
          fixture
              .jdbi()
              .withHandle(
                  handle ->
                      handle
                          .createQuery("SELECT COUNT(*) FROM entity_relationship")
                          .mapTo(Integer.class)
                          .one());
      assertEquals(999, remaining);
    }
  }

  private static void seedRelationships(
      final Jdbi jdbi, final UUID from, final UUID to, final String subtype) {
    jdbi.useTransaction(
        handle -> {
          final var batch =
              handle.prepareBatch(
                  """
          INSERT INTO entity_relationship (fromId, toId, fromEntity, toEntity, relation, relationType)
          VALUES (:from, :to, 'table', 'table', 0, :subtype)
          """);
          for (int i = 0; i < 1000; i++) {
            batch
                .bind("from", from.toString())
                .bind("to", (i == 0 ? to : UUID.randomUUID()).toString())
                .bind("subtype", subtype)
                .add();
          }
          batch.execute();
        });
  }

  private static AtomicReference<String> observe(final Jdbi jdbi) {
    final var plan = new AtomicReference<String>();
    jdbi.setSqlLogger(
        new SqlLogger() {
          @Override
          public void logBeforeExecution(final StatementContext context) {
            if (context.getRenderedSql().startsWith("DELETE")
                && context.getRenderedSql().contains("projectionKey")) {
              plan.set(CaptureQueryPlan.explainRetainedDelete(context, BACKEND));
            }
          }
        });
    return plan;
  }
}

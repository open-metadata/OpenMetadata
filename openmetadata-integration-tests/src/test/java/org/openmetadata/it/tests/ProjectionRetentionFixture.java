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

import static org.junit.jupiter.api.Assertions.assertTrue;

import java.time.Duration;
import java.util.EnumSet;
import java.util.List;
import java.util.UUID;
import org.jdbi.v3.core.Jdbi;
import org.openmetadata.it.util.MutableClock;
import org.openmetadata.service.jdbi3.locator.ConnectionType;
import org.openmetadata.service.projection.EntityMutation;
import org.openmetadata.service.projection.ProjectionJournal;
import org.openmetadata.service.projection.ProjectionJournalRetention;
import org.openmetadata.service.projection.ProjectionTarget;
import org.openmetadata.service.projection.ProjectionWorkStore;
import org.openmetadata.service.projection.RelationshipMutation;

record ProjectionRetentionFixture(
    Jdbi jdbi,
    MutableClock clock,
    ProjectionJournal journal,
    ProjectionJournalRetention retention,
    ProjectionWorkStore work) {
  ProjectionRetentionFixture(final Jdbi jdbi, final ConnectionType dialect) {
    this(jdbi, new MutableClock(), dialect);
  }

  private ProjectionRetentionFixture(
      final Jdbi jdbi, final MutableClock clock, final ConnectionType dialect) {
    this(
        jdbi,
        clock,
        new ProjectionJournal(jdbi, clock, EnumSet.allOf(ProjectionTarget.class)),
        new ProjectionJournalRetention(jdbi, clock),
        new ProjectionWorkStore(jdbi, clock, dialect));
  }

  long relationship(final int rows) {
    return jdbi()
        .inTransaction(
            handle -> {
              final long id = journal().capture(handle, new RelationshipMutation(1));
              final var batch =
                  handle.prepareBatch(
                      """
          INSERT INTO metadata_projection_relationship
            (mutationId, fromId, toId, fromEntity, toEntity, relation, relationType)
          VALUES (:id, :from, :to, 'team', 'table', 0, '')
          """);
              for (int i = 0; i < rows; i++) {
                batch
                    .bind("id", id)
                    .bind("from", UUID.randomUUID().toString())
                    .bind("to", UUID.randomUUID().toString())
                    .add();
              }
              if (rows > 0) {
                batch.execute();
              }
              return id;
            });
  }

  void entity(
      final UUID id,
      final String before,
      final String after,
      final EntityMutation.Operation operation) {
    jdbi()
        .useTransaction(
            handle ->
                journal()
                    .capture(handle, new EntityMutation(1, "table", id, operation, before, after)));
  }

  void completeAll() {
    complete(ProjectionTarget.SEARCH);
    complete(ProjectionTarget.RDF);
  }

  void complete(final ProjectionTarget target) {
    for (final var claim : journal().claim(target, 1000, Duration.ofMinutes(1))) {
      assertTrue(
          journal()
              .advance(
                  claim,
                  null,
                  true,
                  handle ->
                      work()
                          .invalidate(
                              handle,
                              List.of(
                                  new ProjectionWorkStore.Key(
                                      target, "active", "table", UUID.randomUUID())))));
    }
  }

  long count(final String table) {
    return jdbi()
        .withHandle(
            handle -> handle.createQuery("SELECT COUNT(*) FROM " + table).mapTo(Long.class).one());
  }
}

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

import java.time.Clock;
import java.time.Duration;
import java.util.EnumSet;
import java.util.List;
import org.jdbi.v3.core.Jdbi;
import org.jdbi.v3.sqlobject.HandlerDecorators;
import org.jdbi.v3.sqlobject.SqlObjectPlugin;
import org.jdbi.v3.sqlobject.SqlObjects;
import org.openmetadata.service.jdbi3.CoreRelationshipDAOs.FieldRelationshipDAO;
import org.openmetadata.service.jdbi3.CoreRelationshipDAOs.FieldRelationshipDAO.FieldRelationship;
import org.openmetadata.service.jdbi3.locator.ConnectionAwareAnnotationSqlLocator;
import org.openmetadata.service.jdbi3.locator.ConnectionType;
import org.openmetadata.service.projection.FieldRelationshipMutationCapture;
import org.openmetadata.service.projection.FieldRelationshipSnapshot;
import org.openmetadata.service.projection.FieldRelationshipSnapshotStore;
import org.openmetadata.service.projection.ProjectionCapturePlugin;
import org.openmetadata.service.projection.ProjectionJournal;
import org.openmetadata.service.projection.ProjectionTarget;
import org.openmetadata.service.util.FullyQualifiedName;

final class FieldRelationshipCaptureFixture implements AutoCloseable {
  private final RdfTestDatabase database;
  private final ProjectionJournal journal;
  private final FieldRelationshipSnapshotStore snapshots;

  FieldRelationshipCaptureFixture(final RdfTestDatabase.Backend backend) {
    this(backend, true);
  }

  FieldRelationshipCaptureFixture(final RdfTestDatabase.Backend backend, final boolean capture) {
    database = new RdfTestDatabase(backend);
    database.applyProjectionMigrations();
    database.applyProjectionMigrations();
    final boolean mysql = backend == RdfTestDatabase.Backend.MYSQL;
    final Jdbi jdbi = database.jdbi();
    journal = new ProjectionJournal(jdbi, Clock.systemUTC(), EnumSet.allOf(ProjectionTarget.class));
    snapshots = new FieldRelationshipSnapshotStore(jdbi, journal);
    jdbi.installPlugin(new SqlObjectPlugin());
    jdbi.installPlugin(new ProjectionCapturePlugin());
    jdbi.getConfig(SqlObjects.class)
        .setSqlLocator(
            new ConnectionAwareAnnotationSqlLocator(
                mysql ? "com.mysql.cj.jdbc.Driver" : "org.postgresql.Driver"));
    if (capture) {
      jdbi.getConfig(HandlerDecorators.class)
          .register(
              new FieldRelationshipMutationCapture(
                  snapshots, mysql ? ConnectionType.MYSQL : ConnectionType.POSTGRES));
    }
    ProjectionTestSchema.create(jdbi, backend, "field_relationship");
  }

  Jdbi jdbi() {
    return database.jdbi();
  }

  FieldRelationshipDAO dao() {
    return jdbi().onDemand(FieldRelationshipDAO.class);
  }

  ProjectionJournal journal() {
    return journal;
  }

  FieldRelationshipSnapshotStore snapshots() {
    return snapshots;
  }

  List<FieldRelationshipSnapshot> retained() {
    return claims(ProjectionTarget.SEARCH).stream()
        .flatMap(claim -> snapshots.page(claim.id(), 0, 1000).stream())
        .toList();
  }

  static FieldRelationship relationship(final String from, final String to, final int relation) {
    final FieldRelationship row = new FieldRelationship();
    row.setFromFQNHash(FullyQualifiedName.buildHash(from));
    row.setToFQNHash(FullyQualifiedName.buildHash(to));
    row.setFromFQN(from);
    row.setToFQN(to);
    row.setFromType("THREAD");
    row.setToType("table");
    row.setRelation(relation);
    return row;
  }

  List<ProjectionJournal.Claim> claims(final ProjectionTarget target) {
    return journal.claim(target, 100, Duration.ofSeconds(30));
  }

  void seed(
      final String from,
      final String to,
      final String fromType,
      final String toType,
      final int relation) {
    jdbi()
        .useHandle(
            handle ->
                handle.execute(
                    "INSERT INTO field_relationship(fromFQNHash, toFQNHash, fromFQN, toFQN, fromType, toType, relation) VALUES (?, ?, ?, ?, ?, ?, ?)",
                    FullyQualifiedName.buildHash(from),
                    FullyQualifiedName.buildHash(to),
                    from,
                    to,
                    fromType,
                    toType,
                    relation));
  }

  void seedFanout(final int count) {
    jdbi()
        .useTransaction(
            handle -> {
              final var batch =
                  handle.prepareBatch(
                      "INSERT INTO field_relationship(fromFQNHash, toFQNHash, fromFQN, toFQN, fromType, toType, relation) "
                          + "VALUES (?, ?, ?, ?, 'THREAD', 'table', 3)");
              for (int i = 0; i < count; i++) {
                final String to = "service.table.column" + i;
                batch.add(
                    FullyQualifiedName.buildHash("thread"),
                    FullyQualifiedName.buildHash(to),
                    "thread",
                    to);
              }
              batch.execute();
            });
  }

  List<String> destinations() {
    return jdbi()
        .withHandle(
            handle ->
                handle
                    .createQuery("SELECT toFQN FROM field_relationship ORDER BY toFQN")
                    .mapTo(String.class)
                    .list());
  }

  int count(final String table) {
    return jdbi()
        .withHandle(
            handle ->
                handle.createQuery("SELECT COUNT(*) FROM " + table).mapTo(Integer.class).one());
  }

  void clear() {
    jdbi()
        .useHandle(
            handle -> {
              handle.execute("DELETE FROM metadata_projection_consumer");
              handle.execute("DELETE FROM metadata_projection_field_relationship");
              handle.execute("DELETE FROM metadata_projection_mutation");
              handle.execute("DELETE FROM field_relationship");
            });
  }

  @Override
  public void close() {
    database.close();
  }
}

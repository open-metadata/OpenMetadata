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
import java.util.EnumSet;
import org.jdbi.v3.core.Jdbi;
import org.jdbi.v3.sqlobject.HandlerDecorators;
import org.jdbi.v3.sqlobject.SqlObjectPlugin;
import org.jdbi.v3.sqlobject.SqlObjects;
import org.openmetadata.service.jdbi3.CoreRelationshipDAOs.EntityRelationshipDAO;
import org.openmetadata.service.jdbi3.locator.ConnectionAwareAnnotationSqlLocator;
import org.openmetadata.service.jdbi3.locator.ConnectionType;
import org.openmetadata.service.projection.ProjectionCapturePlugin;
import org.openmetadata.service.projection.ProjectionJournal;
import org.openmetadata.service.projection.ProjectionTarget;
import org.openmetadata.service.projection.RelationshipMutationCapture;
import org.openmetadata.service.projection.RelationshipSnapshotStore;

/** Shared real SQL fixture for relationship capture, failure and mutation-shape tests. */
final class RelationshipCaptureFixture implements AutoCloseable {
  private final RdfTestDatabase database;
  private final ProjectionJournal journal;
  private final RelationshipSnapshotStore snapshots;

  RelationshipCaptureFixture(final RdfTestDatabase.Backend backend) {
    this(backend, true);
  }

  RelationshipCaptureFixture(final RdfTestDatabase.Backend backend, final boolean capture) {
    database = new RdfTestDatabase(backend);
    database.applyProjectionMigrations();
    database.applyProjectionMigrations();
    final Jdbi jdbi = database.jdbi();
    final boolean mysql = backend == RdfTestDatabase.Backend.MYSQL;
    final ConnectionType dialect = mysql ? ConnectionType.MYSQL : ConnectionType.POSTGRES;
    journal = new ProjectionJournal(jdbi, Clock.systemUTC(), EnumSet.allOf(ProjectionTarget.class));
    snapshots = new RelationshipSnapshotStore(jdbi, journal, dialect);
    jdbi.installPlugin(new SqlObjectPlugin());
    jdbi.installPlugin(new ProjectionCapturePlugin());
    jdbi.getConfig(SqlObjects.class)
        .setSqlLocator(
            new ConnectionAwareAnnotationSqlLocator(
                mysql ? "com.mysql.cj.jdbc.Driver" : "org.postgresql.Driver"));
    if (capture) {
      jdbi.getConfig(HandlerDecorators.class)
          .register(new RelationshipMutationCapture(snapshots, dialect));
    }
    ProjectionTestSchema.create(jdbi, backend, "entity_relationship");
  }

  Jdbi jdbi() {
    return database.jdbi();
  }

  EntityRelationshipDAO dao() {
    return jdbi().onDemand(EntityRelationshipDAO.class);
  }

  ProjectionJournal journal() {
    return journal;
  }

  RelationshipSnapshotStore snapshots() {
    return snapshots;
  }

  void clear() {
    jdbi()
        .useHandle(
            handle -> {
              handle.execute("DELETE FROM metadata_projection_relationship");
              handle.execute("DELETE FROM metadata_projection_consumer");
              handle.execute("DELETE FROM metadata_projection_mutation");
              handle.execute("DELETE FROM entity_relationship");
            });
  }

  @Override
  public void close() {
    database.close();
  }
}

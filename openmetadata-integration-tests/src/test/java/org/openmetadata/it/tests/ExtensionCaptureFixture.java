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
import java.util.UUID;
import org.jdbi.v3.core.Jdbi;
import org.jdbi.v3.sqlobject.HandlerDecorators;
import org.jdbi.v3.sqlobject.SqlObjectPlugin;
import org.jdbi.v3.sqlobject.SqlObjects;
import org.openmetadata.service.jdbi3.CoreRelationshipDAOs.EntityExtensionDAO;
import org.openmetadata.service.jdbi3.locator.ConnectionAwareAnnotationSqlLocator;
import org.openmetadata.service.jdbi3.locator.ConnectionType;
import org.openmetadata.service.projection.ExtensionMutationCapture;
import org.openmetadata.service.projection.ExtensionSnapshotStore;
import org.openmetadata.service.projection.ProjectionCapturePlugin;
import org.openmetadata.service.projection.ProjectionJournal;
import org.openmetadata.service.projection.ProjectionTarget;

final class ExtensionCaptureFixture implements AutoCloseable {
  private final RdfTestDatabase database;
  private final ProjectionJournal journal;
  private final ExtensionSnapshotStore snapshots;

  ExtensionCaptureFixture(final RdfTestDatabase.Backend backend) {
    database = new RdfTestDatabase(backend);
    database.applyProjectionMigrations();
    database.applyProjectionMigrations();
    final Jdbi jdbi = database.jdbi();
    jdbi.installPlugin(new SqlObjectPlugin());
    jdbi.installPlugin(new ProjectionCapturePlugin());
    jdbi.getConfig(SqlObjects.class)
        .setSqlLocator(
            new ConnectionAwareAnnotationSqlLocator(
                backend == RdfTestDatabase.Backend.MYSQL
                    ? "com.mysql.cj.jdbc.Driver"
                    : "org.postgresql.Driver"));
    journal = new ProjectionJournal(jdbi, Clock.systemUTC(), EnumSet.allOf(ProjectionTarget.class));
    snapshots =
        new ExtensionSnapshotStore(
            jdbi,
            journal,
            backend == RdfTestDatabase.Backend.MYSQL
                ? ConnectionType.MYSQL
                : ConnectionType.POSTGRES);
    jdbi.getConfig(HandlerDecorators.class)
        .register(new ExtensionMutationCapture(journal, snapshots));
    ProjectionTestSchema.create(jdbi, backend, "entity_extension");
  }

  Jdbi jdbi() {
    return database.jdbi();
  }

  ProjectionJournal journal() {
    return journal;
  }

  ExtensionSnapshotStore snapshots() {
    return snapshots;
  }

  EntityExtensionDAO dao() {
    return jdbi().onDemand(EntityExtensionDAO.class);
  }

  List<ProjectionJournal.Claim> claims(final ProjectionTarget target) {
    return journal.claim(target, 1000, Duration.ofSeconds(30));
  }

  void seed(final UUID owner, final String extension) {
    jdbi()
        .useHandle(
            handle ->
                handle.execute(
                    "INSERT INTO entity_extension (id, extension, jsonSchema, json) VALUES (?, ?, 'customFieldSchema', '{}')",
                    owner.toString(),
                    extension));
  }

  int count(final String table) {
    return jdbi()
        .withHandle(
            handle ->
                handle.createQuery("SELECT COUNT(*) FROM " + table).mapTo(Integer.class).one());
  }

  @Override
  public void close() {
    database.close();
  }
}

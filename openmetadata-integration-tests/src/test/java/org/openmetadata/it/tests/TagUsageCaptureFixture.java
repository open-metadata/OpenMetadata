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
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.service.jdbi3.ClassificationTagDAOs.TagUsageDAO;
import org.openmetadata.service.jdbi3.locator.ConnectionAwareAnnotationSqlLocator;
import org.openmetadata.service.jdbi3.locator.ConnectionType;
import org.openmetadata.service.projection.ProjectionCapturePlugin;
import org.openmetadata.service.projection.ProjectionJournal;
import org.openmetadata.service.projection.ProjectionTarget;
import org.openmetadata.service.projection.TagUsageMutationCapture;
import org.openmetadata.service.projection.TagUsageSnapshot;
import org.openmetadata.service.projection.TagUsageSnapshotStore;
import org.openmetadata.service.util.FullyQualifiedName;

final class TagUsageCaptureFixture implements AutoCloseable {
  private final RdfTestDatabase database;
  private final ProjectionJournal journal;
  private final TagUsageSnapshotStore snapshots;

  TagUsageCaptureFixture(final RdfTestDatabase.Backend backend) {
    this(backend, true);
  }

  TagUsageCaptureFixture(final RdfTestDatabase.Backend backend, final boolean capture) {
    database = new RdfTestDatabase(backend);
    database.applyProjectionMigrations();
    database.applyProjectionMigrations();
    final Jdbi jdbi = database.jdbi();
    final boolean mysql = backend == RdfTestDatabase.Backend.MYSQL;
    journal = new ProjectionJournal(jdbi, Clock.systemUTC(), EnumSet.allOf(ProjectionTarget.class));
    snapshots = new TagUsageSnapshotStore(jdbi, journal);
    jdbi.installPlugin(new SqlObjectPlugin());
    jdbi.installPlugin(new ProjectionCapturePlugin());
    jdbi.getConfig(SqlObjects.class)
        .setSqlLocator(
            new ConnectionAwareAnnotationSqlLocator(
                mysql ? "com.mysql.cj.jdbc.Driver" : "org.postgresql.Driver"));
    if (capture) {
      jdbi.getConfig(HandlerDecorators.class)
          .register(
              new TagUsageMutationCapture(
                  snapshots, mysql ? ConnectionType.MYSQL : ConnectionType.POSTGRES));
    }
    ProjectionTestSchema.create(jdbi, backend, "tag_usage");
  }

  Jdbi jdbi() {
    return database.jdbi();
  }

  TagUsageDAO dao() {
    return jdbi().onDemand(TagUsageDAO.class);
  }

  ProjectionJournal journal() {
    return journal;
  }

  TagUsageSnapshotStore snapshots() {
    return snapshots;
  }

  List<ProjectionJournal.Claim> claims() {
    return journal.claim(ProjectionTarget.SEARCH, 100, Duration.ofSeconds(30));
  }

  List<TagUsageSnapshot> retained() {
    return claims().stream()
        .flatMap(claim -> snapshots.page(claim.id(), 0, 1000).stream())
        .toList();
  }

  static TagLabel label(final int source, final String fqn) {
    return new TagLabel()
        .withSource(TagLabel.TagSource.values()[source])
        .withTagFQN(fqn)
        .withLabelType(TagLabel.LabelType.MANUAL)
        .withState(TagLabel.State.CONFIRMED);
  }

  void seed(final int source, final String tag, final String target) {
    jdbi()
        .useHandle(
            handle ->
                handle.execute(
                    "INSERT INTO tag_usage(source, tagFQN, tagFQNHash, targetFQNHash, labelType, state) VALUES (?, ?, ?, ?, 0, 1)",
                    source,
                    tag,
                    FullyQualifiedName.buildHash(tag),
                    FullyQualifiedName.buildHash(target)));
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
              handle.execute("DELETE FROM metadata_projection_tag_usage");
              handle.execute("DELETE FROM metadata_projection_consumer");
              handle.execute("DELETE FROM metadata_projection_mutation");
              handle.execute("DELETE FROM tag_usage");
            });
  }

  @Override
  public void close() {
    database.close();
  }
}

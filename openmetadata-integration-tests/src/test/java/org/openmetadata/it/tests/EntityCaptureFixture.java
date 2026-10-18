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
import java.util.List;
import java.util.Map;
import org.jdbi.v3.core.Jdbi;
import org.jdbi.v3.core.statement.SqlStatements;
import org.jdbi.v3.sqlobject.CreateSqlObject;
import org.jdbi.v3.sqlobject.HandlerDecorators;
import org.jdbi.v3.sqlobject.SqlObjectPlugin;
import org.jdbi.v3.sqlobject.SqlObjects;
import org.jdbi.v3.sqlobject.transaction.Transactional;
import org.openmetadata.schema.entity.data.Chart;
import org.openmetadata.schema.entity.data.Container;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.EntityDataDAOs.ChartDAO;
import org.openmetadata.service.jdbi3.locator.ConnectionAwareAnnotationSqlLocator;
import org.openmetadata.service.jdbi3.locator.ConnectionType;
import org.openmetadata.service.projection.EntityMutationCapture;
import org.openmetadata.service.projection.FieldRelationshipMutationCapture;
import org.openmetadata.service.projection.FieldRelationshipSnapshotStore;
import org.openmetadata.service.projection.ProjectionCapturePlugin;
import org.openmetadata.service.projection.ProjectionJournal;
import org.openmetadata.service.projection.ProjectionTarget;
import org.openmetadata.service.projection.RelationshipMutationCapture;
import org.openmetadata.service.projection.RelationshipSnapshotStore;
import org.openmetadata.service.projection.TagUsageMutationCapture;
import org.openmetadata.service.projection.TagUsageSnapshotStore;

/** Real inherited EntityDAO writes on an isolated database using the shared backend containers. */
final class EntityCaptureFixture implements AutoCloseable {
  private final RdfTestDatabase database;
  private final ProjectionJournal journal;

  EntityCaptureFixture(final RdfTestDatabase.Backend backend) {
    this(backend, true);
  }

  EntityCaptureFixture(final RdfTestDatabase.Backend backend, final boolean capture) {
    database = new RdfTestDatabase(backend);
    database.applyProjectionMigrations();
    final Jdbi jdbi = database.jdbi();
    journal = new ProjectionJournal(jdbi, Clock.systemUTC(), EnumSet.allOf(ProjectionTarget.class));
    final boolean mysql = backend == RdfTestDatabase.Backend.MYSQL;
    jdbi.installPlugin(new SqlObjectPlugin()).installPlugin(new ProjectionCapturePlugin());
    jdbi.getConfig(SqlObjects.class)
        .setSqlLocator(
            new ConnectionAwareAnnotationSqlLocator(
                mysql ? "com.mysql.cj.jdbc.Driver" : "org.postgresql.Driver"));
    jdbi.getConfig(SqlStatements.class).setUnusedBindingAllowed(true);
    if (capture) {
      jdbi.getConfig(HandlerDecorators.class)
          .register(
              new EntityMutationCapture(
                  journal,
                  mysql ? ConnectionType.MYSQL : ConnectionType.POSTGRES,
                  Map.<Class<?>, String>of(Chart.class, "chart", Container.class, "container")
                      ::get));
    }
    createSource(mysql);
  }

  void captureMembership(final RdfTestDatabase.Backend backend) {
    for (final String table : List.of("entity_relationship", "tag_usage", "field_relationship")) {
      ProjectionTestSchema.create(jdbi(), backend, table);
    }
    final ConnectionType dialect = ConnectionType.valueOf(backend.name());
    final HandlerDecorators decorators = jdbi().getConfig(HandlerDecorators.class);
    decorators.register(
        new RelationshipMutationCapture(
            new RelationshipSnapshotStore(jdbi(), journal, dialect), dialect));
    decorators.register(
        new TagUsageMutationCapture(new TagUsageSnapshotStore(jdbi(), journal), dialect));
    decorators.register(
        new FieldRelationshipMutationCapture(
            new FieldRelationshipSnapshotStore(jdbi(), journal), dialect));
  }

  private void createSource(final boolean mysql) {
    final String identifier = mysql ? "JSON_UNQUOTE(JSON_EXTRACT(json, '$.id'))" : "json->>'id'";
    jdbi()
        .useHandle(
            handle ->
                handle.execute(
                    "CREATE TABLE projection_test_entity (json "
                        + (mysql ? "JSON" : "JSONB")
                        + " NOT NULL, id VARCHAR(36) GENERATED ALWAYS AS ("
                        + identifier
                        + ") STORED PRIMARY KEY, fqnHash VARCHAR(768) NOT NULL)"));
  }

  Jdbi jdbi() {
    return database.jdbi();
  }

  @Override
  public void close() {
    database.close();
  }

  public interface CaptureRoot extends Transactional<CaptureRoot> {
    @CreateSqlObject
    CaptureDAO charts();
  }

  public interface CaptureCollection extends CollectionDAO {
    @Override
    @CreateSqlObject
    CaptureDAO chartDAO();
  }

  public interface CaptureDAO extends ChartDAO {
    @Override
    default String getTableName() {
      return "projection_test_entity";
    }

    @Override
    default String getNameHashColumn() {
      return "fqnHash";
    }

    @Override
    default Class<Chart> getEntityClass() {
      return Chart.class;
    }
  }
}

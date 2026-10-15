/*
 *  Copyright 2024 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 */

package org.openmetadata.service.projection;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;

import java.time.Clock;
import java.util.EnumSet;
import org.jdbi.v3.core.Jdbi;
import org.jdbi.v3.sqlobject.Handler;
import org.jdbi.v3.sqlobject.HandlerDecorator;
import org.jdbi.v3.sqlobject.statement.SqlBatch;
import org.jdbi.v3.sqlobject.statement.SqlQuery;
import org.jdbi.v3.sqlobject.statement.SqlUpdate;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.service.jdbi3.ClassificationTagDAOs.TagUsageDAO;
import org.openmetadata.service.jdbi3.CoreRelationshipDAOs.EntityRelationshipDAO;
import org.openmetadata.service.jdbi3.CoreRelationshipDAOs.FieldRelationshipDAO;
import org.openmetadata.service.jdbi3.EntityDAO;
import org.openmetadata.service.jdbi3.EntityDataDAOs.MetricDAO;
import org.openmetadata.service.jdbi3.FqnPrefixRewrite;
import org.openmetadata.service.jdbi3.locator.ConnectionType;

class CaptureWritePolicyTest {
  private final Jdbi jdbi = Jdbi.create("jdbc:unused");
  private final ProjectionJournal journal =
      new ProjectionJournal(jdbi, Clock.systemUTC(), EnumSet.allOf(ProjectionTarget.class));

  @Test
  void unknownBatchesAndOverridesFailBeforeExecutingTheSource() throws Exception {
    rejects(
        new EntityMutationCapture(journal, ConnectionType.MYSQL, type -> "table"),
        NewEntityWrites.class,
        "batch");
    rejects(
        new RelationshipMutationCapture(
            new RelationshipSnapshotStore(jdbi, journal, ConnectionType.MYSQL),
            ConnectionType.MYSQL),
        NewRelationshipWrites.class,
        "batch");
    rejects(
        new TagUsageMutationCapture(new TagUsageSnapshotStore(jdbi, journal), ConnectionType.MYSQL),
        NewTagWrites.class,
        "batch");
    rejects(
        new FieldRelationshipMutationCapture(
            new FieldRelationshipSnapshotStore(jdbi, journal), ConnectionType.MYSQL),
        NewFieldWrites.class,
        "batch");
  }

  @Test
  void overriddenEntityPrefixRewritesFailClosed() throws Exception {
    rejects(
        new EntityMutationCapture(journal, ConnectionType.MYSQL, type -> "table"),
        NewEntityWrites.class,
        "updateFqnInternal",
        String.class,
        FqnPrefixRewrite.class);
  }

  @Test
  void queriesWithDataChangingCtesFailBeforeExecutingTheSource() throws Exception {
    rejects(
        new EntityMutationCapture(journal, ConnectionType.POSTGRES, type -> "table"),
        NewEntityWrites.class,
        "deleteReturning");
  }

  @Test
  void reviewedMetricHierarchyQueriesRemainReadable() throws Exception {
    assertFalse(
        CaptureWritePolicy.isWrite(
            MetricDAO.class.getMethod(
                "listHierarchy", int.class, int.class, String.class, int.class, int.class)));
    assertFalse(
        CaptureWritePolicy.isWrite(
            MetricDAO.class.getMethod("countHierarchy", int.class, int.class, String.class)));
  }

  private static void rejects(
      final HandlerDecorator capture,
      final Class<?> dao,
      final String name,
      final Class<?>... parameters)
      throws Exception {
    final Handler source =
        (target, arguments, supplier) -> {
          throw new AssertionError("uncaptured source write executed");
        };
    final Handler decorated = capture.decorateHandler(source, dao, dao.getMethod(name, parameters));
    assertThrows(
        UnsupportedOperationException.class,
        () -> decorated.invoke((Object) null, new Object[parameters.length], null));
  }

  interface NewEntityWrites extends EntityDAO<Table> {
    @Override
    @SqlUpdate("UPDATE table_entity SET fqnHash = 'unreviewed'")
    void updateFqnInternal(String table, FqnPrefixRewrite prefix);

    @SqlBatch("DELETE FROM table_entity")
    void batch();

    @SqlQuery("WITH removed AS (DELETE FROM table_entity RETURNING id) SELECT id FROM removed")
    String deleteReturning();
  }

  interface NewRelationshipWrites extends EntityRelationshipDAO {
    @SqlBatch("DELETE FROM entity_relationship")
    void batch();
  }

  interface NewTagWrites extends TagUsageDAO {
    @SqlBatch("DELETE FROM tag_usage")
    void batch();
  }

  interface NewFieldWrites extends FieldRelationshipDAO {
    @SqlBatch("DELETE FROM field_relationship")
    void batch();
  }
}

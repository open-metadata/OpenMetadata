/*
 *  Copyright 2025 Collate
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

import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.bootstrap.SharedEntities;
import org.openmetadata.it.bootstrap.TestSuiteBootstrap;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.data.CreateDatabase;
import org.openmetadata.schema.api.data.CreateDatabaseSchema;
import org.openmetadata.schema.api.data.CreateTable;
import org.openmetadata.schema.entity.data.Database;
import org.openmetadata.schema.entity.data.DatabaseSchema;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.ColumnDataType;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.CollectionDAO.EntityRelationshipObject;
import org.openmetadata.service.util.EntityRelationshipCleanup;

/**
 * End-to-end test for the rewritten {@link EntityRelationshipCleanup} used by the Data Retention
 * app. It seeds many orphaned relationship rows (both endpoints missing) scattered across the
 * {@code entity_relationship} table and runs the cleanup with a small batch size, forcing the
 * keyset pagination to page repeatedly while deleting orphans mid-scan. Asserts that every seeded
 * orphan is removed (no rows skipped by the seek cursor) and that a healthy table's real
 * relationships are left untouched.
 */
@Execution(ExecutionMode.SAME_THREAD)
@ExtendWith(TestNamespaceExtension.class)
public class EntityRelationshipCleanupIT {

  private static final int SEEDED_ORPHANS = 60;

  @Test
  void actualCleanup_deletesScatteredOrphans_keepsValidRelationships(TestNamespace ns)
      throws Exception {
    Table table = createTable(ns);
    int validIncomingBefore = incomingRelationshipCount(table.getId());
    assertTrue(validIncomingBefore >= 1, "healthy table must have real incoming relationships");

    String marker = "ITORPHAN_" + ns.uniqueShortId();
    seedOrphans(marker, SEEDED_ORPHANS);
    assertEquals(SEEDED_ORPHANS, orphanCount(marker), "seeded orphans must be present before run");

    // Small batch forces multiple keyset pages with deletes happening between pages.
    EntityRelationshipCleanup.EntityCleanupResult result =
        new EntityRelationshipCleanup(Entity.getCollectionDAO(), false).performCleanup(25);

    assertTrue(
        result.getOrphanedRelationshipsFound() >= SEEDED_ORPHANS,
        "cleanup must find at least the seeded orphans");
    assertEquals(
        0,
        orphanCount(marker),
        "every seeded orphan must be deleted - keyset paging must not skip rows across deletes");
    assertEquals(
        validIncomingBefore,
        incomingRelationshipCount(table.getId()),
        "valid relationships of a healthy table must survive the cleanup");
  }

  @Test
  void dryRun_reportsOrphansButDeletesNothing(TestNamespace ns) {
    String marker = "ITDRYRUN_" + ns.uniqueShortId();
    try {
      seedOrphans(marker, SEEDED_ORPHANS);

      EntityRelationshipCleanup.EntityCleanupResult result =
          new EntityRelationshipCleanup(Entity.getCollectionDAO(), true).performCleanup(25);

      assertTrue(
          result.getOrphanedRelationshipsFound() >= SEEDED_ORPHANS,
          "dry run must still detect the seeded orphans");
      assertEquals(0, result.getRelationshipsDeleted(), "dry run must not delete anything");
      assertEquals(SEEDED_ORPHANS, orphanCount(marker), "dry run must leave seeded orphans intact");
    } finally {
      deleteOrphans(marker);
    }
  }

  /**
   * Regression test for the keyset cursor. Two rows share the same (fromId, toId, relation) tuple
   * and differ only in relationType - exactly how glossary-term RELATED_TO rows carry 'synonym' and
   * 'seeAlso'. With a batch boundary (limit=1) falling between them, a cursor keyed only on
   * (fromId, toId, relation) would advance past the tuple and permanently skip the second row. The
   * full-primary-key cursor must return both.
   */
  @Test
  void keysetPaging_doesNotSkipRowsSharingTupleButDifferentRelationType(TestNamespace ns) {
    String fromId = UUID.randomUUID().toString();
    String toId = UUID.randomUUID().toString();
    int relation = Relationship.RELATED_TO.ordinal();
    try {
      insertOrphan(fromId, toId, Entity.GLOSSARY_TERM, Entity.GLOSSARY_TERM, relation, "seeAlso");
      insertOrphan(fromId, toId, Entity.GLOSSARY_TERM, Entity.GLOSSARY_TERM, relation, "synonym");

      CollectionDAO.EntityRelationshipDAO dao = Entity.getCollectionDAO().relationshipDAO();

      List<EntityRelationshipObject> page1 =
          dao.getAllRelationshipsAfter(fromId, toId, relation, "", 1);
      assertEquals(1, page1.size(), "first page must return one row");
      assertEquals(fromId, page1.getFirst().getFromId());
      assertEquals("seeAlso", page1.getFirst().getRelationType());

      List<EntityRelationshipObject> page2 =
          dao.getAllRelationshipsAfter(fromId, toId, relation, "seeAlso", 1);
      assertTrue(
          page2.stream().anyMatch(r -> "synonym".equals(r.getRelationType())),
          "the sibling row sharing the (fromId,toId,relation) tuple must not be skipped");
    } finally {
      deleteByFromId(fromId);
    }
  }

  private Table createTable(TestNamespace ns) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();
    String id = ns.uniqueShortId();
    Database database =
        client
            .databases()
            .create(
                new CreateDatabase()
                    .withName("erCleanupDb_" + id)
                    .withService(SharedEntities.get().MYSQL_SERVICE.getFullyQualifiedName()));
    DatabaseSchema schema =
        client
            .databaseSchemas()
            .create(
                new CreateDatabaseSchema()
                    .withName("erCleanupSc_" + id)
                    .withDatabase(database.getFullyQualifiedName()));
    return client
        .tables()
        .create(
            new CreateTable()
                .withName("erCleanupTb_" + id)
                .withDatabaseSchema(schema.getFullyQualifiedName())
                .withColumns(
                    List.of(new Column().withName("id").withDataType(ColumnDataType.BIGINT))));
  }

  private void seedOrphans(String marker, int count) {
    for (int i = 0; i < count; i++) {
      insertOrphan(
          UUID.randomUUID().toString(),
          UUID.randomUUID().toString(),
          Entity.DATABASE_SCHEMA,
          Entity.TABLE,
          Relationship.CONTAINS.ordinal(),
          marker);
    }
  }

  private void insertOrphan(
      String fromId, String toId, String fromEntity, String toEntity, int relation, String marker) {
    TestSuiteBootstrap.getJdbi()
        .useHandle(
            handle ->
                handle
                    .createUpdate(
                        "INSERT INTO entity_relationship "
                            + "(fromId, toId, fromEntity, toEntity, relation, relationType) "
                            + "VALUES (:fromId, :toId, :fromEntity, :toEntity, :relation, :relationType)")
                    .bind("fromId", fromId)
                    .bind("toId", toId)
                    .bind("fromEntity", fromEntity)
                    .bind("toEntity", toEntity)
                    .bind("relation", relation)
                    .bind("relationType", marker)
                    .execute());
  }

  private void deleteOrphans(String marker) {
    TestSuiteBootstrap.getJdbi()
        .useHandle(
            handle ->
                handle
                    .createUpdate("DELETE FROM entity_relationship WHERE relationType = :m")
                    .bind("m", marker)
                    .execute());
  }

  private void deleteByFromId(String fromId) {
    TestSuiteBootstrap.getJdbi()
        .useHandle(
            handle ->
                handle
                    .createUpdate("DELETE FROM entity_relationship WHERE fromId = :f")
                    .bind("f", fromId)
                    .execute());
  }

  private int orphanCount(String marker) {
    return TestSuiteBootstrap.getJdbi()
        .withHandle(
            handle ->
                handle
                    .createQuery("SELECT COUNT(*) FROM entity_relationship WHERE relationType = :m")
                    .bind("m", marker)
                    .mapTo(Integer.class)
                    .one());
  }

  private int incomingRelationshipCount(UUID toId) {
    return TestSuiteBootstrap.getJdbi()
        .withHandle(
            handle ->
                handle
                    .createQuery("SELECT COUNT(*) FROM entity_relationship WHERE toId = :t")
                    .bind("t", toId.toString())
                    .mapTo(Integer.class)
                    .one());
  }
}

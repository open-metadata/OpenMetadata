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
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.time.Duration;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.awaitility.Awaitility;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.openmetadata.it.factories.DatabaseSchemaTestFactory;
import org.openmetadata.it.factories.DatabaseServiceTestFactory;
import org.openmetadata.it.factories.DatabaseTestFactory;
import org.openmetadata.it.factories.GlossaryTermTestFactory;
import org.openmetadata.it.factories.GlossaryTestFactory;
import org.openmetadata.it.factories.TableTestFactory;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.entity.data.Database;
import org.openmetadata.schema.entity.data.DatabaseSchema;
import org.openmetadata.schema.entity.data.Glossary;
import org.openmetadata.schema.entity.data.GlossaryTerm;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.services.DatabaseService;
import org.openmetadata.schema.tests.TestCase;
import org.openmetadata.schema.tests.TestSuite;
import org.openmetadata.schema.type.Include;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.fluent.Databases;
import org.openmetadata.sdk.fluent.builders.TestCaseBuilder;
import org.openmetadata.sdk.models.AsyncJobResponse;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.CollectionDAO;

/**
 * End-to-end tests for the bulk + async restore + bulk hard-delete paths introduced for
 * issue #4003 and #4004.
 *
 * <p>Builds a small Database → DatabaseSchemas → Tables hierarchy, soft-deletes the database
 * (which cascades), then verifies that:
 *
 * <ul>
 *   <li>The synchronous bulk restore path restores the entire subtree in a single PUT call.
 *   <li>The async restore path returns 202 with a job id and produces the same final state once
 *       the background work completes.
 *   <li>The recursive hard-delete on a CONTAINS-shaped service hierarchy wipes every row and
 *       every entity_relationship reference in one bulk transaction per type.
 *   <li>The recursive hard-delete on a Glossary → GlossaryTerm hierarchy descends via the
 *       PARENT_OF relation — confirming the bulk path's relation set covers more than just
 *       CONTAINS.
 * </ul>
 */
@ExtendWith(TestNamespaceExtension.class)
public class RestoreHierarchyIT {

  private static final int SCHEMA_COUNT = 3;
  private static final int TABLES_PER_SCHEMA = 4;

  @BeforeAll
  static void setup() {
    SdkClients.adminClient();
  }

  @Test
  void syncRestore_restoresFullHierarchy(TestNamespace ns) {
    Hierarchy h = createHierarchy(ns, "sync");
    softDeleteAndAssertCascade(h);

    Database restored = Databases.find(h.database.getId().toString()).restore().execute();
    assertNotNull(restored);
    assertFalse(Boolean.TRUE.equals(restored.getDeleted()));

    assertHierarchyRestored(h);
  }

  @Test
  void recursiveSoftDelete_marksFullSubtreeDeletedInOnePassPerType(TestNamespace ns) {
    Hierarchy h = createHierarchy(ns, "softdel");
    Map<String, String> recursiveDelete = new HashMap<>();
    recursiveDelete.put("recursive", "true");
    SdkClients.adminClient().databases().delete(h.database.getId().toString(), recursiveDelete);

    OpenMetadataClient client = SdkClients.adminClient();
    Database deletedDb =
        client.databases().get(h.database.getId().toString(), "deleted", Include.ALL.value());
    assertTrue(Boolean.TRUE.equals(deletedDb.getDeleted()));

    for (DatabaseSchema schema : h.schemas) {
      DatabaseSchema fetched =
          client.databaseSchemas().get(schema.getId().toString(), "deleted", Include.ALL.value());
      assertTrue(
          Boolean.TRUE.equals(fetched.getDeleted()),
          "schema " + schema.getName() + " was not soft-deleted via the bulk cascade");
    }
    for (Table table : h.tables) {
      Table fetched = client.tables().get(table.getId().toString(), "deleted", Include.ALL.value());
      assertTrue(
          Boolean.TRUE.equals(fetched.getDeleted()),
          "table " + table.getName() + " was not soft-deleted via the bulk cascade");
    }
  }

  @Test
  void asyncRestore_returns202AndRestoresFullHierarchy(TestNamespace ns) {
    Hierarchy h = createHierarchy(ns, "async");
    softDeleteAndAssertCascade(h);

    AsyncJobResponse job =
        Databases.find(h.database.getId().toString()).restore().async().execute();
    assertNotNull(job);
    assertNotNull(job.getJobId());
    assertEquals("Restore initiated successfully.", job.getMessage());

    // Async work runs on the server's executor — poll for completion.
    Awaitility.await("async restore for " + h.database.getFullyQualifiedName())
        .atMost(Duration.ofSeconds(60))
        .pollInterval(Duration.ofSeconds(1))
        .ignoreExceptions()
        .until(
            () -> {
              Database current = SdkClients.adminClient().databases().get(h.database.getId());
              return !Boolean.TRUE.equals(current.getDeleted());
            });

    assertHierarchyRestored(h);
  }

  /**
   * A table's basic test suite is soft-deleted one level below the table, before the table level
   * re-indexes its tables. Reading the suite as live there turned a recursive soft delete of the
   * database into a 404 for the suite.
   */
  @Test
  void recursiveSoftDeleteAndRestore_ofADatabaseWhoseTableHasATestCase(TestNamespace ns) {
    Hierarchy h = createShortNamedHierarchy(ns, "dbtc");
    TestCase testCase = createTestCase(ns, h.tables.get(0));

    softDeleteAndAssertCascade(h);
    assertTestCaseDeleted(testCase, true);

    Databases.find(h.database.getId().toString()).restore().execute();

    assertHierarchyRestored(h);
    assertTestCaseDeleted(testCase, false);
  }

  @Test
  void recursiveSoftDeleteAndRestore_ofASchemaWhoseTableHasATestCase(TestNamespace ns) {
    Hierarchy h = createShortNamedHierarchy(ns, "schtc");
    DatabaseSchema schema = h.schemas.get(0);
    Table table = h.tables.get(0);
    TestCase testCase = createTestCase(ns, table);
    OpenMetadataClient client = SdkClients.adminClient();

    client.databaseSchemas().delete(schema.getId().toString(), Map.of("recursive", "true"));
    Table deleted = client.tables().get(table.getId().toString(), "deleted", Include.ALL.value());
    assertTrue(Boolean.TRUE.equals(deleted.getDeleted()), "the schema's table was not deleted");
    assertTestCaseDeleted(testCase, true);

    client.databaseSchemas().restore(schema.getId());

    Table restored = client.tables().get(table.getId().toString());
    assertFalse(Boolean.TRUE.equals(restored.getDeleted()), "the schema's table was not restored");
    assertTestCaseDeleted(testCase, false);
  }

  private static TestCase createTestCase(TestNamespace ns, Table table) {
    return TestCaseBuilder.create(SdkClients.adminClient())
        .name(ns.shortPrefix("column_count"))
        .forTable(table)
        .testDefinition("tableColumnCountToEqual")
        .parameter("columnCount", "2")
        .create();
  }

  private static void assertTestCaseDeleted(TestCase testCase, boolean deleted) {
    OpenMetadataClient client = SdkClients.adminClient();
    TestCase fetched =
        client.testCases().get(testCase.getId().toString(), "testSuite", Include.ALL.value());
    assertEquals(deleted, Boolean.TRUE.equals(fetched.getDeleted()), "test case deleted flag");
    TestSuite suite =
        client
            .testSuites()
            .get(testCase.getTestSuite().getId().toString(), "deleted", Include.ALL.value());
    assertEquals(deleted, Boolean.TRUE.equals(suite.getDeleted()), "basic test suite deleted flag");
  }

  @Test
  void hardDelete_databaseService_cascadesEntireSubtreeAndLeavesNoOrphanRelationships(
      TestNamespace ns) {
    Hierarchy h = createHierarchy(ns, "harddel");

    Map<String, String> params = new HashMap<>();
    params.put("recursive", "true");
    params.put("hardDelete", "true");
    SdkClients.adminClient().databaseServices().delete(h.service.getId().toString(), params);

    OpenMetadataClient client = SdkClients.adminClient();
    assertThrows(
        Exception.class,
        () -> client.databaseServices().get(h.service.getId().toString()),
        "database service must be hard-deleted");
    assertThrows(
        Exception.class,
        () -> client.databases().get(h.database.getId().toString()),
        "database must be hard-deleted");
    for (DatabaseSchema schema : h.schemas) {
      assertThrows(
          Exception.class,
          () -> client.databaseSchemas().get(schema.getId().toString()),
          "schema must be hard-deleted: " + schema.getName());
    }
    for (Table table : h.tables) {
      assertThrows(
          Exception.class,
          () -> client.tables().get(table.getId().toString()),
          "table must be hard-deleted: " + table.getName());
    }

    List<String> allDeletedIds = new ArrayList<>();
    allDeletedIds.add(h.service.getId().toString());
    allDeletedIds.add(h.database.getId().toString());
    for (DatabaseSchema schema : h.schemas) {
      allDeletedIds.add(schema.getId().toString());
    }
    for (Table table : h.tables) {
      allDeletedIds.add(table.getId().toString());
    }
    assertNoOrphanRelationships(allDeletedIds);
  }

  @Test
  void hardDelete_glossary_cascadesRecursiveTermsViaParentOf(TestNamespace ns) {
    Glossary glossary = GlossaryTestFactory.createWithName(ns, "harddel_glossary");
    GlossaryTerm parent = GlossaryTermTestFactory.createWithName(ns, glossary, "parent_term");
    GlossaryTerm child = GlossaryTermTestFactory.createChild(ns, glossary, parent, "child_term");
    GlossaryTerm grandchild =
        GlossaryTermTestFactory.createChild(ns, glossary, child, "grandchild_term");

    Map<String, String> params = new HashMap<>();
    params.put("recursive", "true");
    params.put("hardDelete", "true");
    SdkClients.adminClient().glossaries().delete(glossary.getId().toString(), params);

    OpenMetadataClient client = SdkClients.adminClient();
    assertThrows(
        Exception.class,
        () -> client.glossaries().get(glossary.getId().toString()),
        "glossary must be hard-deleted");
    for (GlossaryTerm term : List.of(parent, child, grandchild)) {
      assertThrows(
          Exception.class,
          () -> client.glossaryTerms().get(term.getId().toString()),
          "glossary term must be hard-deleted via PARENT_OF cascade: " + term.getName());
    }

    assertNoOrphanRelationships(
        List.of(
            glossary.getId().toString(),
            parent.getId().toString(),
            child.getId().toString(),
            grandchild.getId().toString()));
  }

  private void assertNoOrphanRelationships(List<String> deletedIds) {
    CollectionDAO.EntityRelationshipDAO relationshipDAO =
        Entity.getCollectionDAO().relationshipDAO();
    List<Integer> hierarchyRelations =
        List.of(
            org.openmetadata.schema.type.Relationship.CONTAINS.ordinal(),
            org.openmetadata.schema.type.Relationship.PARENT_OF.ordinal(),
            org.openmetadata.schema.type.Relationship.HAS.ordinal());
    List<CollectionDAO.EntityRelationshipObject> outgoing =
        relationshipDAO.findToBatchAllTypes(deletedIds, hierarchyRelations, Include.ALL);
    assertTrue(
        outgoing == null || outgoing.isEmpty(),
        "No outgoing entity_relationship rows must reference deleted ids — found "
            + (outgoing == null ? 0 : outgoing.size()));
    for (Integer relation : hierarchyRelations) {
      List<CollectionDAO.EntityRelationshipObject> incoming =
          relationshipDAO.findFromBatch(deletedIds, relation, Include.ALL);
      assertTrue(
          incoming == null || incoming.isEmpty(),
          "No incoming entity_relationship rows must reference deleted ids "
              + "(relation="
              + relation
              + ") — found "
              + (incoming == null ? 0 : incoming.size()));
    }
  }

  private static class Hierarchy {
    DatabaseService service;
    Database database;
    List<DatabaseSchema> schemas;
    List<Table> tables;

    Hierarchy(
        DatabaseService service,
        Database database,
        List<DatabaseSchema> schemas,
        List<Table> tables) {
      this.service = service;
      this.database = database;
      this.schemas = schemas;
      this.tables = tables;
    }
  }

  private Hierarchy createHierarchy(TestNamespace ns, String tag) {
    DatabaseService service = DatabaseServiceTestFactory.create(ns, "Postgres");
    Database database = DatabaseTestFactory.create(ns, service.getFullyQualifiedName());
    return createHierarchy(ns, tag, service, database);
  }

  /** Short names keep the FQN of a table's basic test suite within the column limit. */
  private Hierarchy createShortNamedHierarchy(TestNamespace ns, String tag) {
    DatabaseService service =
        DatabaseServiceTestFactory.createPostgresWithName(ns.shortPrefix(tag + "_svc"), ns);
    Database database =
        DatabaseTestFactory.createWithName(
            service.getFullyQualifiedName(), ns.shortPrefix(tag + "_db"));
    return createHierarchy(ns, tag, service, database);
  }

  private Hierarchy createHierarchy(
      TestNamespace ns, String tag, DatabaseService service, Database database) {
    List<DatabaseSchema> schemas = new java.util.ArrayList<>();
    List<Table> tables = new java.util.ArrayList<>();
    for (int s = 0; s < SCHEMA_COUNT; s++) {
      DatabaseSchema schema =
          DatabaseSchemaTestFactory.create(database.getFullyQualifiedName(), tag + "_schema_" + s);
      schemas.add(schema);
      for (int t = 0; t < TABLES_PER_SCHEMA; t++) {
        tables.add(
            TableTestFactory.createSimpleWithName(
                tag + "_table_" + s + "_" + t, ns, schema.getFullyQualifiedName()));
      }
    }
    return new Hierarchy(service, database, schemas, tables);
  }

  private void softDeleteAndAssertCascade(Hierarchy h) {
    Map<String, String> recursiveDelete = new HashMap<>();
    recursiveDelete.put("recursive", "true");
    SdkClients.adminClient().databases().delete(h.database.getId().toString(), recursiveDelete);

    OpenMetadataClient client = SdkClients.adminClient();
    Database deletedDb =
        client.databases().get(h.database.getId().toString(), "deleted", Include.ALL.value());
    assertTrue(Boolean.TRUE.equals(deletedDb.getDeleted()), "database should be soft-deleted");

    for (DatabaseSchema schema : h.schemas) {
      DatabaseSchema fetched =
          client.databaseSchemas().get(schema.getId().toString(), "deleted", Include.ALL.value());
      assertTrue(Boolean.TRUE.equals(fetched.getDeleted()), "schema cascade delete failed");
    }
    for (Table table : h.tables) {
      Table fetched = client.tables().get(table.getId().toString(), "deleted", Include.ALL.value());
      assertTrue(Boolean.TRUE.equals(fetched.getDeleted()), "table cascade delete failed");
    }
  }

  private void assertHierarchyRestored(Hierarchy h) {
    OpenMetadataClient client = SdkClients.adminClient();
    Database fetchedDb = client.databases().get(h.database.getId().toString());
    assertFalse(Boolean.TRUE.equals(fetchedDb.getDeleted()), "database not restored");

    for (DatabaseSchema schema : h.schemas) {
      DatabaseSchema fetched = client.databaseSchemas().get(schema.getId().toString());
      assertFalse(Boolean.TRUE.equals(fetched.getDeleted()), "schema not restored");
    }
    for (Table table : h.tables) {
      Table fetched = client.tables().get(table.getId().toString());
      assertFalse(Boolean.TRUE.equals(fetched.getDeleted()), "table not restored");
    }
  }
}

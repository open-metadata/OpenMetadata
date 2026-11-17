package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.openmetadata.service.jdbi3.FolderRepository.FOLDER_ENTITY;

import java.util.List;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.bootstrap.TestSuiteBootstrap;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.data.CreateFolder;
import org.openmetadata.schema.entity.data.Folder;
import org.openmetadata.sdk.network.HttpMethod;
import org.openmetadata.service.migration.utils.EntityFqnHolders;
import org.openmetadata.service.migration.utils.EntityFqnHolders.EntityTable;
import org.openmetadata.service.migration.utils.EntityFqnHolders.Holder;

/**
 * A migration runs while every entity type of the running build is registered, but before the
 * tables a later migration creates exist: a Collate server registers its 2.1.0 entity types while
 * OpenMetadata's 2.1.0 migration runs.
 */
@Execution(ExecutionMode.CONCURRENT)
@ExtendWith(TestNamespaceExtension.class)
class EntityFqnHoldersIT {
  private static final String FOLDERS = "/v1/contextCenter/drive/folders";
  private static final String NOT_CREATED_YET = "notCreatedYet";

  @Test
  void aTableALaterMigrationCreatesHoldsNoEntity(TestNamespace ns) {
    Folder folder = createRootFolder(ns.shortPrefix("Finance"));
    // The missing table first: a failed query must not break the lookups after it.
    List<EntityTable> tables =
        List.of(
            new EntityTable(NOT_CREATED_YET, "not_created_yet_entity", "nameHash"), folderTable());

    List<Holder> holders = holding(tables, folder.getFullyQualifiedName());

    assertEquals(List.of(FOLDER_ENTITY + " " + folder.getId()), descriptions(holders));
  }

  @Test
  void aTableThatExistsButCannotBeSearchedIsReported(TestNamespace ns) {
    Folder folder = createRootFolder(ns.shortPrefix("Finance"));
    EntityTable folderTable = folderTable();
    List<EntityTable> tables =
        List.of(
            folderTable,
            new EntityTable(NOT_CREATED_YET, folderTable.tableName(), "noSuchNameHashColumn"));

    List<Holder> holders = holding(tables, folder.getFullyQualifiedName());

    assertEquals(2, holders.size());
    assertEquals(FOLDER_ENTITY + " " + folder.getId(), holders.getFirst().toString());
    assertEquals(NOT_CREATED_YET, holders.getLast().entityType());
    assertNull(holders.getLast().id(), "a failed lookup names no entity");
  }

  @Test
  void anFqnNoEntityHoldsHasNoHolder(TestNamespace ns) {
    assertEquals(List.of(), holding(List.of(folderTable()), ns.shortPrefix("nobody")));
  }

  private static List<Holder> holding(List<EntityTable> tables, String fqn) {
    return TestSuiteBootstrap.getJdbi()
        .withHandle(handle -> EntityFqnHolders.in(handle, tables).holding(fqn));
  }

  private static EntityTable folderTable() {
    return EntityFqnHolders.registeredTables().stream()
        .filter(table -> FOLDER_ENTITY.equals(table.entityType()))
        .findFirst()
        .orElseThrow();
  }

  private static List<String> descriptions(List<Holder> holders) {
    return holders.stream().map(Holder::toString).toList();
  }

  private static Folder createRootFolder(String name) {
    return SdkClients.adminClient()
        .getHttpClient()
        .execute(HttpMethod.POST, FOLDERS, new CreateFolder().withName(name), Folder.class);
  }
}

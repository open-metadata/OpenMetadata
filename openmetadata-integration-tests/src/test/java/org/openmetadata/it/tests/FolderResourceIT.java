package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.time.Duration;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;
import org.awaitility.Awaitility;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.schema.api.data.CreateFolder;
import org.openmetadata.schema.entity.data.Folder;
import org.openmetadata.schema.type.EntityHistory;
import org.openmetadata.sdk.exceptions.ApiException;
import org.openmetadata.sdk.models.ListParams;
import org.openmetadata.sdk.models.ListResponse;
import org.openmetadata.sdk.services.drives.FolderService;

/**
 * Integration tests for Folder entity operations.
 *
 * <p>Folder is a service-less Context Center entity at {@code /v1/contextCenter/drive/folders}. It supports owners,
 * tags, and domains, but does not expose version history, followers, custom extensions, or bulk
 * endpoints (see the {@code supports*} flags below). Extends BaseEntityIT so generic CRUD / tag /
 * domain coverage runs automatically.
 */
@Execution(ExecutionMode.CONCURRENT)
public class FolderResourceIT extends BaseEntityIT<Folder, CreateFolder> {

  {
    supportsFollowers = false;
    supportsDataProducts = false;
    supportsCustomExtension = false;
    supportsBulkAPI = false;
    supportsDataContract = false;
    supportsVersionHistory = false;
    supportsGetByVersion = false;
  }

  // ===================================================================
  // ABSTRACT METHOD IMPLEMENTATIONS (Required by BaseEntityIT)
  // ===================================================================

  @Override
  protected CreateFolder createMinimalRequest(TestNamespace ns) {
    return new CreateFolder()
        .withName(ns.prefix("folder"))
        .withDescription("Test folder created by integration test");
  }

  @Override
  protected CreateFolder createRequest(String name, TestNamespace ns) {
    return new CreateFolder().withName(name);
  }

  @Override
  protected Folder createEntity(CreateFolder createRequest) {
    return getFolderService().create(createRequest);
  }

  @Override
  protected Folder getEntity(String id) {
    return getFolderService().get(id);
  }

  @Override
  protected Folder getEntityByName(String fqn) {
    return getFolderService().getByName(fqn);
  }

  @Override
  protected Folder patchEntity(String id, Folder entity) {
    return getFolderService().update(id, entity);
  }

  @Override
  protected void deleteEntity(String id) {
    getFolderService().delete(id);
  }

  @Override
  protected void restoreEntity(String id) {
    getFolderService().restore(id);
  }

  @Override
  protected void hardDeleteEntity(String id) {
    Map<String, String> params = new HashMap<>();
    params.put("hardDelete", "true");
    getFolderService().delete(id, params);
    // FolderResource hard-delete is asynchronous: it returns 200 immediately and removes
    // the row in the background. Poll with include=deleted until the entity is fully gone
    // (server returns 404) so BaseEntityIT.delete_entityAsAdmin_hardDelete_200 sees the
    // post-condition. Other exceptions (e.g., transient 500s, network errors) must propagate
    // so the test doesn't silently pass on real failures — Awaitility re-polls on throw and
    // surfaces the last exception when the timeout window expires.
    Awaitility.await()
        .pollInterval(Duration.ofMillis(200))
        .atMost(Duration.ofSeconds(15))
        .until(
            () -> {
              try {
                getFolderService().get(id, null, "deleted");
                return false;
              } catch (ApiException e) {
                if (e.getStatusCode() == 404) {
                  return true;
                }
                throw e;
              }
            });
  }

  @Override
  protected String getEntityType() {
    return "folder";
  }

  @Override
  protected void validateCreatedEntity(Folder entity, CreateFolder createRequest) {
    assertEquals(createRequest.getName(), entity.getName());

    if (createRequest.getDescription() != null) {
      assertEquals(createRequest.getDescription(), entity.getDescription());
    }

    assertTrue(
        entity.getFullyQualifiedName().contains(entity.getName()),
        "FQN should contain folder name");
  }

  @Override
  protected ListResponse<Folder> listEntities(ListParams params) {
    return getFolderService().list(params);
  }

  @Override
  protected Folder getEntityWithFields(String id, String fields) {
    return getFolderService().get(id, fields);
  }

  @Override
  protected Folder getEntityByNameWithFields(String fqn, String fields) {
    return getFolderService().getByName(fqn, fields);
  }

  @Override
  protected Folder getEntityIncludeDeleted(String id) {
    return getFolderService().get(id, null, "deleted");
  }

  @Override
  protected EntityHistory getVersionHistory(UUID id) {
    throw new UnsupportedOperationException("Folder does not expose version history");
  }

  @Override
  protected Folder getVersion(UUID id, Double version) {
    throw new UnsupportedOperationException("Folder does not expose individual versions");
  }

  private FolderService getFolderService() {
    return new FolderService(SdkClients.adminClient().getHttpClient());
  }

  // ===================================================================
  // FOLDER-SPECIFIC TESTS
  // ===================================================================

  @Test
  void test_createFolder_minimalRequest(TestNamespace ns) {
    String folderName = ns.prefix("folder_minimal");
    Folder folder = getFolderService().create(new CreateFolder().withName(folderName));

    assertNotNull(folder.getId());
    assertEquals(folderName, folder.getName());
    assertNotNull(folder.getFullyQualifiedName());
  }

  @Test
  void test_createNestedFolder(TestNamespace ns) {
    Folder parent =
        getFolderService()
            .create(
                new CreateFolder()
                    .withName(ns.prefix("parent_folder"))
                    .withDescription("Parent folder"));

    Folder child =
        getFolderService()
            .create(
                new CreateFolder()
                    .withName(ns.prefix("child_folder"))
                    .withParent(parent.getFullyQualifiedName())
                    .withDescription("Child folder"));

    assertNotNull(child.getParent());
    assertEquals(parent.getId(), child.getParent().getId());
    assertTrue(
        child.getFullyQualifiedName().contains(parent.getName()),
        "Nested folder FQN should contain parent name");
  }

  @Test
  void test_createFolderWithoutName_fails(TestNamespace ns) {
    assertThrows(
        Exception.class,
        () -> getFolderService().create(new CreateFolder()),
        "Creating folder without name should fail");
  }

  @Test
  void test_rootFolderHasNoParent(TestNamespace ns) {
    Folder folder =
        getFolderService().create(new CreateFolder().withName(ns.prefix("root_folder")));

    assertNull(folder.getParent());
  }
}

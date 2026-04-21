package org.openmetadata.it.drive;

import static org.awaitility.Awaitility.await;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import jakarta.ws.rs.core.Response;
import java.time.Duration;
import java.util.List;
import java.util.UUID;
import org.apache.http.client.HttpResponseException;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.schema.api.data.CreateContextFile;
import org.openmetadata.schema.api.data.CreateFolder;
import org.openmetadata.schema.entity.data.ContextFile;
import org.openmetadata.schema.entity.data.ContextFileType;
import org.openmetadata.schema.entity.data.Folder;
import org.openmetadata.schema.entity.data.ProcessingStatus;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.services.teams.UserService;
import org.openmetadata.sdk.test.util.RestClient;
import org.openmetadata.sdk.test.util.SdkClients;
import org.openmetadata.sdk.test.util.TestNamespace;
import org.openmetadata.sdk.test.util.TestNamespaceExtension;

@ExtendWith(TestNamespaceExtension.class)
class FolderIT {

  private static final String PATH = "v1/drive/folders";

  private Folder createFolder(RestClient rest, CreateFolder request) throws HttpResponseException {
    return rest.create(PATH, request, Folder.class);
  }

  private Folder getFolder(RestClient rest, UUID id, String fields) throws HttpResponseException {
    return rest.getById(PATH, id, fields, Folder.class);
  }

  private Folder patchFolder(RestClient rest, UUID id, String origJson, Folder updated)
      throws HttpResponseException {
    return rest.patch(PATH, id, origJson, updated, Folder.class);
  }

  // --- CRUD ---

  @Test
  void testCreateFolder(TestNamespace ns) throws HttpResponseException {
    RestClient rest = RestClient.admin();

    CreateFolder create =
        new CreateFolder().withName(ns.prefix("my-folder")).withDisplayName("My Folder");

    Folder folder = createFolder(rest, create);
    assertNotNull(folder.getId());
    assertEquals("My Folder", folder.getDisplayName());
  }

  @Test
  void testGetFolderById(TestNamespace ns) throws HttpResponseException {
    RestClient rest = RestClient.admin();

    Folder created = createFolder(rest, new CreateFolder().withName(ns.prefix("get-test")));

    Folder fetched = getFolder(rest, created.getId(), "");
    assertEquals(created.getId(), fetched.getId());
    assertEquals(created.getName(), fetched.getName());
  }

  @Test
  void testUpdateFolderDisplayName(TestNamespace ns) throws HttpResponseException {
    RestClient rest = RestClient.admin();

    Folder folder =
        createFolder(
            rest,
            new CreateFolder().withName(ns.prefix("update-test")).withDisplayName("Original Name"));

    String original = JsonUtils.pojoToJson(folder);
    folder.setDisplayName("Updated Name");
    Folder updated = patchFolder(rest, folder.getId(), original, folder);

    assertEquals("Updated Name", updated.getDisplayName());
  }

  @Test
  void testDeleteFolder(TestNamespace ns) throws HttpResponseException {
    RestClient rest = RestClient.admin();

    Folder folder = createFolder(rest, new CreateFolder().withName(ns.prefix("delete-test")));

    rest.delete(PATH, folder.getId());

    HttpResponseException ex =
        assertThrows(HttpResponseException.class, () -> getFolder(rest, folder.getId(), ""));
    assertEquals(404, ex.getStatusCode());

    try (Response deletedResponse = rest.rawGet(PATH + "/" + folder.getId() + "?include=all")) {
      assertEquals(200, deletedResponse.getStatus());
      assertTrue(deletedResponse.readEntity(String.class).contains("\"deleted\":true"));
    }
  }

  @Test
  void testRestoreSoftDeletedFolder(TestNamespace ns) throws HttpResponseException {
    RestClient rest = RestClient.admin();

    Folder folder = createFolder(rest, new CreateFolder().withName(ns.prefix("restore-folder")));
    rest.delete(PATH, folder.getId());

    Folder restored = rest.restore(PATH, folder.getId(), Folder.class);
    assertEquals(folder.getId(), restored.getId());
    assertTrue(!Boolean.TRUE.equals(restored.getDeleted()));
  }

  @Test
  void testHardDeleteFolderIsAsync(TestNamespace ns) throws HttpResponseException {
    RestClient rest = RestClient.admin();

    Folder folder =
        createFolder(rest, new CreateFolder().withName(ns.prefix("hard-delete-folder")));

    try (Response deleteResponse =
        rest.rawDelete(PATH + "/" + folder.getId() + "?hardDelete=true&recursive=true")) {
      assertEquals(202, deleteResponse.getStatus());
      assertTrue(deleteResponse.readEntity(String.class).contains("\"hardDelete\":true"));
    }

    await()
        .atMost(Duration.ofSeconds(20))
        .untilAsserted(
            () -> {
              try (Response deletedResponse =
                  rest.rawGet(PATH + "/" + folder.getId() + "?include=all")) {
                assertEquals(404, deletedResponse.getStatus());
              }
            });
  }

  // --- Nested Folder Hierarchy ---

  @Test
  void testNestedFolders(TestNamespace ns) throws HttpResponseException {
    RestClient rest = RestClient.admin();

    Folder root =
        createFolder(
            rest, new CreateFolder().withName(ns.prefix("root")).withDisplayName("Root Folder"));

    Folder child =
        createFolder(
            rest,
            new CreateFolder()
                .withName(ns.prefix("child"))
                .withDisplayName("Child Folder")
                .withParent(root.getFullyQualifiedName()));

    Folder grandchild =
        createFolder(
            rest,
            new CreateFolder()
                .withName(ns.prefix("grandchild"))
                .withDisplayName("Grandchild Folder")
                .withParent(child.getFullyQualifiedName()));

    // Verify parent-child
    Folder fetchedChild = getFolder(rest, child.getId(), "parent");
    assertNotNull(fetchedChild.getParent());
    assertEquals(root.getId(), fetchedChild.getParent().getId());

    // Verify FQN includes full path
    Folder fetchedGrandchild = getFolder(rest, grandchild.getId(), "parent");
    assertTrue(
        fetchedGrandchild.getFullyQualifiedName().contains(root.getName()),
        "Grandchild FQN should contain root folder name");
    assertTrue(
        fetchedGrandchild.getFullyQualifiedName().contains(child.getName()),
        "Grandchild FQN should contain child folder name");
  }

  @Test
  void testFolderWithChildren(TestNamespace ns) throws HttpResponseException {
    RestClient rest = RestClient.admin();

    Folder parent = createFolder(rest, new CreateFolder().withName(ns.prefix("parent-list")));

    createFolder(
        rest,
        new CreateFolder()
            .withName(ns.prefix("child-1"))
            .withParent(parent.getFullyQualifiedName()));
    createFolder(
        rest,
        new CreateFolder()
            .withName(ns.prefix("child-2"))
            .withParent(parent.getFullyQualifiedName()));

    Folder fetched = getFolder(rest, parent.getId(), "children");
    assertNotNull(fetched.getChildren());
    assertEquals(2, fetched.getChildren().size());
  }

  // --- Ownership (personal vs team folder) ---

  @Test
  void testFolderWithUserOwner(TestNamespace ns) throws HttpResponseException {
    RestClient rest = RestClient.admin();
    OpenMetadataClient adminClient = SdkClients.adminClient();
    UserService userSvc = new UserService(adminClient.getHttpClient());
    User admin = userSvc.getByName("admin", null);

    Folder folder =
        createFolder(
            rest,
            new CreateFolder()
                .withName(ns.prefix("personal"))
                .withDisplayName("My Personal Docs")
                .withOwners(List.of(admin.getEntityReference())));

    Folder fetched = getFolder(rest, folder.getId(), "owners");
    assertNotNull(fetched.getOwners());
    assertEquals(1, fetched.getOwners().size());
    assertEquals(admin.getId(), fetched.getOwners().get(0).getId());
  }

  // --- Permissions ---

  @Test
  void testUnprivilegedUserCannotDeleteFolder(TestNamespace ns) throws HttpResponseException {
    RestClient adminRest = RestClient.admin();
    User owner = DriveTestUsers.createUser(ns, "folder-owner");

    Folder folder =
        createFolder(
            adminRest,
            new CreateFolder()
                .withName(ns.prefix("perm-delete"))
                .withOwners(List.of(owner.getEntityReference())));

    RestClient consumerRest = RestClient.forUser("test@open-metadata.org", new String[] {});

    HttpResponseException ex =
        assertThrows(
            HttpResponseException.class, () -> consumerRest.hardDelete(PATH, folder.getId()));

    assertTrue(
        ex.getStatusCode() == 403 || ex.getStatusCode() == 401,
        "Expected 403 or 401, got " + ex.getStatusCode());
  }

  @Test
  void testUnprivilegedUserCannotUpdateOthersFolder(TestNamespace ns) throws HttpResponseException {
    RestClient adminRest = RestClient.admin();
    User owner = DriveTestUsers.createUser(ns, "folder-editor");

    Folder folder =
        createFolder(
            adminRest,
            new CreateFolder()
                .withName(ns.prefix("perm-update"))
                .withDisplayName("Original")
                .withOwners(List.of(owner.getEntityReference())));

    RestClient consumerRest = RestClient.forUser("test@open-metadata.org", new String[] {});

    String original = JsonUtils.pojoToJson(folder);
    folder.setDisplayName("Hacked Name");

    HttpResponseException ex =
        assertThrows(
            HttpResponseException.class,
            () -> consumerRest.patch(PATH, folder.getId(), original, folder, Folder.class));

    assertTrue(
        ex.getStatusCode() == 403 || ex.getStatusCode() == 401,
        "Expected 403 or 401, got " + ex.getStatusCode());
  }

  @Test
  @Execution(ExecutionMode.SAME_THREAD)
  void testDeleteFolderRecursive(TestNamespace ns) throws HttpResponseException {
    RestClient rest = RestClient.admin();

    Folder parent = createFolder(rest, new CreateFolder().withName(ns.prefix("recursive-parent")));

    Folder child =
        createFolder(
            rest,
            new CreateFolder()
                .withName(ns.prefix("recursive-child"))
                .withParent(parent.getFullyQualifiedName()));

    // Delete parent recursively
    try (Response deleteResponse =
        rest.rawDelete(PATH + "/" + parent.getId() + "?recursive=true&hardDelete=true")) {
      assertEquals(202, deleteResponse.getStatus());
      String responseBody = deleteResponse.readEntity(String.class);
      assertTrue(responseBody.contains("\"hardDelete\":true"));
      assertTrue(responseBody.contains("\"recursive\":true"));
    }

    // Both should be gone. Close each Response before opening the next so the Apache HTTP
    // client's connection pool doesn't hold two concurrent requests — under parallel-test load
    // the second GET can otherwise block waiting for a free connection.
    await()
        .atMost(Duration.ofMinutes(2))
        .pollInterval(Duration.ofSeconds(1))
        .untilAsserted(
            () -> {
              int parentStatus;
              try (Response parentResponse =
                  rest.rawGet(PATH + "/" + parent.getId() + "?include=all")) {
                parentStatus = parentResponse.getStatus();
              }
              int childStatus;
              try (Response childResponse =
                  rest.rawGet(PATH + "/" + child.getId() + "?include=all")) {
                childStatus = childResponse.getStatus();
              }
              assertEquals(404, parentStatus);
              assertEquals(404, childStatus);
            });
  }

  @Test
  void testFolderContentsIncludesFoldersAndFiles(TestNamespace ns) throws Exception {
    RestClient rest = RestClient.admin();
    OpenMetadataClient adminClient = SdkClients.adminClient();
    UserService userSvc = new UserService(adminClient.getHttpClient());
    User admin = userSvc.getByName("admin", null);

    Folder parent = createFolder(rest, new CreateFolder().withName(ns.prefix("contents-parent")));
    Folder child =
        createFolder(
            rest,
            new CreateFolder()
                .withName(ns.prefix("child-folder"))
                .withParent(parent.getFullyQualifiedName())
                .withOwners(List.of(admin.getEntityReference())));

    ContextFile file =
        rest.create(
            "v1/drive/files",
            new CreateContextFile()
                .withName(ns.prefix("contents-file"))
                .withDisplayName("Contents File")
                .withFileType(ContextFileType.PDF)
                .withFolder(parent.getFullyQualifiedName())
                .withOwners(List.of(admin.getEntityReference()))
                .withProcessingStatus(ProcessingStatus.Uploaded),
            ContextFile.class);

    String json;
    try (Response response = rest.rawGet(PATH + "/" + parent.getId() + "/contents")) {
      assertEquals(200, response.getStatus());
      json = response.readEntity(String.class);
    }
    jakarta.json.JsonObject contents =
        jakarta.json.Json.createReader(new java.io.StringReader(json)).readObject();
    jakarta.json.JsonObject folderJson = contents.getJsonArray("folders").getJsonObject(0);
    jakarta.json.JsonObject fileJson = contents.getJsonArray("files").getJsonObject(0);

    assertEquals(1, contents.getInt("childrenFolderCount"));
    assertEquals(1, contents.getInt("childrenFileCount"));
    assertEquals(2, contents.getInt("itemCount"));
    assertEquals(1, contents.getJsonArray("folders").size());
    assertEquals(1, contents.getJsonArray("files").size());
    assertEquals(child.getName(), folderJson.getString("name"));
    assertEquals(parent.getId().toString(), folderJson.getJsonObject("parent").getString("id"));
    assertEquals(
        admin.getId().toString(),
        folderJson.getJsonArray("owners").getJsonObject(0).getString("id"));
    assertEquals(file.getName(), fileJson.getString("name"));
    assertEquals(parent.getId().toString(), fileJson.getJsonObject("folder").getString("id"));
    assertEquals(
        admin.getId().toString(), fileJson.getJsonArray("owners").getJsonObject(0).getString("id"));
  }
}

package org.openmetadata.it.drive;

import static org.awaitility.Awaitility.await;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.JsonNode;
import jakarta.ws.rs.core.Response;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.apache.http.client.HttpResponseException;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.openmetadata.schema.api.data.CreateContextFile;
import org.openmetadata.schema.api.data.CreateFolder;
import org.openmetadata.schema.api.data.MoveContextFileRequest;
import org.openmetadata.schema.entity.data.ContextFile;
import org.openmetadata.schema.entity.data.ContextFileSourceType;
import org.openmetadata.schema.entity.data.ContextFileType;
import org.openmetadata.schema.entity.data.Folder;
import org.openmetadata.schema.entity.data.ProcessingStatus;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.sdk.test.util.RestClient;
import org.openmetadata.sdk.test.util.TestNamespace;
import org.openmetadata.sdk.test.util.TestNamespaceExtension;

@ExtendWith(TestNamespaceExtension.class)
class ContextFileIT {

  private static final String FILE_PATH = "v1/contextCenter/drive/files";
  private static final String FOLDER_PATH = "v1/contextCenter/drive/folders";

  private ContextFile createFile(RestClient rest, CreateContextFile request)
      throws HttpResponseException {
    return rest.create(FILE_PATH, request, ContextFile.class);
  }

  private ContextFile getFile(RestClient rest, UUID id, String fields)
      throws HttpResponseException {
    return rest.getById(FILE_PATH, id, fields, ContextFile.class);
  }

  private Folder createFolder(RestClient rest, CreateFolder request) throws HttpResponseException {
    return rest.create(FOLDER_PATH, request, Folder.class);
  }

  private List<String> listFileIds(RestClient rest, String path) {
    try (Response response = rest.rawGet(path)) {
      assertEquals(200, response.getStatus());
      JsonNode root = JsonUtils.readTree(response.readEntity(String.class));
      List<String> ids = new ArrayList<>();
      root.get("data").forEach(node -> ids.add(node.get("id").asText()));
      return ids;
    }
  }

  // --- CRUD ---

  @Test
  void testCreateContextFile(TestNamespace ns) throws HttpResponseException {
    RestClient rest = RestClient.admin();

    CreateContextFile create =
        new CreateContextFile()
            .withName(ns.prefix("report-pdf"))
            .withDisplayName("Annual Report 2023")
            .withFileType(ContextFileType.PDF)
            .withFileSize(4200000)
            .withContentType("application/pdf")
            .withFileExtension("pdf")
            .withProcessingStatus(ProcessingStatus.Uploaded);

    ContextFile file = createFile(rest, create);
    assertNotNull(file.getId());
    assertEquals("Annual Report 2023", file.getDisplayName());
    assertEquals(ContextFileType.PDF, file.getFileType());
    assertEquals(4200000, file.getFileSize().intValue());
  }

  @Test
  void testCreateSpreadsheet(TestNamespace ns) throws HttpResponseException {
    RestClient rest = RestClient.admin();

    CreateContextFile create =
        new CreateContextFile()
            .withName(ns.prefix("pricing-xlsx"))
            .withDisplayName("Product Pricing")
            .withFileType(ContextFileType.Spreadsheet)
            .withFileSize(128000)
            .withContentType("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
            .withFileExtension("xlsx")
            .withProcessingStatus(ProcessingStatus.Uploaded);

    ContextFile file = createFile(rest, create);
    assertEquals(ContextFileType.Spreadsheet, file.getFileType());
  }

  @Test
  void testGetFileById(TestNamespace ns) throws HttpResponseException {
    RestClient rest = RestClient.admin();

    ContextFile created =
        createFile(
            rest,
            new CreateContextFile()
                .withName(ns.prefix("get-test"))
                .withFileType(ContextFileType.CSV)
                .withProcessingStatus(ProcessingStatus.Uploaded));

    ContextFile fetched = getFile(rest, created.getId(), "");
    assertEquals(created.getId(), fetched.getId());
    assertEquals(ContextFileType.CSV, fetched.getFileType());
  }

  @Test
  void testDeleteFile(TestNamespace ns) throws HttpResponseException {
    RestClient rest = RestClient.admin();

    ContextFile file =
        createFile(
            rest,
            new CreateContextFile()
                .withName(ns.prefix("delete-test"))
                .withProcessingStatus(ProcessingStatus.Uploaded));

    rest.delete(FILE_PATH, file.getId());

    HttpResponseException ex =
        assertThrows(HttpResponseException.class, () -> getFile(rest, file.getId(), ""));
    assertEquals(404, ex.getStatusCode());

    try (Response deletedResponse = rest.rawGet(FILE_PATH + "/" + file.getId() + "?include=all")) {
      assertEquals(200, deletedResponse.getStatus());
      assertTrue(deletedResponse.readEntity(String.class).contains("\"deleted\":true"));
    }
  }

  @Test
  void testRestoreSoftDeletedFile(TestNamespace ns) throws HttpResponseException {
    RestClient rest = RestClient.admin();

    ContextFile file =
        createFile(
            rest,
            new CreateContextFile()
                .withName(ns.prefix("restore-test"))
                .withProcessingStatus(ProcessingStatus.Uploaded));

    rest.delete(FILE_PATH, file.getId());
    ContextFile restored = rest.restore(FILE_PATH, file.getId(), ContextFile.class);

    assertEquals(file.getId(), restored.getId());
    assertTrue(!Boolean.TRUE.equals(restored.getDeleted()));
    assertEquals(file.getId(), getFile(rest, file.getId(), "").getId());
  }

  @Test
  void testListFilesOrderByUpdatedAtDesc(TestNamespace ns) throws Exception {
    RestClient rest = RestClient.admin();

    ContextFile older =
        createFile(
            rest,
            new CreateContextFile()
                .withName(ns.prefix("ordered-older"))
                .withProcessingStatus(ProcessingStatus.Uploaded));
    Thread.sleep(5);
    ContextFile newer =
        createFile(
            rest,
            new CreateContextFile()
                .withName(ns.prefix("ordered-newer"))
                .withProcessingStatus(ProcessingStatus.Uploaded));

    List<String> ids = listFileIds(rest, FILE_PATH + "?limit=1000&orderBy=DESC");

    int olderIndex = ids.indexOf(older.getId().toString());
    int newerIndex = ids.indexOf(newer.getId().toString());
    assertTrue(olderIndex >= 0, "Expected ordered older file in list response");
    assertTrue(newerIndex >= 0, "Expected ordered newer file in list response");
    assertTrue(newerIndex < olderIndex, "Newer file should be listed before older file");
  }

  @Test
  void testListFilesOrderByRejectsDefaultCursor(TestNamespace ns) throws Exception {
    RestClient rest = RestClient.admin();

    createFile(
        rest,
        new CreateContextFile()
            .withName(ns.prefix("default-cursor-first"))
            .withProcessingStatus(ProcessingStatus.Uploaded));
    createFile(
        rest,
        new CreateContextFile()
            .withName(ns.prefix("default-cursor-second"))
            .withProcessingStatus(ProcessingStatus.Uploaded));

    try (Response response = rest.rawGet(FILE_PATH + "?limit=1")) {
      assertEquals(200, response.getStatus());
      JsonNode root = JsonUtils.readTree(response.readEntity(String.class));
      JsonNode after = root.get("paging").get("after");
      assertNotNull(after, "Default list response should include an after cursor");

      String encodedCursor = URLEncoder.encode(after.asText(), StandardCharsets.UTF_8);
      try (Response orderByResponse =
          rest.rawGet(FILE_PATH + "?limit=1&orderBy=DESC&after=" + encodedCursor)) {
        String body = orderByResponse.readEntity(String.class);
        assertEquals(
            Response.Status.BAD_REQUEST.getStatusCode(), orderByResponse.getStatus(), body);
        assertTrue(body.contains("Invalid cursor for orderBy pagination"));
      }
    }
  }

  @Test
  void testHardDeleteFileIsAsync(TestNamespace ns) throws HttpResponseException {
    RestClient rest = RestClient.admin();

    ContextFile file =
        createFile(
            rest,
            new CreateContextFile()
                .withName(ns.prefix("perm-delete-test"))
                .withProcessingStatus(ProcessingStatus.Uploaded));

    try (Response deleteResponse =
        rest.rawDelete(FILE_PATH + "/" + file.getId() + "?hardDelete=true")) {
      assertEquals(202, deleteResponse.getStatus());
      assertTrue(deleteResponse.readEntity(String.class).contains("\"hardDelete\":true"));
    }

    await()
        .atMost(Duration.ofSeconds(10))
        .untilAsserted(
            () -> {
              try (Response deletedResponse =
                  rest.rawGet(FILE_PATH + "/" + file.getId() + "?include=all")) {
                assertEquals(404, deletedResponse.getStatus());
              }
            });
  }

  // --- File in Folder ---

  @Test
  void testFileInFolder(TestNamespace ns) throws HttpResponseException {
    RestClient rest = RestClient.admin();

    Folder folder = createFolder(rest, new CreateFolder().withName(ns.prefix("docs-folder")));

    ContextFile file =
        createFile(
            rest,
            new CreateContextFile()
                .withName(ns.prefix("file-in-folder"))
                .withDisplayName("Report in Folder")
                .withFileType(ContextFileType.PDF)
                .withFolder(folder.getFullyQualifiedName())
                .withProcessingStatus(ProcessingStatus.Uploaded));

    ContextFile fetched = getFile(rest, file.getId(), "folder");
    assertNotNull(fetched.getFolder());
    assertEquals(folder.getId(), fetched.getFolder().getId());

    // FQN should include folder name
    assertTrue(
        fetched.getFullyQualifiedName().contains(folder.getName()),
        "File FQN should include folder name");
  }

  @Test
  void testFileInNestedFolder(TestNamespace ns) throws HttpResponseException {
    RestClient rest = RestClient.admin();

    Folder root = createFolder(rest, new CreateFolder().withName(ns.prefix("root")));
    Folder child =
        createFolder(
            rest,
            new CreateFolder()
                .withName(ns.prefix("child"))
                .withParent(root.getFullyQualifiedName()));

    ContextFile file =
        createFile(
            rest,
            new CreateContextFile()
                .withName(ns.prefix("deep-file"))
                .withFolder(child.getFullyQualifiedName())
                .withProcessingStatus(ProcessingStatus.Uploaded));

    ContextFile fetched = getFile(rest, file.getId(), "folder");
    assertTrue(
        fetched.getFullyQualifiedName().contains(root.getName()),
        "File FQN should contain root folder");
    assertTrue(
        fetched.getFullyQualifiedName().contains(child.getName()),
        "File FQN should contain child folder");
  }

  // --- Source Provenance ---

  @Test
  void testFileSourceProvenance(TestNamespace ns) throws HttpResponseException {
    RestClient rest = RestClient.admin();

    CreateContextFile create =
        new CreateContextFile()
            .withName(ns.prefix("synced-file"))
            .withFileType(ContextFileType.Document)
            .withSourceType(ContextFileSourceType.Confluence)
            .withSourceId("page-12345")
            .withSourceUrl(java.net.URI.create("https://wiki.example.com/page/12345"))
            .withProcessingStatus(ProcessingStatus.Processed);

    ContextFile file = createFile(rest, create);
    assertEquals(ContextFileSourceType.Confluence, file.getSourceType());
    assertEquals("page-12345", file.getSourceId());
  }

  // --- Processing Status Update ---

  @Test
  void testUpdateProcessingStatus(TestNamespace ns) throws HttpResponseException {
    RestClient rest = RestClient.admin();

    ContextFile file =
        createFile(
            rest,
            new CreateContextFile()
                .withName(ns.prefix("status-test"))
                .withFileType(ContextFileType.PDF)
                .withProcessingStatus(ProcessingStatus.Uploaded));

    assertEquals(ProcessingStatus.Uploaded, file.getProcessingStatus());

    // Patch to Processed
    String original = JsonUtils.pojoToJson(file);
    file.setProcessingStatus(ProcessingStatus.Processed);
    ContextFile updated = rest.patch(FILE_PATH, file.getId(), original, file, ContextFile.class);

    assertEquals(ProcessingStatus.Processed, updated.getProcessingStatus());
  }

  // --- Permissions ---

  @Test
  void testUnprivilegedUserCannotDeleteFile(TestNamespace ns) throws HttpResponseException {
    RestClient adminRest = RestClient.admin();
    User owner = DriveTestUsers.createUser(ns, "file-owner");

    ContextFile file =
        createFile(
            adminRest,
            new CreateContextFile()
                .withName(ns.prefix("perm-delete"))
                .withFileType(ContextFileType.PDF)
                .withProcessingStatus(ProcessingStatus.Uploaded)
                .withOwners(List.of(owner.getEntityReference())));

    RestClient consumerRest = RestClient.forUser("test@open-metadata.org", new String[] {});

    HttpResponseException ex =
        assertThrows(
            HttpResponseException.class, () -> consumerRest.hardDelete(FILE_PATH, file.getId()));

    assertTrue(
        ex.getStatusCode() == 403 || ex.getStatusCode() == 401,
        "Expected 403/401, got " + ex.getStatusCode());
  }

  @Test
  void testUnprivilegedUserCannotUpdateOthersFile(TestNamespace ns) throws HttpResponseException {
    RestClient adminRest = RestClient.admin();
    User owner = DriveTestUsers.createUser(ns, "file-editor");

    ContextFile file =
        createFile(
            adminRest,
            new CreateContextFile()
                .withName(ns.prefix("perm-update"))
                .withDisplayName("Admin's File")
                .withFileType(ContextFileType.PDF)
                .withProcessingStatus(ProcessingStatus.Uploaded)
                .withOwners(List.of(owner.getEntityReference())));

    RestClient consumerRest = RestClient.forUser("test@open-metadata.org", new String[] {});

    String original = JsonUtils.pojoToJson(file);
    file.setDisplayName("Hacked");

    HttpResponseException ex =
        assertThrows(
            HttpResponseException.class,
            () -> consumerRest.patch(FILE_PATH, file.getId(), original, file, ContextFile.class));

    assertTrue(
        ex.getStatusCode() == 403 || ex.getStatusCode() == 401,
        "Expected 403/401, got " + ex.getStatusCode());
  }

  @Test
  void testOwnerCanUpdateOwnFile(TestNamespace ns) throws HttpResponseException {
    RestClient adminRest = RestClient.admin();
    User owner = DriveTestUsers.createUser(ns, "file-self-owner");

    ContextFile file =
        createFile(
            adminRest,
            new CreateContextFile()
                .withName(ns.prefix("owner-update"))
                .withDisplayName("Owner's File")
                .withFileType(ContextFileType.PDF)
                .withProcessingStatus(ProcessingStatus.Uploaded)
                .withOwners(List.of(owner.getEntityReference())));

    // The explicit owner should be able to update the file.
    RestClient ownerRest = RestClient.forUser(owner.getEmail(), new String[] {});

    String original = JsonUtils.pojoToJson(file);
    file.setDisplayName("Updated by Owner");

    ContextFile updated =
        ownerRest.patch(FILE_PATH, file.getId(), original, file, ContextFile.class);
    assertEquals("Updated by Owner", updated.getDisplayName());
  }

  // --- Search ---

  // --- Move ---

  private ContextFile moveFile(RestClient rest, UUID id, EntityReference newFolder)
      throws HttpResponseException {
    MoveContextFileRequest body = new MoveContextFileRequest().withFolder(newFolder);
    try (Response response = rest.rawPut(FILE_PATH + "/" + id + "/move", body)) {
      if (response.getStatus() >= 400) {
        throw new HttpResponseException(response.getStatus(), response.readEntity(String.class));
      }
      return JsonUtils.readValue(response.readEntity(String.class), ContextFile.class);
    }
  }

  @Test
  void testMoveFileBetweenFolders(TestNamespace ns) throws HttpResponseException {
    RestClient rest = RestClient.admin();
    Folder folderA = createFolder(rest, new CreateFolder().withName(ns.prefix("folder-a")));
    Folder folderB = createFolder(rest, new CreateFolder().withName(ns.prefix("folder-b")));

    ContextFile file =
        createFile(
            rest,
            new CreateContextFile()
                .withName(ns.prefix("move-between"))
                .withFileType(ContextFileType.PDF)
                .withFolder(folderA.getFullyQualifiedName())
                .withProcessingStatus(ProcessingStatus.Uploaded));
    assertEquals(folderA.getId(), file.getFolder().getId());

    ContextFile moved = moveFile(rest, file.getId(), folderB.getEntityReference());

    assertEquals(folderB.getId(), moved.getFolder().getId());
    assertTrue(
        moved.getFullyQualifiedName().contains(folderB.getName()),
        "Moved file FQN should reflect new folder, got " + moved.getFullyQualifiedName());

    ContextFile reloaded = getFile(rest, file.getId(), "folder");
    assertEquals(folderB.getId(), reloaded.getFolder().getId());
  }

  @Test
  void testMoveFileToRoot(TestNamespace ns) throws HttpResponseException {
    RestClient rest = RestClient.admin();
    Folder folder = createFolder(rest, new CreateFolder().withName(ns.prefix("folder-root-test")));

    ContextFile file =
        createFile(
            rest,
            new CreateContextFile()
                .withName(ns.prefix("move-to-root"))
                .withFileType(ContextFileType.PDF)
                .withFolder(folder.getFullyQualifiedName())
                .withProcessingStatus(ProcessingStatus.Uploaded));

    ContextFile moved = moveFile(rest, file.getId(), null);

    assertNull(moved.getFolder(), "File moved to root should have no folder reference");
    assertEquals(
        file.getName(), moved.getFullyQualifiedName(), "Root-level FQN should equal the file name");
  }

  @Test
  void testMoveFileNonExistentFolder(TestNamespace ns) throws HttpResponseException {
    RestClient rest = RestClient.admin();
    ContextFile file =
        createFile(
            rest,
            new CreateContextFile()
                .withName(ns.prefix("move-bad-folder"))
                .withFileType(ContextFileType.PDF)
                .withProcessingStatus(ProcessingStatus.Uploaded));

    EntityReference bogus = new EntityReference().withId(UUID.randomUUID()).withType("folder");

    HttpResponseException ex =
        assertThrows(HttpResponseException.class, () -> moveFile(rest, file.getId(), bogus));
    assertEquals(404, ex.getStatusCode());
  }

  @Test
  void testMoveFilePermissions(TestNamespace ns) throws HttpResponseException {
    RestClient adminRest = RestClient.admin();
    User owner = DriveTestUsers.createUser(ns, "file-mover");

    Folder folderA = createFolder(adminRest, new CreateFolder().withName(ns.prefix("perm-a")));
    Folder folderB = createFolder(adminRest, new CreateFolder().withName(ns.prefix("perm-b")));

    ContextFile file =
        createFile(
            adminRest,
            new CreateContextFile()
                .withName(ns.prefix("perm-move"))
                .withFileType(ContextFileType.PDF)
                .withFolder(folderA.getFullyQualifiedName())
                .withOwners(List.of(owner.getEntityReference()))
                .withProcessingStatus(ProcessingStatus.Uploaded));

    RestClient consumerRest = RestClient.forUser("test@open-metadata.org", new String[] {});

    HttpResponseException ex =
        assertThrows(
            HttpResponseException.class,
            () -> moveFile(consumerRest, file.getId(), folderB.getEntityReference()));
    assertTrue(
        ex.getStatusCode() == 403 || ex.getStatusCode() == 401,
        "Expected 403/401, got " + ex.getStatusCode());
  }

  @Test
  void testBulkMoveAndDeleteFiles(TestNamespace ns) throws HttpResponseException {
    RestClient rest = RestClient.admin();
    Folder target = createFolder(rest, new CreateFolder().withName(ns.prefix("bulk-target")));
    ContextFile first =
        createFile(
            rest,
            new CreateContextFile()
                .withName(ns.prefix("bulk-first"))
                .withDisplayName("Bulk First")
                .withProcessingStatus(ProcessingStatus.Uploaded));
    ContextFile second =
        createFile(
            rest,
            new CreateContextFile()
                .withName(ns.prefix("bulk-second"))
                .withDisplayName("Bulk Second")
                .withProcessingStatus(ProcessingStatus.Uploaded));
    List<String> ids = List.of(first.getId().toString(), second.getId().toString());

    try (Response response =
        rest.rawPut(
            FILE_PATH + "/bulk/move", Map.of("ids", ids, "folder", target.getEntityReference()))) {
      String body = response.readEntity(String.class);
      assertEquals(200, response.getStatus(), body);
      JsonNode result = JsonUtils.readTree(body);
      assertEquals("success", result.get("status").asText());
      assertEquals(2, result.get("numberOfRowsPassed").asInt());
    }

    assertEquals(target.getId(), getFile(rest, first.getId(), "folder").getFolder().getId());
    assertEquals(target.getId(), getFile(rest, second.getId(), "folder").getFolder().getId());

    try (Response response =
        rest.rawPost(FILE_PATH + "/bulk/delete", Map.of("ids", ids, "hardDelete", false))) {
      String body = response.readEntity(String.class);
      assertEquals(200, response.getStatus(), body);
      JsonNode result = JsonUtils.readTree(body);
      assertEquals("success", result.get("status").asText());
      assertEquals(2, result.get("numberOfRowsPassed").asInt());
    }

    HttpResponseException firstEx =
        assertThrows(HttpResponseException.class, () -> getFile(rest, first.getId(), ""));
    HttpResponseException secondEx =
        assertThrows(HttpResponseException.class, () -> getFile(rest, second.getId(), ""));
    assertEquals(404, firstEx.getStatusCode());
    assertEquals(404, secondEx.getStatusCode());

    rest.delete(FOLDER_PATH, target.getId());

    HttpResponseException folderEx =
        assertThrows(
            HttpResponseException.class,
            () -> rest.getById(FOLDER_PATH, target.getId(), "", Folder.class));
    assertEquals(404, folderEx.getStatusCode());
  }

  @Test
  void testDeleteFolderCascadesMovedFiles(TestNamespace ns) throws HttpResponseException {
    RestClient rest = RestClient.admin();
    Folder target =
        createFolder(rest, new CreateFolder().withName(ns.prefix("delete-cascade-target")));
    ContextFile first =
        createFile(
            rest,
            new CreateContextFile()
                .withName(ns.prefix("cascade-first"))
                .withDisplayName("Cascade First")
                .withProcessingStatus(ProcessingStatus.Uploaded));
    ContextFile second =
        createFile(
            rest,
            new CreateContextFile()
                .withName(ns.prefix("cascade-second"))
                .withDisplayName("Cascade Second")
                .withProcessingStatus(ProcessingStatus.Uploaded));
    List<String> ids = List.of(first.getId().toString(), second.getId().toString());

    try (Response response =
        rest.rawPut(
            FILE_PATH + "/bulk/move", Map.of("ids", ids, "folder", target.getEntityReference()))) {
      String body = response.readEntity(String.class);
      assertEquals(200, response.getStatus(), body);
    }

    rest.delete(FOLDER_PATH, target.getId());

    HttpResponseException folderEx =
        assertThrows(
            HttpResponseException.class,
            () -> rest.getById(FOLDER_PATH, target.getId(), "", Folder.class));
    HttpResponseException firstEx =
        assertThrows(HttpResponseException.class, () -> getFile(rest, first.getId(), ""));
    HttpResponseException secondEx =
        assertThrows(HttpResponseException.class, () -> getFile(rest, second.getId(), ""));
    assertEquals(404, folderEx.getStatusCode());
    assertEquals(404, firstEx.getStatusCode());
    assertEquals(404, secondEx.getStatusCode());
  }

  @Test
  void testFileAppearsInSearch(TestNamespace ns) throws Exception {
    RestClient rest = RestClient.admin();

    String uniqueName = ns.prefix("searchable-file");
    ContextFile file =
        createFile(
            rest,
            new CreateContextFile()
                .withName(uniqueName)
                .withDisplayName("Searchable PDF")
                .withFileType(ContextFileType.PDF)
                .withProcessingStatus(ProcessingStatus.Processed));

    // ES indexing is async. Poll the direct get-by-id endpoint, which performs a real-time
    // ES GET (no query_string parsing, no analyzer involvement) and is the most reliable
    // signal that the document was indexed. The previous version of this test issued a
    // free-text q= search using the namespaced unique name, but the prefix contains '-'
    // which the query_string parser treats as a NOT operator and can produce a 500 on
    // ES 9.x — yielding a flaky 30s-timeout failure even when the document is indexed.
    await()
        .pollDelay(Duration.ZERO)
        .pollInterval(Duration.ofMillis(200))
        .atMost(Duration.ofSeconds(60))
        .untilAsserted(
            () -> {
              try (Response getResp =
                  rest.rawGet("v1/search/get/context_file_search_index/doc/" + file.getId())) {
                int status = getResp.getStatus();
                String body = getResp.readEntity(String.class);
                if (status != 200) {
                  throw new AssertionError(
                      "Expected 200 from search-by-id for file "
                          + file.getId()
                          + " but got "
                          + status
                          + " body="
                          + body);
                }
                assertTrue(
                    body.contains(file.getId().toString()),
                    "Expected file " + file.getId() + " in search-by-id response: " + body);
              }
            });
  }
}

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
import org.openmetadata.schema.api.data.CreateContextFile;
import org.openmetadata.schema.api.data.CreateFolder;
import org.openmetadata.schema.entity.data.ContextFile;
import org.openmetadata.schema.entity.data.ContextFileSourceType;
import org.openmetadata.schema.entity.data.ContextFileType;
import org.openmetadata.schema.entity.data.Folder;
import org.openmetadata.schema.entity.data.ProcessingStatus;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.sdk.test.util.RestClient;
import org.openmetadata.sdk.test.util.TestNamespace;
import org.openmetadata.sdk.test.util.TestNamespaceExtension;

@ExtendWith(TestNamespaceExtension.class)
class ContextFileIT {

  private static final String FILE_PATH = "v1/drive/files";
  private static final String FOLDER_PATH = "v1/drive/folders";

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

  @Test
  void testFileAppearsInSearch(TestNamespace ns) throws Exception {
    RestClient rest = RestClient.admin();

    String uniqueName = ns.prefix("searchable-file");
    createFile(
        rest,
        new CreateContextFile()
            .withName(uniqueName)
            .withDisplayName("Searchable PDF")
            .withFileType(ContextFileType.PDF)
            .withProcessingStatus(ProcessingStatus.Processed));

    // Give ES time to index
    Thread.sleep(2000);

    jakarta.ws.rs.core.Response searchResp =
        rest.rawGet(
            "v1/search/query?q=" + uniqueName + "&index=context_file_search_index&from=0&size=10");
    assertEquals(200, searchResp.getStatus());
  }
}

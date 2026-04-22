package org.openmetadata.it.drive;

import static jakarta.ws.rs.core.Response.Status.CREATED;
import static org.awaitility.Awaitility.await;
import static org.junit.jupiter.api.Assertions.assertArrayEquals;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import io.dropwizard.jackson.Jackson;
import io.dropwizard.jersey.jackson.JacksonFeature;
import jakarta.ws.rs.client.Client;
import jakarta.ws.rs.client.ClientBuilder;
import jakarta.ws.rs.client.Entity;
import jakarta.ws.rs.client.WebTarget;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.MultivaluedHashMap;
import jakarta.ws.rs.core.MultivaluedMap;
import jakarta.ws.rs.core.Response;
import java.awt.Color;
import java.awt.Font;
import java.awt.Graphics2D;
import java.awt.RenderingHints;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.net.URI;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;
import java.util.Comparator;
import java.util.UUID;
import javax.imageio.ImageIO;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDPage;
import org.apache.pdfbox.pdmodel.PDPageContentStream;
import org.apache.pdfbox.pdmodel.font.PDType1Font;
import org.apache.poi.ss.usermodel.Workbook;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.glassfish.jersey.client.ClientProperties;
import org.glassfish.jersey.media.multipart.FormDataMultiPart;
import org.glassfish.jersey.media.multipart.MultiPartFeature;
import org.glassfish.jersey.media.multipart.file.StreamDataBodyPart;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.openmetadata.schema.api.data.CreateFolder;
import org.openmetadata.schema.entity.data.ContextFile;
import org.openmetadata.schema.entity.data.ContextFileType;
import org.openmetadata.schema.entity.data.Folder;
import org.openmetadata.schema.entity.data.ProcessingStatus;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.sdk.test.util.RestClient;
import org.openmetadata.sdk.test.util.SdkClients;
import org.openmetadata.sdk.test.util.TestNamespace;
import org.openmetadata.sdk.test.util.TestNamespaceExtension;
import software.amazon.awssdk.auth.credentials.AwsBasicCredentials;
import software.amazon.awssdk.auth.credentials.StaticCredentialsProvider;
import software.amazon.awssdk.core.ResponseInputStream;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.S3Configuration;
import software.amazon.awssdk.services.s3.model.GetObjectRequest;
import software.amazon.awssdk.services.s3.model.GetObjectResponse;
import software.amazon.awssdk.services.s3.model.ListObjectsV2Request;
import software.amazon.awssdk.services.s3.model.S3Object;

/**
 * Integration test for Context Center Drive file upload with MinIO-backed S3 storage using
 * fixture files from src/test/resources.
 */
@ExtendWith(TestNamespaceExtension.class)
class DriveFileUploadIT {

  private static final String MINIO_BUCKET = "test-bucket";
  private static final String TIKA_TESSERACT_PATH_PROPERTY = "collate.tika.tesseract.path";
  private static String serverBaseUrl;
  private static Client multipartClient;
  private static WebTarget uploadTarget;

  @BeforeAll
  static void setup() {
    String itBaseUrl =
        System.getProperty(
            "IT_BASE_URL",
            System.getenv().getOrDefault("IT_BASE_URL", "http://localhost:8585/api"));
    if (itBaseUrl.endsWith("/api")) {
      serverBaseUrl = itBaseUrl.substring(0, itBaseUrl.length() - 4);
    } else {
      serverBaseUrl = itBaseUrl;
    }

    multipartClient = ClientBuilder.newClient();
    multipartClient.register(MultiPartFeature.class);
    multipartClient.register(new JacksonFeature(Jackson.newObjectMapper()));

    uploadTarget =
        multipartClient
            .target(serverBaseUrl + "/api/v1/drive/files/upload")
            .property(ClientProperties.CONNECT_TIMEOUT, 30000)
            .property(ClientProperties.READ_TIMEOUT, 30000);
  }

  @AfterAll
  static void tearDown() {
    if (multipartClient != null) {
      multipartClient.close();
      multipartClient = null;
    }
  }

  private static MultivaluedMap<String, Object> adminAuthHeaders() {
    String token = SdkClients.getAdminToken();
    MultivaluedMap<String, Object> headers = new MultivaluedHashMap<>();
    headers.add("Authorization", "Bearer " + token);
    return headers;
  }

  private byte[] readFixture(String resourcePath) throws IOException {
    try (InputStream inputStream = getClass().getResourceAsStream(resourcePath)) {
      assertNotNull(inputStream, "Missing drive fixture: " + resourcePath);
      return inputStream.readAllBytes();
    }
  }

  private Response uploadFile(String fileName, byte[] content, String displayName, String folderFqn)
      throws IOException {
    try (FormDataMultiPart multipart = new FormDataMultiPart()) {
      if (displayName != null) {
        multipart.field("displayName", displayName);
      }
      if (folderFqn != null) {
        multipart.field("folder", folderFqn);
      }
      multipart.bodyPart(
          new StreamDataBodyPart(
              "file",
              new ByteArrayInputStream(content),
              fileName,
              MediaType.APPLICATION_OCTET_STREAM_TYPE));

      return uploadTarget
          .request()
          .headers(adminAuthHeaders())
          .post(Entity.entity(multipart, multipart.getMediaType()));
    }
  }

  private Response uploadFixture(String resourcePath, String displayName) throws IOException {
    String fileName = resourcePath.substring(resourcePath.lastIndexOf('/') + 1);
    return uploadFixture(resourcePath, fileName, displayName, null);
  }

  private Response uploadFixture(
      String resourcePath, String uploadedFileName, String displayName, String folderFqn)
      throws IOException {
    return uploadFile(uploadedFileName, readFixture(resourcePath), displayName, folderFqn);
  }

  private String resolveStoredObjectKey(S3Client s3Client, String assetId) {
    return s3Client
        .listObjectsV2Paginator(ListObjectsV2Request.builder().bucket(MINIO_BUCKET).build())
        .contents()
        .stream()
        .map(S3Object::key)
        .filter(key -> key.equals(assetId) || key.endsWith(assetId) || key.contains(assetId))
        .findFirst()
        .orElse(null);
  }

  private S3Client buildMinioClient() {
    return S3Client.builder()
        .region(Region.US_EAST_1)
        .credentialsProvider(
            StaticCredentialsProvider.create(AwsBasicCredentials.create("minio", "minio123")))
        .endpointOverride(
            URI.create(
                System.getProperty(
                    "IT_MINIO_ENDPOINT",
                    System.getenv().getOrDefault("IT_MINIO_ENDPOINT", "http://localhost:9000"))))
        .serviceConfiguration(S3Configuration.builder().pathStyleAccessEnabled(true).build())
        .build();
  }

  private void assertStoredInMinIO(String assetId, byte[] expectedBytes) {
    try (S3Client s3Client = buildMinioClient()) {
      // atMost must stay above the global Awaitility pollInterval that
      // K8sOMJobOperatorIT raises to 5s; otherwise Awaitility rejects with
      // "Timeout must be greater than the poll delay".
      await()
          .pollDelay(Duration.ZERO)
          .pollInterval(Duration.ofMillis(200))
          .atMost(Duration.ofSeconds(20))
          .untilAsserted(
              () -> {
                String objectKey = resolveStoredObjectKey(s3Client, assetId);
                assertNotNull(objectKey, "Expected uploaded object for asset " + assetId);
                try (ResponseInputStream<GetObjectResponse> objectStream =
                    s3Client.getObject(
                        GetObjectRequest.builder().bucket(MINIO_BUCKET).key(objectKey).build())) {
                  assertArrayEquals(expectedBytes, objectStream.readAllBytes());
                }
              });
    }
  }

  private void assertRemovedFromMinIO(String assetId) {
    try (S3Client s3Client = buildMinioClient()) {
      await()
          .atMost(Duration.ofSeconds(10))
          .untilAsserted(() -> assertTrue(resolveStoredObjectKey(s3Client, assetId) == null));
    }
  }

  private ContextFile fetchFile(UUID fileId) {
    try {
      return RestClient.admin().getById("v1/drive/files", fileId, "", ContextFile.class);
    } catch (Exception e) {
      throw new AssertionError("Failed to fetch uploaded file " + fileId, e);
    }
  }

  private void assertSearchContainsFile(String query, UUID fileId) {
    RestClient rest = RestClient.admin();
    String encodedQuery = URLEncoder.encode(query, StandardCharsets.UTF_8);

    await()
        .atMost(Duration.ofSeconds(20))
        .untilAsserted(
            () -> {
              try (Response searchResponse =
                  rest.rawGet(
                      "v1/search/query?q="
                          + encodedQuery
                          + "&index=context_file_search_index&from=0&size=10")) {
                assertEquals(200, searchResponse.getStatus());
                assertTrue(searchResponse.readEntity(String.class).contains(fileId.toString()));
              }
            });
  }

  private byte[] createPdf(String text) throws IOException {
    try (PDDocument document = new PDDocument();
        ByteArrayOutputStream outputStream = new ByteArrayOutputStream()) {
      PDPage page = new PDPage();
      document.addPage(page);
      try (PDPageContentStream contentStream = new PDPageContentStream(document, page)) {
        contentStream.beginText();
        contentStream.setFont(PDType1Font.HELVETICA_BOLD, 12);
        contentStream.newLineAtOffset(72, 720);
        contentStream.showText(text);
        contentStream.endText();
      }
      document.save(outputStream);
      return outputStream.toByteArray();
    }
  }

  private byte[] createWorkbook(String sheetName, String key, String value) throws IOException {
    try (Workbook workbook = new XSSFWorkbook();
        ByteArrayOutputStream outputStream = new ByteArrayOutputStream()) {
      var sheet = workbook.createSheet(sheetName);
      var header = sheet.createRow(0);
      header.createCell(0).setCellValue("Key");
      header.createCell(1).setCellValue("Value");
      var row = sheet.createRow(1);
      row.createCell(0).setCellValue(key);
      row.createCell(1).setCellValue(value);
      workbook.write(outputStream);
      return outputStream.toByteArray();
    }
  }

  private byte[] createPngWithText(String text) throws IOException {
    BufferedImage image = new BufferedImage(1400, 240, BufferedImage.TYPE_INT_RGB);
    Graphics2D graphics = image.createGraphics();
    try {
      graphics.setColor(Color.WHITE);
      graphics.fillRect(0, 0, image.getWidth(), image.getHeight());
      graphics.setColor(Color.BLACK);
      graphics.setRenderingHint(
          RenderingHints.KEY_TEXT_ANTIALIASING, RenderingHints.VALUE_TEXT_ANTIALIAS_ON);
      graphics.setFont(new Font("Monospaced", Font.BOLD, 56));
      graphics.drawString(text, 40, 140);
    } finally {
      graphics.dispose();
    }

    try (ByteArrayOutputStream outputStream = new ByteArrayOutputStream()) {
      ImageIO.write(image, "png", outputStream);
      return outputStream.toByteArray();
    }
  }

  private Path createFakeTesseractHome(String extractedText) throws IOException {
    Path home = Files.createTempDirectory("fake-tesseract-home-");
    Path executable = home.resolve("tesseract");
    Files.writeString(
        executable,
        "#!/bin/sh\n"
            + "if [ $# -eq 0 ] || [ \"$1\" = \"--version\" ]; then\n"
            + "  echo \"tesseract 5.0.0\"\n"
            + "  exit 0\n"
            + "fi\n"
            + "output_base=\"$2\"\n"
            + "printf '%s\\n' \""
            + extractedText
            + "\" > \"${output_base}.txt\"\n",
        StandardCharsets.UTF_8);
    executable.toFile().setExecutable(true);
    return home;
  }

  private void deleteRecursively(Path root) throws IOException {
    if (root == null || Files.notExists(root)) {
      return;
    }
    try (var paths = Files.walk(root)) {
      paths.sorted(Comparator.reverseOrder()).forEach(path -> path.toFile().delete());
    }
  }

  @Test
  void testUploadPdfToMinIO(TestNamespace ns) throws Exception {
    byte[] content = readFixture("/drive/sample-report.pdf");
    ContextFile file;
    try (Response response = uploadFixture("/drive/sample-report.pdf", "Annual Report")) {
      String body = response.readEntity(String.class);
      assertEquals(
          CREATED.getStatusCode(), response.getStatus(), "Upload to MinIO failed: " + body);

      file = JsonUtils.readValue(body, ContextFile.class);
      assertNotNull(file.getId());
      assertNotNull(file.getAssetId(), "File should have assetId from S3 upload");
      assertNotNull(file.getHeadContentId(), "File should point at a current content snapshot");
      assertEquals("Annual Report", file.getDisplayName());
      assertEquals(content.length, file.getFileSize().intValue());
      assertStoredInMinIO(file.getAssetId(), content);
    }

    await()
        .atMost(Duration.ofSeconds(20))
        .untilAsserted(
            () -> {
              ContextFile refreshed = fetchFile(file.getId());
              assertEquals(ProcessingStatus.Processed, refreshed.getProcessingStatus());
              assertTrue(refreshed.getExtractedText().contains("Context Center PDF Fixture"));
              assertEquals(1, refreshed.getPageCount());
            });
  }

  @Test
  void testUploadSpreadsheetToMinIO(TestNamespace ns) throws Exception {
    byte[] content = readFixture("/drive/sample-pricing.xlsx");
    Response response = uploadFixture("/drive/sample-pricing.xlsx", "Pricing Sheet");

    String body = response.readEntity(String.class);
    assertEquals(CREATED.getStatusCode(), response.getStatus(), "Upload failed: " + body);

    ContextFile file = JsonUtils.readValue(body, ContextFile.class);
    assertNotNull(file.getAssetId());
    assertNotNull(file.getHeadContentId());
    assertEquals("Pricing Sheet", file.getDisplayName());
    assertEquals(content.length, file.getFileSize().intValue());
  }

  @Test
  void testUploadCsvToMinIO(TestNamespace ns) throws Exception {
    byte[] content = readFixture("/drive/sample-data.csv");
    Response response = uploadFixture("/drive/sample-data.csv", null);

    String body = response.readEntity(String.class);
    assertEquals(CREATED.getStatusCode(), response.getStatus(), "Upload failed: " + body);

    ContextFile file = JsonUtils.readValue(body, ContextFile.class);
    assertNotNull(file.getAssetId());
    assertNotNull(file.getHeadContentId());
    assertEquals("sample-data.csv", file.getDisplayName());
    assertEquals(content.length, file.getFileSize().intValue());
  }

  @Test
  void testUploadVerifyFileSize(TestNamespace ns) throws Exception {
    byte[] contentBytes = readFixture("/drive/sample-notes.txt");
    try (Response response = uploadFixture("/drive/sample-notes.txt", "Sized File")) {
      String body = response.readEntity(String.class);
      assertEquals(CREATED.getStatusCode(), response.getStatus(), "Upload failed: " + body);

      ContextFile file = JsonUtils.readValue(body, ContextFile.class);
      assertEquals(
          contentBytes.length,
          file.getFileSize().intValue(),
          "File size should match uploaded bytes");
      assertEquals("txt", file.getFileExtension());
      assertEquals(ProcessingStatus.Uploaded, file.getProcessingStatus());
      assertNotNull(file.getHeadContentId());
    }
  }

  @Test
  void testUploadedTextFileIsSearchableByExtractedText(TestNamespace ns) throws Exception {
    String uniqueToken = "contextneedle" + UUID.randomUUID().toString().replace("-", "");
    byte[] content =
        ("User supplied context that should be searchable " + uniqueToken)
            .getBytes(StandardCharsets.UTF_8);

    ContextFile file;
    try (Response response = uploadFile("search-fixture.txt", content, "Search Fixture", null)) {
      String body = response.readEntity(String.class);
      assertEquals(CREATED.getStatusCode(), response.getStatus(), "Upload failed: " + body);
      file = JsonUtils.readValue(body, ContextFile.class);
    }

    await()
        .atMost(Duration.ofSeconds(20))
        .untilAsserted(
            () -> {
              ContextFile refreshed = fetchFile(file.getId());
              assertEquals(ProcessingStatus.Processed, refreshed.getProcessingStatus());
              assertTrue(refreshed.getExtractedText().contains(uniqueToken));
            });

    assertSearchContainsFile(uniqueToken, file.getId());
  }

  @Test
  void testUploadedPdfIsSearchableByExtractedText(TestNamespace ns) throws Exception {
    String uniqueToken = "pdfneedle" + UUID.randomUUID().toString().replace("-", "");
    byte[] content = createPdf("Quarterly context for " + uniqueToken);

    ContextFile file;
    try (Response response =
        uploadFile("search-fixture.pdf", content, ns.shortPrefix("PDF Search"), null)) {
      String body = response.readEntity(String.class);
      assertEquals(CREATED.getStatusCode(), response.getStatus(), "Upload failed: " + body);
      file = JsonUtils.readValue(body, ContextFile.class);
    }

    await()
        .atMost(Duration.ofSeconds(20))
        .untilAsserted(
            () -> {
              ContextFile refreshed = fetchFile(file.getId());
              assertEquals(ProcessingStatus.Processed, refreshed.getProcessingStatus());
              assertTrue(refreshed.getExtractedText().contains(uniqueToken));
            });

    assertSearchContainsFile(uniqueToken, file.getId());
  }

  @Test
  void testUploadedSpreadsheetIsSearchableByExtractedText(TestNamespace ns) throws Exception {
    String uniqueToken = "sheetneedle" + UUID.randomUUID().toString().replace("-", "");
    byte[] content = createWorkbook("Pricing", "SearchToken", uniqueToken);

    ContextFile file;
    try (Response response =
        uploadFile("search-fixture.xlsx", content, ns.shortPrefix("Spreadsheet Search"), null)) {
      String body = response.readEntity(String.class);
      assertEquals(CREATED.getStatusCode(), response.getStatus(), "Upload failed: " + body);
      file = JsonUtils.readValue(body, ContextFile.class);
    }

    await()
        .atMost(Duration.ofSeconds(20))
        .untilAsserted(
            () -> {
              ContextFile refreshed = fetchFile(file.getId());
              assertEquals(ProcessingStatus.Processed, refreshed.getProcessingStatus());
              assertTrue(refreshed.getExtractedText().contains(uniqueToken));
            });

    assertSearchContainsFile(uniqueToken, file.getId());
  }

  @Test
  void testUploadedImageIsSearchableByOcrExtractedText(TestNamespace ns) throws Exception {
    String uniqueToken =
        "IMAGENEEDLE"
            + UUID.randomUUID().toString().replace("-", "").substring(0, 10).toUpperCase();
    Path fakeTesseractHome = createFakeTesseractHome("Revenue chart " + uniqueToken);
    String originalPath = System.getProperty(TIKA_TESSERACT_PATH_PROPERTY);

    try {
      System.setProperty(TIKA_TESSERACT_PATH_PROPERTY, fakeTesseractHome.toString());
      byte[] content = createPngWithText(uniqueToken);

      ContextFile file;
      try (Response response =
          uploadFile("search-fixture.png", content, ns.shortPrefix("Image Search"), null)) {
        String body = response.readEntity(String.class);
        assertEquals(CREATED.getStatusCode(), response.getStatus(), "Upload failed: " + body);
        file = JsonUtils.readValue(body, ContextFile.class);
      }

      await()
          .atMost(Duration.ofSeconds(20))
          .untilAsserted(
              () -> {
                ContextFile refreshed = fetchFile(file.getId());
                assertEquals(ProcessingStatus.Processed, refreshed.getProcessingStatus());
                assertTrue(refreshed.getExtractedText().contains(uniqueToken));
              });

      assertSearchContainsFile(uniqueToken, file.getId());
    } finally {
      if (originalPath == null) {
        System.clearProperty(TIKA_TESSERACT_PATH_PROPERTY);
      } else {
        System.setProperty(TIKA_TESSERACT_PATH_PROPERTY, originalPath);
      }
      deleteRecursively(fakeTesseractHome);
    }
  }

  @Test
  void testUploadFileIntoFolder(TestNamespace ns) throws Exception {
    RestClient rest = RestClient.admin();
    Folder folder =
        rest.create(
            "v1/drive/folders",
            new CreateFolder().withName(ns.prefix("upload-target-folder")),
            Folder.class);

    Response response =
        uploadFixture(
            "/drive/sample-report.pdf",
            "nested.pdf",
            "File In Folder",
            folder.getFullyQualifiedName());

    String body = response.readEntity(String.class);
    assertEquals(CREATED.getStatusCode(), response.getStatus(), "Upload failed: " + body);

    ContextFile file = JsonUtils.readValue(body, ContextFile.class);
    assertNotNull(file.getAssetId());
    assertNotNull(file.getHeadContentId());

    ContextFile fetched = rest.getById("v1/drive/files", file.getId(), "folder", ContextFile.class);
    assertNotNull(fetched.getFolder(), "File should be in folder");
    assertEquals(folder.getId(), fetched.getFolder().getId());
  }

  @Test
  void testUploadMultipleFilesUniqueness(TestNamespace ns) throws Exception {
    byte[] content = readFixture("/drive/sample-report.pdf");

    Response resp1 = uploadFile("duplicate.pdf", content, "First Upload", null);
    Response resp2 = uploadFile("duplicate.pdf", content, "Second Upload", null);

    String body1 = resp1.readEntity(String.class);
    String body2 = resp2.readEntity(String.class);

    assertEquals(CREATED.getStatusCode(), resp1.getStatus(), "First upload failed: " + body1);
    assertEquals(CREATED.getStatusCode(), resp2.getStatus(), "Second upload failed: " + body2);

    ContextFile file1 = JsonUtils.readValue(body1, ContextFile.class);
    ContextFile file2 = JsonUtils.readValue(body2, ContextFile.class);

    assertTrue(
        !file1.getId().equals(file2.getId()), "Two uploads of same filename should get unique IDs");
    assertTrue(
        !file1.getName().equals(file2.getName()),
        "Two uploads of same filename should get unique names");
    assertNotNull(file1.getHeadContentId());
    assertNotNull(file2.getHeadContentId());
  }

  @Test
  void testUploadLargeFileRejected(TestNamespace ns) throws Exception {
    Response response =
        uploadFile("too_large.jpg", readFixture("/2mb-jpg-example-file.jpg"), "Too Large", null);

    assertTrue(
        response.getStatus() >= 400,
        "Oversized upload should be rejected, got " + response.getStatus());
  }

  @Test
  void testUploadDetectsFileType(TestNamespace ns) throws Exception {
    Response pdfResp = uploadFixture("/drive/sample-report.pdf", "PDF Test");
    ContextFile pdf = JsonUtils.readValue(pdfResp.readEntity(String.class), ContextFile.class);

    Response csvResp = uploadFixture("/drive/sample-data.csv", "CSV Test");
    ContextFile csv = JsonUtils.readValue(csvResp.readEntity(String.class), ContextFile.class);

    Response spreadsheetResp = uploadFixture("/drive/sample-pricing.xlsx", "Spreadsheet Test");
    ContextFile spreadsheet =
        JsonUtils.readValue(spreadsheetResp.readEntity(String.class), ContextFile.class);

    Response textResp = uploadFixture("/drive/sample-notes.txt", "Text Test");
    ContextFile text = JsonUtils.readValue(textResp.readEntity(String.class), ContextFile.class);

    assertEquals(ContextFileType.PDF, pdf.getFileType());
    assertEquals(ContextFileType.CSV, csv.getFileType());
    assertEquals(ContextFileType.Spreadsheet, spreadsheet.getFileType());
    assertEquals(ContextFileType.Text, text.getFileType());
  }

  @Test
  void testDownloadUploadedFileThroughContextFileEndpoint(TestNamespace ns) throws Exception {
    byte[] content = readFixture("/drive/sample-notes.txt");

    Response uploadResponse = uploadFixture("/drive/sample-notes.txt", "Download Test");
    String body = uploadResponse.readEntity(String.class);
    assertEquals(CREATED.getStatusCode(), uploadResponse.getStatus(), "Upload failed: " + body);

    ContextFile file = JsonUtils.readValue(body, ContextFile.class);

    await()
        .pollDelay(Duration.ZERO)
        .pollInterval(Duration.ofMillis(200))
        .atMost(Duration.ofSeconds(20))
        .untilAsserted(
            () -> {
              try (Response downloadResponse =
                      multipartClient
                          .target(
                              serverBaseUrl
                                  + "/api/v1/drive/files/"
                                  + file.getId()
                                  + "/download?redirect=false")
                          .request()
                          .headers(adminAuthHeaders())
                          .get();
                  InputStream downloaded = downloadResponse.readEntity(InputStream.class)) {
                assertEquals(200, downloadResponse.getStatus());
                assertArrayEquals(content, downloaded.readAllBytes());
              }
            });
  }

  @Test
  void testDownloadUploadedFileThroughSignedRedirect(TestNamespace ns) throws Exception {
    byte[] content = readFixture("/drive/sample-notes.txt");

    Response uploadResponse = uploadFixture("/drive/sample-notes.txt", "Redirect Download");
    String body = uploadResponse.readEntity(String.class);
    assertEquals(CREATED.getStatusCode(), uploadResponse.getStatus(), "Upload failed: " + body);

    ContextFile file = JsonUtils.readValue(body, ContextFile.class);

    await()
        .pollDelay(Duration.ZERO)
        .pollInterval(Duration.ofMillis(200))
        .atMost(Duration.ofSeconds(20))
        .untilAsserted(
            () -> {
              try (Response redirectResponse =
                      multipartClient
                          .target(
                              serverBaseUrl + "/api/v1/drive/files/" + file.getId() + "/download")
                          .property(ClientProperties.FOLLOW_REDIRECTS, false)
                          .request()
                          .headers(adminAuthHeaders())
                          .get();
                  Client signedUrlClient = ClientBuilder.newClient()) {
                assertEquals(307, redirectResponse.getStatus());
                String signedUrl = redirectResponse.getHeaderString("Location");
                assertNotNull(signedUrl);

                try (Response signedDownload = signedUrlClient.target(signedUrl).request().get();
                    InputStream downloaded = signedDownload.readEntity(InputStream.class)) {
                  assertEquals(200, signedDownload.getStatus());
                  assertArrayEquals(content, downloaded.readAllBytes());
                }
              }
            });
  }

  @Test
  void testSoftDeletedFileCanDownloadFromTrash(TestNamespace ns) throws Exception {
    byte[] content = readFixture("/drive/sample-notes.txt");
    RestClient rest = RestClient.admin();

    Response uploadResponse = uploadFixture("/drive/sample-notes.txt", "Trash Download");
    String body = uploadResponse.readEntity(String.class);
    assertEquals(CREATED.getStatusCode(), uploadResponse.getStatus(), "Upload failed: " + body);

    ContextFile file = JsonUtils.readValue(body, ContextFile.class);
    rest.delete("v1/drive/files", file.getId());

    try (Response downloadResponse =
            multipartClient
                .target(
                    serverBaseUrl
                        + "/api/v1/drive/files/"
                        + file.getId()
                        + "/download?include=all&redirect=false")
                .request()
                .headers(adminAuthHeaders())
                .get();
        InputStream downloaded = downloadResponse.readEntity(InputStream.class)) {
      assertEquals(200, downloadResponse.getStatus());
      assertArrayEquals(content, downloaded.readAllBytes());
    }
  }

  @Test
  void testHardDeleteRemovesObjectFromMinIO(TestNamespace ns) throws Exception {
    byte[] content = readFixture("/drive/sample-notes.txt");
    RestClient rest = RestClient.admin();

    Response uploadResponse = uploadFixture("/drive/sample-notes.txt", "Hard Delete");
    String body = uploadResponse.readEntity(String.class);
    assertEquals(CREATED.getStatusCode(), uploadResponse.getStatus(), "Upload failed: " + body);

    ContextFile file = JsonUtils.readValue(body, ContextFile.class);
    assertStoredInMinIO(file.getAssetId(), content);

    rest.hardDelete("v1/drive/files", file.getId());

    await()
        .atMost(Duration.ofSeconds(10))
        .untilAsserted(
            () -> {
              try (Response deletedResponse =
                  rest.rawGet("v1/drive/files/" + file.getId() + "?include=all")) {
                assertEquals(404, deletedResponse.getStatus());
              }
            });
    assertRemovedFromMinIO(file.getAssetId());
  }
}

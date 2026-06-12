package org.openmetadata.it.drive;

import static jakarta.ws.rs.core.Response.Status.CREATED;
import static org.awaitility.Awaitility.await;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.junit.jupiter.api.Assumptions.assumeTrue;

import com.fasterxml.jackson.databind.JsonNode;
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
import java.io.ByteArrayInputStream;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.glassfish.jersey.client.ClientProperties;
import org.glassfish.jersey.media.multipart.FormDataMultiPart;
import org.glassfish.jersey.media.multipart.MultiPartFeature;
import org.glassfish.jersey.media.multipart.file.StreamDataBodyPart;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.openmetadata.it.bootstrap.LlmStubServer;
import org.openmetadata.it.bootstrap.TestSuiteBootstrap;
import org.openmetadata.schema.entity.context.ContextMemory;
import org.openmetadata.schema.entity.context.ContextMemorySourceType;
import org.openmetadata.schema.entity.data.ContextFile;
import org.openmetadata.schema.entity.data.ProcessingStatus;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.sdk.test.util.RestClient;
import org.openmetadata.sdk.test.util.SdkClients;
import org.openmetadata.sdk.test.util.TestNamespace;
import org.openmetadata.sdk.test.util.TestNamespaceExtension;

/**
 * End-to-end test for the Company Context pipeline: upload a Context Center file, the async
 * pipeline extracts text then (when an LLM provider is configured) knowledge pills, stored as
 * {@link ContextMemory} rows linked back to the file via {@code sourceFile}.
 *
 * <p>Pill assertions are skipped (via {@link org.junit.jupiter.api.Assumptions}) when the server
 * has {@code llmConfiguration.enabled=false} (the default), since no pills are produced then. The
 * text-extraction path to {@code Processed} is always asserted.
 */
@ExtendWith(TestNamespaceExtension.class)
class CompanyContextPipelineIT {

  private static String serverBaseUrl;
  private static Client multipartClient;
  private static WebTarget uploadTarget;

  @BeforeAll
  static void setup() {
    String itBaseUrl =
        System.getProperty(
            "IT_BASE_URL",
            System.getenv().getOrDefault("IT_BASE_URL", "http://localhost:8585/api"));
    serverBaseUrl =
        itBaseUrl.endsWith("/api") ? itBaseUrl.substring(0, itBaseUrl.length() - 4) : itBaseUrl;

    multipartClient = ClientBuilder.newClient();
    multipartClient.register(MultiPartFeature.class);
    multipartClient.register(new JacksonFeature(Jackson.newObjectMapper()));
    uploadTarget =
        multipartClient
            .target(serverBaseUrl + "/api/v1/contextCenter/drive/files/upload")
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

  @Test
  void fileUploadProducesLinkedKnowledgePills(TestNamespace ns) throws Exception {
    String text =
        "Our refund policy allows customers to return any product within 30 days for a full "
            + "refund. The primary data warehouse is Google BigQuery. The support team SLA is to "
            + "respond to all tickets within 24 hours. "
            + LlmStubServer.PILL_TRIGGER;

    ContextFile file = upload(ns.prefix("company-policy") + ".txt", text);

    await()
        .pollInterval(Duration.ofMillis(500))
        .atMost(Duration.ofSeconds(45))
        .untilAsserted(
            () ->
                assertEquals(
                    ProcessingStatus.Processed, fetchFile(file.getId()).getProcessingStatus()));

    boolean stubLlm = TestSuiteBootstrap.isLlmStubEnabled();
    int memoryCount = awaitMemoryCount(file.getId(), stubLlm);

    List<ContextMemory> pills = pillsForFile(file.getId());
    assertEquals(memoryCount, pills.size(), "memoryCount should match the linked pills");
    for (ContextMemory pill : pills) {
      assertEquals(ContextMemorySourceType.FILE_EXTRACTION, pill.getSourceType());
      assertNotNull(pill.getSourceFile(), "pill must reference its source file");
      assertEquals(file.getId(), pill.getSourceFile().getId());
      assertTrue(pill.getQuestion() != null && !pill.getQuestion().isBlank());
      assertTrue(pill.getAnswer() != null && !pill.getAnswer().isBlank());
    }

    if (stubLlm) {
      assertStubPillsPresent(pills);
    }
  }

  /**
   * Resolves the file's derived {@code memoryCount}. With the embedded LLM stub active the pipeline
   * is deterministic, so this hard-asserts the exact canned pill count (polling defensively for the
   * derived field); otherwise it preserves the legacy lenient skip for servers without an LLM.
   */
  private int awaitMemoryCount(UUID fileId, boolean stubLlm) throws Exception {
    int result;
    if (stubLlm) {
      int expected = LlmStubServer.EXPECTED_PILLS.size();
      await()
          .pollInterval(Duration.ofMillis(500))
          .atMost(Duration.ofSeconds(20))
          .untilAsserted(
              () ->
                  assertEquals(
                      expected,
                      memoryCountOf(fetchFile(fileId)),
                      "embedded LLM stub should produce exactly the canned knowledge pills"));
      result = expected;
    } else {
      int memoryCount = memoryCountOf(fetchFile(fileId));
      assumeTrue(
          memoryCount > 0,
          "Server has no LLM provider configured (llmConfiguration.enabled=false); "
              + "skipping knowledge-pill assertions.");
      result = memoryCount;
    }
    return result;
  }

  private static int memoryCountOf(ContextFile file) {
    return file.getMemoryCount() == null ? 0 : file.getMemoryCount();
  }

  private void assertStubPillsPresent(List<ContextMemory> pills) {
    Map<String, String> answersByQuestion = new HashMap<>();
    for (ContextMemory pill : pills) {
      answersByQuestion.put(pill.getQuestion(), pill.getAnswer());
    }
    for (LlmStubServer.ExpectedPill expected : LlmStubServer.EXPECTED_PILLS) {
      assertEquals(
          expected.answer(),
          answersByQuestion.get(expected.question()),
          "stub pill answer mismatch for question: " + expected.question());
    }
  }

  private ContextFile upload(String fileName, String content) throws Exception {
    try (FormDataMultiPart multipart = new FormDataMultiPart()) {
      multipart.field("displayName", fileName);
      multipart.bodyPart(
          new StreamDataBodyPart(
              "file",
              new ByteArrayInputStream(content.getBytes(StandardCharsets.UTF_8)),
              fileName,
              MediaType.APPLICATION_OCTET_STREAM_TYPE));
      try (Response response =
          uploadTarget
              .request()
              .headers(adminAuthHeaders())
              .post(Entity.entity(multipart, multipart.getMediaType()))) {
        String body = response.readEntity(String.class);
        assertEquals(CREATED.getStatusCode(), response.getStatus(), "Upload failed: " + body);
        return JsonUtils.readValue(body, ContextFile.class);
      }
    }
  }

  private ContextFile fetchFile(UUID fileId) throws Exception {
    return RestClient.admin()
        .getById("v1/contextCenter/drive/files", fileId, "memoryCount", ContextFile.class);
  }

  private List<ContextMemory> pillsForFile(UUID fileId) throws Exception {
    List<ContextMemory> pills = new ArrayList<>();
    try (Response response =
        RestClient.admin().rawGet("v1/contextCenter/memories?fields=sourceFile&limit=1000")) {
      JsonNode data =
          JsonUtils.getObjectMapper().readTree(response.readEntity(String.class)).get("data");
      if (data != null) {
        for (JsonNode node : data) {
          ContextMemory memory =
              JsonUtils.getObjectMapper().convertValue(node, ContextMemory.class);
          if (memory.getSourceFile() != null && fileId.equals(memory.getSourceFile().getId())) {
            pills.add(memory);
          }
        }
      }
    }
    return pills;
  }

  private static MultivaluedMap<String, Object> adminAuthHeaders() {
    MultivaluedMap<String, Object> headers = new MultivaluedHashMap<>();
    headers.add("Authorization", "Bearer " + SdkClients.getAdminToken());
    return headers;
  }
}

package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.junit.jupiter.api.Assumptions.assumeFalse;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.factories.UserTestFactory;
import org.openmetadata.it.util.OssTestServer;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.context.CreateContextMemory;
import org.openmetadata.schema.api.data.CreateContextFile;
import org.openmetadata.schema.entity.context.ContextMemory;
import org.openmetadata.schema.entity.context.ContextMemoryStatus;
import org.openmetadata.schema.entity.context.MemoryShareConfig;
import org.openmetadata.schema.entity.context.MemoryVisibility;
import org.openmetadata.schema.entity.data.ContextFile;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.network.HttpMethod;
import org.openmetadata.sdk.services.context.ContextMemoryService;
import org.openmetadata.service.Entity;

/**
 * {@code /history} decides each snapshot of a memory or file on the entity as it is now, as its
 * other reads do: one made private no longer shows the versions it was shared in.
 */
@Execution(ExecutionMode.CONCURRENT)
@ExtendWith(TestNamespaceExtension.class)
class ContextHistoryVisibilityIT {
  private static final ObjectMapper MAPPER = new ObjectMapper();
  private static final String MEMORIES = "/v1/contextCenter/memories";
  private static final String FILES = "/v1/contextCenter/drive/files";
  private static final JsonNode MAKE_PRIVATE =
      JsonUtils.readTree(
          "[{\"op\":\"add\",\"path\":\"/shareConfig\",\"value\":{\"visibility\":\"Private\"}}]");

  @Test
  void aMemoryMadePrivateLeavesTheHistoryOfOtherUsers(TestNamespace ns) throws Exception {
    assumeFalse(OssTestServer.isExternalMode(), "Signs the reader's token with the harness key");
    OpenMetadataClient admin = SdkClients.adminClient();
    ContextMemoryService memories = new ContextMemoryService(admin.getHttpClient());
    long startTs = System.currentTimeMillis() - 1000;
    ContextMemory memory =
        ns.trackRoot(
            Entity.CONTEXT_MEMORY,
            memories.create(
                new CreateContextMemory()
                    .withName(ns.prefix("shared-then-private"))
                    .withEntityStatus(ContextMemoryStatus.APPROVED)
                    .withQuestion("Which column holds the order total?")
                    .withAnswer("orders.amount_usd, in US dollars.")
                    .withShareConfig(
                        new MemoryShareConfig().withVisibility(MemoryVisibility.ENTITY))));
    memories.patch(memory.getId(), MAKE_PRIVATE);

    assertSharedVersionHiddenFromOthers(ns, MEMORIES, memory.getId(), startTs, "Entity");
  }

  @Test
  void aFileMadePrivateLeavesTheHistoryOfOtherUsers(TestNamespace ns) throws Exception {
    assumeFalse(OssTestServer.isExternalMode(), "Signs the reader's token with the harness key");
    OpenMetadataClient admin = SdkClients.adminClient();
    long startTs = System.currentTimeMillis() - 1000;
    ContextFile file =
        ns.trackRoot(
            Entity.CONTEXT_FILE,
            admin
                .contextFiles()
                .create(new CreateContextFile().withName(ns.prefix("visible-then-private"))));
    admin.contextFiles().patch(file.getId(), MAKE_PRIVATE);

    assertSharedVersionHiddenFromOthers(ns, FILES, file.getId(), startTs, null);
  }

  /**
   * The admin still reads the version written before the change, which proves there is one to
   * hide, and a user who is neither owner nor admin reads no version at all.
   */
  private static void assertSharedVersionHiddenFromOthers(
      TestNamespace ns, String collection, UUID id, long startTs, String sharedVisibility)
      throws Exception {
    long endTs = System.currentTimeMillis() + 1000;
    List<JsonNode> adminSnapshots =
        snapshotsOf(id, SdkClients.adminClient(), collection, startTs, endTs);
    assertTrue(
        adminSnapshots.stream()
            .anyMatch(
                snapshot ->
                    String.valueOf(sharedVisibility)
                        .equals(snapshot.path("shareConfig").path("visibility").asText("null"))),
        "the version written before the change is missing: " + adminSnapshots);

    User reader = UserTestFactory.createUser(ns, "history_reader");
    OpenMetadataClient asReader =
        SdkClients.createClient(reader.getName(), reader.getEmail(), new String[] {});
    assertEquals(List.of(), snapshotsOf(id, asReader, collection, startTs, endTs));
  }

  private static List<JsonNode> snapshotsOf(
      UUID id, OpenMetadataClient client, String collection, long startTs, long endTs)
      throws Exception {
    List<JsonNode> snapshots = new ArrayList<>();
    String after = null;
    do {
      String path =
          collection
              + "/history?limit=500&startTs="
              + startTs
              + "&endTs="
              + endTs
              + (after == null ? "" : "&after=" + URLEncoder.encode(after, StandardCharsets.UTF_8));
      JsonNode page =
          MAPPER.readTree(client.getHttpClient().executeForString(HttpMethod.GET, path, null));
      page.path("data").forEach(snapshot -> keepIfOf(id, snapshot, snapshots));
      JsonNode next = page.path("paging").path("after");
      after = next.isTextual() ? next.asText() : null;
    } while (after != null);
    return snapshots;
  }

  private static void keepIfOf(UUID id, JsonNode snapshot, List<JsonNode> snapshots) {
    if (id.toString().equals(snapshot.path("id").asText())) {
      snapshots.add(snapshot);
    }
  }
}

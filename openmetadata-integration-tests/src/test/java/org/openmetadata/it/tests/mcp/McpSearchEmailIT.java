package org.openmetadata.it.tests.mcp;

import static org.assertj.core.api.Assertions.assertThat;

import com.fasterxml.jackson.databind.JsonNode;
import java.time.Duration;
import java.util.ArrayDeque;
import java.util.Deque;
import java.util.Map;
import java.util.UUID;
import org.awaitility.Awaitility;
import org.junit.jupiter.api.Assumptions;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.openmetadata.it.util.OssTestServer;

/**
 * search_metadata answers through the same search as the REST API, so a user's email reaches only
 * admins and bots (ADR:2026-11-03-search-applies-the-same-access-rules-as-entity-reads).
 */
public class McpSearchEmailIT extends McpTestBase {
  private static final String EMAIL_DOMAIN = "@test.openmetadata.org";

  @BeforeAll
  static void setUp() throws Exception {
    initAuth();
  }

  @Test
  void searchMetadataReturnsAUsersEmailOnlyToAdmins() throws Exception {
    Assumptions.assumeTrue(
        !OssTestServer.isExternalMode(),
        "Signs the caller's token with the harness key, which a deployed cluster rejects");
    String suffix = UUID.randomUUID().toString().substring(0, 8);
    String listed = "mcp_email_listed_" + suffix;
    String caller = "mcp_email_caller_" + suffix;
    Deque<String> userIds = new ArrayDeque<>();
    try {
      userIds.push(createUser(listed));
      userIds.push(createUser(caller));
      Map<String, Object> search =
          McpTestUtils.createToolCallRequest(
              "search_metadata",
              Map.of("query", listed, "entityType", "user", "fields", "email", "size", 5));

      Awaitility.await("an admin finds the user with its email")
          .atMost(Duration.ofSeconds(60))
          .pollInterval(Duration.ofSeconds(2))
          .untilAsserted(
              () ->
                  assertThat(resultText(executeMcpRequest(search)))
                      .contains(listed + EMAIL_DOMAIN));

      String restricted = resultText(executeMcpRequest(search, "Bearer " + tokenFor(caller)));
      assertThat(restricted).contains(listed).doesNotContain(listed + EMAIL_DOMAIN);
    } finally {
      for (String userId : userIds) {
        deleteResponse("users/" + userId + "?hardDelete=true");
      }
    }
  }

  private static String createUser(String name) throws Exception {
    return post("users", Map.of("name", name, "email", name + EMAIL_DOMAIN), JsonNode.class)
        .get("id")
        .asText();
  }

  private static String resultText(JsonNode response) {
    return response.path("result").path("content").path(0).path("text").asText();
  }
}

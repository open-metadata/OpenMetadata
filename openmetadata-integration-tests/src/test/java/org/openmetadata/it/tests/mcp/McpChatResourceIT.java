package org.openmetadata.it.tests.mcp;

import static org.assertj.core.api.Assertions.assertThat;

import com.fasterxml.jackson.databind.JsonNode;
import java.net.http.HttpResponse;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.auth.JwtAuthProvider;
import org.openmetadata.schema.configuration.LLMBedrockConfig;
import org.openmetadata.schema.configuration.LLMConfiguration;
import org.openmetadata.schema.configuration.LLMProvider;
import org.openmetadata.schema.entity.chat.McpConversation;
import org.openmetadata.schema.security.credentials.AWSBaseConfig;
import org.openmetadata.schema.utils.JsonUtils;

@Execution(ExecutionMode.SAME_THREAD)
public class McpChatResourceIT extends McpTestBase {

  private static final String MCP_CLIENT_PATH = "mcp-client";

  @BeforeAll
  static void setUp() throws Exception {
    initAuth();
    ensureMcpChatEnabled();
  }

  private static void ensureMcpChatEnabled() throws Exception {
    Map<String, Object> mcpChat = new HashMap<>();
    mcpChat.put("enabled", true);
    mcpChat.put("systemPrompt", "Test prompt");
    Map<String, Object> aiSettings = new HashMap<>();
    aiSettings.put("enabled", true);
    aiSettings.put("mcpChat", mcpChat);
    Map<String, Object> settings = new HashMap<>();
    settings.put("config_type", "aiSettings");
    settings.put("config_value", aiSettings);

    put("system/settings", settings, Object.class);
  }

  @Test
  void testMcpChatEnabledInSettings() throws Exception {
    JsonNode settings = get("system/settings/aiSettings", JsonNode.class);
    JsonNode mcpChat = settings.get("config_value").get("mcpChat");

    assertThat(mcpChat.get("enabled").asBoolean()).isTrue();
    assertThat(mcpChat.get("systemPrompt").asText()).isEqualTo("Test prompt");
  }

  @Test
  void testLlmConfigurationDeserialization() throws Exception {
    LLMConfiguration config =
        new LLMConfiguration()
            .withEnabled(true)
            .withProvider(LLMProvider.BEDROCK)
            .withBedrock(
                new LLMBedrockConfig()
                    .withModelId("anthropic.claude-sonnet-4-20250514-v1:0")
                    .withAwsConfig(new AWSBaseConfig().withRegion("us-east-1")));

    String json = JsonUtils.pojoToJson(config);
    LLMConfiguration deserialized = JsonUtils.readValue(json, LLMConfiguration.class);

    assertThat(deserialized.getProvider()).isEqualTo(LLMProvider.BEDROCK);
    assertThat(deserialized.getBedrock()).isNotNull();
    assertThat(deserialized.getBedrock().getAwsConfig().getRegion()).isEqualTo("us-east-1");
  }

  @Test
  void testCreateConversation() throws Exception {
    McpConversation conversation = createConversation();

    assertThat(conversation).isNotNull();
    assertThat(conversation.getId()).isNotNull();
    assertThat(conversation.getMessageCount()).isZero();
  }

  @Test
  void testListConversations() throws Exception {
    McpConversation created = createConversation();

    JsonNode result = get(MCP_CLIENT_PATH + "/conversations?limit=50", JsonNode.class);

    assertThat(result.has("data")).isTrue();
    assertThat(result.get("data").isArray()).isTrue();

    boolean found = false;
    for (JsonNode conv : result.get("data")) {
      if (conv.get("id").asText().equals(created.getId().toString())) {
        found = true;
        break;
      }
    }
    assertThat(found).isTrue();
  }

  @Test
  void testGetConversationById() throws Exception {
    McpConversation created = createConversation();

    McpConversation fetched =
        get(MCP_CLIENT_PATH + "/conversations/" + created.getId(), McpConversation.class);

    assertThat(fetched.getId()).isEqualTo(created.getId());
    assertThat(fetched.getMessageCount()).isZero();
  }

  @Test
  void testGetConversationMessages_empty() throws Exception {
    McpConversation created = createConversation();

    JsonNode result =
        get(MCP_CLIENT_PATH + "/conversations/" + created.getId() + "/messages", JsonNode.class);

    assertThat(result.has("data")).isTrue();
    assertThat(result.get("data").isArray()).isTrue();
    assertThat(result.get("data").size()).isZero();
  }

  @Test
  void testDeleteConversation() throws Exception {
    McpConversation created = createConversation();

    HttpResponse<String> deleteResp =
        deleteResponse(MCP_CLIENT_PATH + "/conversations/" + created.getId());
    assertThat(deleteResp.statusCode()).isEqualTo(204);

    HttpResponse<String> getResp =
        getResponse(MCP_CLIENT_PATH + "/conversations/" + created.getId(), authToken);
    assertThat(getResp.statusCode()).isGreaterThanOrEqualTo(400);
  }

  @Nested
  class ConversationIsolation {

    private static String otherUserToken;

    @BeforeAll
    static void setUpOtherUser() {
      otherUserToken =
          "Bearer "
              + JwtAuthProvider.tokenFor(
                  "test@open-metadata.org", "test@open-metadata.org", new String[] {}, 3600);
    }

    @Test
    void getConversationByIdIsBlockedForOtherUser() throws Exception {
      McpConversation created = createConversation();

      HttpResponse<String> resp =
          getResponse(MCP_CLIENT_PATH + "/conversations/" + created.getId(), otherUserToken);

      assertThat(resp.statusCode()).isGreaterThanOrEqualTo(400);
    }

    @Test
    void listConversationsDoesNotExposeOtherUsersData() throws Exception {
      McpConversation adminConversation = createConversation();

      HttpResponse<String> resp =
          getResponse(MCP_CLIENT_PATH + "/conversations?limit=100", otherUserToken);
      assertThat(resp.statusCode()).isEqualTo(200);

      JsonNode result = OBJECT_MAPPER.readTree(resp.body());
      assertThat(result.has("data")).isTrue();

      for (JsonNode conv : result.get("data")) {
        assertThat(conv.get("id").asText())
            .as("Other user should never see admin's conversation")
            .isNotEqualTo(adminConversation.getId().toString());
      }
    }

    @Test
    void getMessagesIsBlockedForOtherUser() throws Exception {
      McpConversation created = createConversation();

      HttpResponse<String> resp =
          getResponse(
              MCP_CLIENT_PATH + "/conversations/" + created.getId() + "/messages", otherUserToken);

      assertThat(resp.statusCode()).isGreaterThanOrEqualTo(400);
    }

    @Test
    void deleteConversationIsBlockedForOtherUser() throws Exception {
      McpConversation created = createConversation();

      HttpResponse<String> deleteResp =
          deleteResponse(MCP_CLIENT_PATH + "/conversations/" + created.getId(), otherUserToken);

      assertThat(deleteResp.statusCode()).isGreaterThanOrEqualTo(400);

      McpConversation stillExists =
          get(MCP_CLIENT_PATH + "/conversations/" + created.getId(), McpConversation.class);
      assertThat(stillExists.getId()).isEqualTo(created.getId());
    }

    @Test
    void chatOnExistingConversationIsBlockedForOtherUser() throws Exception {
      McpConversation created = createConversation();

      Map<String, Object> chatRequest = new HashMap<>();
      chatRequest.put("conversationId", created.getId().toString());
      chatRequest.put("message", "Hello from another user");

      HttpResponse<String> resp =
          postResponse(MCP_CLIENT_PATH + "/chat", chatRequest, otherUserToken);

      assertThat(resp.statusCode()).isGreaterThanOrEqualTo(400);
    }

    @Test
    void eachUserSeesOnlyOwnConversations() throws Exception {
      McpConversation adminConversation = createConversation();

      HttpResponse<String> otherCreateResp =
          postResponse(MCP_CLIENT_PATH + "/conversations", new HashMap<>(), otherUserToken);
      assertThat(otherCreateResp.statusCode()).isIn(200, 201);
      McpConversation otherConversation =
          OBJECT_MAPPER.readValue(otherCreateResp.body(), McpConversation.class);

      JsonNode adminList = get(MCP_CLIENT_PATH + "/conversations?limit=100", JsonNode.class);
      boolean adminSeesOwn = false;
      boolean adminSeesOther = false;
      for (JsonNode conv : adminList.get("data")) {
        String id = conv.get("id").asText();
        if (id.equals(adminConversation.getId().toString())) {
          adminSeesOwn = true;
        }
        if (id.equals(otherConversation.getId().toString())) {
          adminSeesOther = true;
        }
      }
      assertThat(adminSeesOwn).as("Admin should see own conversation").isTrue();
      assertThat(adminSeesOther).as("Admin should not see other user's conversation").isFalse();

      HttpResponse<String> otherListResp =
          getResponse(MCP_CLIENT_PATH + "/conversations?limit=100", otherUserToken);
      JsonNode otherList = OBJECT_MAPPER.readTree(otherListResp.body());
      boolean otherSeesOwn = false;
      boolean otherSeesAdmin = false;
      for (JsonNode conv : otherList.get("data")) {
        String id = conv.get("id").asText();
        if (id.equals(otherConversation.getId().toString())) {
          otherSeesOwn = true;
        }
        if (id.equals(adminConversation.getId().toString())) {
          otherSeesAdmin = true;
        }
      }
      assertThat(otherSeesOwn).as("Other user should see own conversation").isTrue();
      assertThat(otherSeesAdmin).as("Other user should not see admin's conversation").isFalse();

      deleteResponse(
          MCP_CLIENT_PATH + "/conversations/" + otherConversation.getId(), otherUserToken);
    }
  }

  @Test
  void testChatSucceedsWhenLlmConfigured() throws Exception {
    Map<String, Object> chatRequest = new HashMap<>();
    chatRequest.put("message", "Hello");

    HttpResponse<String> resp = postResponse(MCP_CLIENT_PATH + "/chat", chatRequest, authToken);

    // The embedded suite configures an in-JVM stub LLM (see TestSuiteBootstrap / LlmStubServer),
    // so chat is enabled end to end and returns a completion, rather than the 500 raised by
    // requireChatEnabled() when llmConfiguration is absent.
    assertThat(resp.statusCode()).isEqualTo(200);
  }

  @Test
  void testGetNonExistentConversation() throws Exception {
    UUID randomId = UUID.randomUUID();

    HttpResponse<String> resp =
        getResponse(MCP_CLIENT_PATH + "/conversations/" + randomId, authToken);

    assertThat(resp.statusCode()).isGreaterThanOrEqualTo(400);
  }

  private McpConversation createConversation() throws Exception {
    return post(MCP_CLIENT_PATH + "/conversations", new HashMap<>(), McpConversation.class);
  }
}

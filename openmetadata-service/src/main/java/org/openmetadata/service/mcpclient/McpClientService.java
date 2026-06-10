/*
 *  Copyright 2025 Collate.
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */
package org.openmetadata.service.mcpclient;

import static org.openmetadata.service.security.DefaultAuthorizer.getSubjectContext;

import jakarta.ws.rs.core.SecurityContext;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.LinkedBlockingQueue;
import java.util.concurrent.ThreadPoolExecutor;
import java.util.concurrent.TimeUnit;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.api.chat.CreateMcpConversation;
import org.openmetadata.schema.api.chat.CreateMcpMessage;
import org.openmetadata.schema.entity.app.internal.McpChatAppConfig;
import org.openmetadata.schema.entity.chat.McpConversation;
import org.openmetadata.schema.entity.chat.McpMessage;
import org.openmetadata.schema.entity.chat.TokenUsage;
import org.openmetadata.schema.entity.chat.content.ChatContentType;
import org.openmetadata.schema.entity.chat.content.MessageBlock;
import org.openmetadata.schema.entity.chat.content.TextMessage;
import org.openmetadata.schema.entity.chat.content.ToolCall;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.clients.llm.LlmClient;
import org.openmetadata.service.clients.llm.LlmClientFactory;
import org.openmetadata.service.clients.llm.LlmException;
import org.openmetadata.service.clients.llm.LlmMessage;
import org.openmetadata.service.clients.llm.LlmResponse;
import org.openmetadata.service.clients.llm.LlmToolCall;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.McpConversationRepository;
import org.openmetadata.service.jdbi3.McpMessageRepository;
import org.openmetadata.service.security.auth.CatalogSecurityContext;

@Slf4j
public class McpClientService implements AutoCloseable {
  private static final int MAX_TOOL_ITERATIONS = 10;
  private static final int LLM_CONTEXT_MESSAGE_LIMIT = 20;
  private static final int CONVERSATION_LOAD_LIMIT = 100;
  private static final int TITLE_EXECUTOR_QUEUE_CAPACITY = 50;

  private static final String TOOLS_UNAVAILABLE_MESSAGE =
      "Tool execution is not available. The MCP Server is not installed or configured.";
  private static final String TOOL_LIMIT_MESSAGE =
      "I was unable to complete the request within the allowed tool call limit.";
  private static final String TOOL_LIMIT_NOTICE =
      "[Response truncated: reached the tool-call limit before completing.]";
  private static final String ERROR_MESSAGE =
      "Sorry, an error occurred while processing your request. Please try again.";

  private final McpConversationRepository conversationRepository;
  private final McpMessageRepository messageRepository;
  private final McpChatAppConfig config;
  private final LlmClient llmClient;
  private final ExecutorService titleExecutor =
      new ThreadPoolExecutor(
          0,
          2,
          60L,
          TimeUnit.SECONDS,
          new LinkedBlockingQueue<>(TITLE_EXECUTOR_QUEUE_CAPACITY),
          runnable -> {
            Thread thread = new Thread(runnable, "mcp-title-gen");
            thread.setDaemon(true);
            return thread;
          },
          new ThreadPoolExecutor.DiscardPolicy());

  private volatile ToolExecutor toolExecutor;
  private volatile List<Map<String, Object>> toolDefinitions = Collections.emptyList();
  private volatile List<Map<String, Object>> lastToolDefinitionsSource;

  public McpClientService(CollectionDAO dao, McpChatAppConfig config) {
    this.conversationRepository = new McpConversationRepository(dao.mcpConversationDAO());
    this.messageRepository = new McpMessageRepository(dao.mcpMessageDAO());
    this.config = config;
    this.llmClient = createLlmClient(config);
  }

  private static LlmClient createLlmClient(McpChatAppConfig config) {
    boolean hasApiKey = config.getLlmApiKey() != null && !config.getLlmApiKey().isBlank();
    boolean hasAwsConfig = config.getAwsConfig() != null;
    LlmClient client = null;
    if (hasApiKey || hasAwsConfig) {
      try {
        client = LlmClientFactory.create(config);
      } catch (IllegalArgumentException e) {
        LOG.error("Failed to initialize LLM client; MCP chat will be disabled: {}", e.getMessage());
      }
    }
    return client;
  }

  public boolean isChatEnabled() {
    return llmClient != null;
  }

  @Override
  public void close() {
    titleExecutor.shutdownNow();
    if (llmClient != null) {
      try {
        llmClient.close();
      } catch (RuntimeException e) {
        LOG.warn("Failed to close LLM client", e);
      }
    }
  }

  public void updateTools(ToolExecutor executor, List<Map<String, Object>> definitions) {
    this.toolExecutor = executor;
    if (definitions != lastToolDefinitionsSource) {
      lastToolDefinitionsSource = definitions;
      this.toolDefinitions = Collections.unmodifiableList(new ArrayList<>(definitions));
    }
  }

  public record ChatResponse(UUID conversationId, McpMessage message) {}

  private record ConversationContext(McpConversation conversation, boolean isNew) {}

  private record ChatTurn(
      String assistantText, List<ToolCall> toolCalls, TokenUsage tokens, boolean hitToolLimit) {}

  public ChatResponse chat(
      SecurityContext securityContext, UUID conversationId, String userMessage) {
    return runChat(securityContext, conversationId, userMessage, ChatEventEmitter.NOOP);
  }

  public void chatStream(
      SecurityContext securityContext,
      UUID conversationId,
      String userMessage,
      ChatEventEmitter emitter) {
    runChat(securityContext, conversationId, userMessage, emitter);
  }

  private ChatResponse runChat(
      SecurityContext securityContext,
      UUID conversationId,
      String userMessage,
      ChatEventEmitter emitter) {
    requireChatEnabled();
    EntityReference userRef = getSubjectContext(securityContext).user().getEntityReference();
    ConversationContext context =
        openConversation(securityContext, conversationId, userRef, emitter);
    McpConversation conversation = context.conversation();
    int messageIndex =
        storeUserMessage(conversation.getId(), userMessage, conversation.getMessageCount());

    ChatResponse result;
    try {
      ChatTurn turn = generateAssistantTurn(securityContext, conversation.getId(), emitter);
      McpMessage assistantMessage = storeAssistantMessage(conversation.getId(), turn, messageIndex);
      finalizeConversation(
          conversation, userRef, userMessage, context.isNew(), messageIndex + 1, emitter);
      emitter.emit(ChatEvent.messageComplete(assistantMessage));
      emitter.emit(ChatEvent.done());
      result = new ChatResponse(conversation.getId(), assistantMessage);
    } catch (ClientDisconnectedException e) {
      result = handleDisconnect(conversation, userRef, messageIndex);
    }
    return result;
  }

  private ConversationContext openConversation(
      SecurityContext securityContext,
      UUID conversationId,
      EntityReference userRef,
      ChatEventEmitter emitter) {
    ConversationContext context;
    if (conversationId == null) {
      McpConversation created = conversationRepository.create(new CreateMcpConversation(), userRef);
      emitter.emit(ChatEvent.conversationCreated(created.getId()));
      context = new ConversationContext(created, true);
    } else {
      context = new ConversationContext(getConversation(securityContext, conversationId), false);
    }
    return context;
  }

  private ChatTurn generateAssistantTurn(
      SecurityContext securityContext, UUID conversationId, ChatEventEmitter emitter) {
    CatalogSecurityContext catalogContext = toCatalogSecurityContext(securityContext);
    List<LlmMessage> llmMessages = buildLlmMessages(conversationId);
    ChatTurn turn;
    try {
      turn = runToolLoop(llmMessages, catalogContext, emitter);
    } catch (LlmException e) {
      LOG.error("LLM call failed for conversation {}", conversationId, e);
      emitter.emit(ChatEvent.error(ERROR_MESSAGE));
      turn = new ChatTurn(ERROR_MESSAGE, new ArrayList<>(), emptyTokenUsage(), false);
    }
    return turn;
  }

  private ChatTurn runToolLoop(
      List<LlmMessage> llmMessages,
      CatalogSecurityContext catalogContext,
      ChatEventEmitter emitter) {
    ToolExecutor executor = this.toolExecutor;
    List<Map<String, Object>> tools = this.toolDefinitions;
    List<ToolCall> toolCalls = new ArrayList<>();
    StringBuilder textCollector = new StringBuilder();
    int inputTokens = 0;
    int outputTokens = 0;
    boolean completed = false;
    int iteration = 0;
    while (iteration < MAX_TOOL_ITERATIONS && !completed) {
      LlmResponse response =
          llmClient.sendMessagesStreaming(
              llmMessages, tools, chunk -> emitter.emit(ChatEvent.text(chunk)));
      inputTokens += response.inputTokens();
      outputTokens += response.outputTokens();
      appendContent(textCollector, response.content());
      completed =
          applyResponse(
              response, executor, catalogContext, llmMessages, toolCalls, textCollector, emitter);
      iteration++;
    }
    return buildTurn(textCollector, toolCalls, inputTokens, outputTokens, !completed);
  }

  private boolean applyResponse(
      LlmResponse response,
      ToolExecutor executor,
      CatalogSecurityContext catalogContext,
      List<LlmMessage> llmMessages,
      List<ToolCall> toolCalls,
      StringBuilder textCollector,
      ChatEventEmitter emitter) {
    boolean completed;
    if (!response.hasToolCalls()) {
      completed = true;
    } else if (executor == null) {
      appendToolsUnavailable(textCollector);
      completed = true;
    } else {
      llmMessages.add(LlmMessage.assistantWithToolCalls(response.content(), response.toolCalls()));
      executeToolCalls(
          response.toolCalls(), executor, catalogContext, llmMessages, toolCalls, emitter);
      completed = false;
    }
    return completed;
  }

  private void executeToolCalls(
      List<LlmToolCall> toolCalls,
      ToolExecutor executor,
      CatalogSecurityContext catalogContext,
      List<LlmMessage> llmMessages,
      List<ToolCall> collectedCalls,
      ChatEventEmitter emitter) {
    for (LlmToolCall toolCall : toolCalls) {
      Map<String, Object> inputArgs = parseToolArguments(toolCall.arguments());
      emitter.emit(ChatEvent.toolCallStart(toolCall.name(), inputArgs));
      String resultContent = executeToolSafely(executor, catalogContext, toolCall);
      llmMessages.add(LlmMessage.toolResult(toolCall.id(), resultContent));
      Object parsedResult = parseToolResult(resultContent);
      emitter.emit(ChatEvent.toolCallEnd(toolCall.name(), parsedResult));
      collectedCalls.add(
          new ToolCall().withName(toolCall.name()).withInput(inputArgs).withResult(parsedResult));
    }
  }

  private String executeToolSafely(
      ToolExecutor executor, CatalogSecurityContext catalogContext, LlmToolCall toolCall) {
    String result;
    try {
      result = executor.executeTool(catalogContext, toolCall.name(), toolCall.arguments());
    } catch (RuntimeException e) {
      LOG.warn("Tool '{}' execution failed", toolCall.name(), e);
      result = "Tool execution failed: " + e.getMessage();
    }
    return result;
  }

  private ChatTurn buildTurn(
      StringBuilder textCollector,
      List<ToolCall> toolCalls,
      int inputTokens,
      int outputTokens,
      boolean hitToolLimit) {
    if (hitToolLimit) {
      LOG.warn("MCP chat reached the tool-call iteration limit of {}", MAX_TOOL_ITERATIONS);
    }
    String assistantText = resolveAssistantText(textCollector, hitToolLimit);
    TokenUsage tokens =
        new TokenUsage()
            .withInputTokens(inputTokens)
            .withOutputTokens(outputTokens)
            .withTotalTokens(inputTokens + outputTokens);
    return new ChatTurn(assistantText, toolCalls, tokens, hitToolLimit);
  }

  private String resolveAssistantText(StringBuilder textCollector, boolean hitToolLimit) {
    String text;
    if (textCollector.isEmpty()) {
      text = hitToolLimit ? TOOL_LIMIT_MESSAGE : "";
    } else if (hitToolLimit) {
      text = textCollector + "\n\n" + TOOL_LIMIT_NOTICE;
    } else {
      text = textCollector.toString();
    }
    return text;
  }

  private void appendToolsUnavailable(StringBuilder textCollector) {
    if (textCollector.isEmpty()) {
      textCollector.append(TOOLS_UNAVAILABLE_MESSAGE);
    }
  }

  private void appendContent(StringBuilder collector, String content) {
    if (content != null && !content.isBlank()) {
      if (!collector.isEmpty()) {
        collector.append("\n\n");
      }
      collector.append(content);
    }
  }

  private ChatResponse handleDisconnect(
      McpConversation conversation, EntityReference userRef, int messageCount) {
    LOG.info("Client disconnected during MCP chat for conversation {}", conversation.getId());
    conversation.setMessageCount(messageCount);
    conversation.setUpdatedBy(userRef.getName());
    conversationRepository.update(conversation);
    return null;
  }

  private int storeUserMessage(UUID conversationId, String userMessage, int messageIndex) {
    storeMessage(
        conversationId,
        CreateMcpMessage.Sender.HUMAN,
        List.of(textBlock(userMessage)),
        null,
        messageIndex);
    return messageIndex + 1;
  }

  private McpMessage storeAssistantMessage(UUID conversationId, ChatTurn turn, int messageIndex) {
    MessageBlock block = textBlock(turn.assistantText()).withTools(turn.toolCalls());
    return storeMessage(
        conversationId,
        CreateMcpMessage.Sender.ASSISTANT,
        List.of(block),
        turn.tokens(),
        messageIndex);
  }

  private MessageBlock textBlock(String message) {
    return new MessageBlock()
        .withType(ChatContentType.GENERIC)
        .withTextMessage(
            new TextMessage().withType(TextMessage.TextMessageType.MARKDOWN).withMessage(message));
  }

  private void finalizeConversation(
      McpConversation conversation,
      EntityReference userRef,
      String userMessage,
      boolean isNew,
      int messageCount,
      ChatEventEmitter emitter) {
    conversation.setMessageCount(messageCount);
    conversation.setUpdatedBy(userRef.getName());
    boolean needsTitle = isNew && conversation.getTitle() == null;
    if (needsTitle) {
      String quickTitle = truncateTitle(userMessage);
      conversation.setTitle(quickTitle);
      emitter.emit(ChatEvent.titleUpdated(quickTitle));
    }
    conversationRepository.update(conversation);
    if (needsTitle) {
      scheduleTitleGeneration(conversation.getId(), userMessage);
    }
  }

  public McpConversation createConversation(
      SecurityContext securityContext, CreateMcpConversation request) {
    EntityReference userRef = getSubjectContext(securityContext).user().getEntityReference();
    return conversationRepository.create(
        request != null ? request : new CreateMcpConversation(), userRef);
  }

  public int getConversationCount(SecurityContext securityContext) {
    User user = getSubjectContext(securityContext).user();
    return conversationRepository.countByUser(user.getId());
  }

  public int getMessageCount(SecurityContext securityContext, UUID conversationId) {
    getConversation(securityContext, conversationId);
    return messageRepository.countByConversation(conversationId);
  }

  public McpConversation getConversation(SecurityContext securityContext, UUID conversationId) {
    McpConversation conversation = conversationRepository.getById(conversationId);
    verifyOwnership(securityContext, conversation);
    return conversation;
  }

  public List<McpConversation> listConversations(
      SecurityContext securityContext, int limit, int offset) {
    User user = getSubjectContext(securityContext).user();
    return conversationRepository.listByUser(user.getId(), limit, offset);
  }

  public McpConversation getConversationWithMessages(
      SecurityContext securityContext, UUID conversationId) {
    McpConversation conversation = getConversation(securityContext, conversationId);
    List<McpMessage> messages =
        messageRepository.listRecentByConversation(conversationId, CONVERSATION_LOAD_LIMIT);
    conversation.setMcpMessages(messages);
    return conversation;
  }

  public List<McpMessage> listMessages(
      SecurityContext securityContext, UUID conversationId, int limit, int offset) {
    getConversation(securityContext, conversationId);
    return messageRepository.listByConversation(conversationId, limit, offset);
  }

  public void deleteConversation(SecurityContext securityContext, UUID conversationId) {
    getConversation(securityContext, conversationId);
    messageRepository.deleteByConversation(conversationId);
    conversationRepository.delete(conversationId);
  }

  private McpMessage storeMessage(
      UUID conversationId,
      CreateMcpMessage.Sender sender,
      List<MessageBlock> content,
      TokenUsage tokens,
      int messageIndex) {
    CreateMcpMessage createMessage =
        new CreateMcpMessage()
            .withSender(sender)
            .withContent(content)
            .withTimestamp(System.currentTimeMillis())
            .withTokens(tokens);
    return messageRepository.create(createMessage, conversationId, messageIndex);
  }

  private List<LlmMessage> buildLlmMessages(UUID conversationId) {
    List<LlmMessage> llmMessages = new ArrayList<>();
    llmMessages.add(LlmMessage.system(config.getSystemPrompt()));

    List<McpMessage> history =
        messageRepository.listRecentByConversation(conversationId, LLM_CONTEXT_MESSAGE_LIMIT);

    for (McpMessage msg : history) {
      boolean isHuman = msg.getSender() == CreateMcpMessage.Sender.HUMAN;
      LlmMessage.Role role = isHuman ? LlmMessage.Role.user : LlmMessage.Role.assistant;

      String textContent = extractTextFromMessage(msg);
      if (!isHuman) {
        String toolSummary = extractToolSummaryFromMessage(msg);
        if (toolSummary != null) {
          String combined =
              (textContent != null ? textContent + "\n\n" : "")
                  + "[Tools used: "
                  + toolSummary
                  + "]";
          llmMessages.add(new LlmMessage(role, combined, null, null));
          continue;
        }
      }
      if (textContent != null) {
        llmMessages.add(new LlmMessage(role, textContent, null, null));
      }
    }

    return llmMessages;
  }

  private String extractTextFromMessage(McpMessage message) {
    String text = null;
    if (message.getContent() != null) {
      for (MessageBlock block : message.getContent()) {
        if (text == null
            && block.getTextMessage() != null
            && block.getTextMessage().getMessage() != null) {
          text = block.getTextMessage().getMessage();
        }
      }
    }
    return text;
  }

  private String extractToolSummaryFromMessage(McpMessage message) {
    List<String> toolNames = new ArrayList<>();
    if (message.getContent() != null) {
      for (MessageBlock block : message.getContent()) {
        if (block.getTools() != null) {
          for (ToolCall tc : block.getTools()) {
            toolNames.add(tc.getName());
          }
        }
      }
    }
    return toolNames.isEmpty() ? null : String.join(", ", toolNames);
  }

  @SuppressWarnings("unchecked")
  private Map<String, Object> parseToolArguments(String arguments) {
    Map<String, Object> parsed = new HashMap<>();
    if (arguments != null && !arguments.isBlank()) {
      try {
        parsed = JsonUtils.readValue(arguments, Map.class);
      } catch (RuntimeException e) {
        LOG.warn("Failed to parse tool arguments: {}", arguments, e);
      }
    }
    return parsed;
  }

  private Object parseToolResult(String resultContent) {
    Object parsed;
    if (resultContent == null || resultContent.isBlank()) {
      parsed = Collections.emptyMap();
    } else {
      parsed = readToolResultJson(resultContent);
    }
    return parsed;
  }

  private Object readToolResultJson(String resultContent) {
    Object parsed;
    try {
      parsed = JsonUtils.readValue(resultContent, Object.class);
    } catch (RuntimeException e) {
      parsed = resultContent;
    }
    return parsed;
  }

  private void verifyOwnership(SecurityContext securityContext, McpConversation conversation) {
    User user = getSubjectContext(securityContext).user();
    if (!conversation.getUser().getId().equals(user.getId())) {
      throw new EntityNotFoundException("Conversation not found: " + conversation.getId());
    }
  }

  private CatalogSecurityContext toCatalogSecurityContext(SecurityContext securityContext) {
    return new CatalogSecurityContext(
        securityContext.getUserPrincipal(),
        securityContext.isSecure() ? "https" : "http",
        securityContext.getAuthenticationScheme(),
        Collections.emptySet());
  }

  private void requireChatEnabled() {
    if (llmClient == null) {
      throw new IllegalStateException(
          "LLM API key is not configured. Update the McpApplication configuration with a valid API key.");
    }
  }

  private TokenUsage emptyTokenUsage() {
    return new TokenUsage().withInputTokens(0).withOutputTokens(0).withTotalTokens(0);
  }

  private void scheduleTitleGeneration(UUID conversationId, String userMessage) {
    titleExecutor.execute(() -> generateAndPersistTitle(conversationId, userMessage));
  }

  private void generateAndPersistTitle(UUID conversationId, String userMessage) {
    try {
      String title = generateTitle(userMessage);
      if (title != null) {
        McpConversation conversation = conversationRepository.getById(conversationId);
        conversation.setTitle(title);
        conversationRepository.update(conversation);
      }
    } catch (RuntimeException e) {
      LOG.warn("Failed to update conversation title for {}", conversationId, e);
    }
  }

  private String generateTitle(String userMessage) {
    String title;
    try {
      List<LlmMessage> titleMessages =
          List.of(
              LlmMessage.system(
                  "Generate a short title (5-7 words max) for a conversation starting with this"
                      + " message. Reply with only the title text, no quotes or extra"
                      + " punctuation."),
              LlmMessage.user(userMessage));
      LlmResponse response = llmClient.sendMessages(titleMessages, null);
      title = normalizeTitle(response.content());
    } catch (LlmException e) {
      LOG.warn("Failed to generate conversation title", e);
      title = truncateTitle(userMessage);
    }
    return title;
  }

  private String normalizeTitle(String title) {
    String normalized = title;
    if (normalized != null) {
      normalized = normalized.trim().replaceAll("^\"|\"$", "");
      if (normalized.length() > 100) {
        normalized = normalized.substring(0, 97) + "...";
      }
    }
    return normalized;
  }

  private String truncateTitle(String message) {
    String truncated = null;
    if (message != null) {
      truncated = message.length() > 100 ? message.substring(0, 97) + "..." : message;
    }
    return truncated;
  }
}

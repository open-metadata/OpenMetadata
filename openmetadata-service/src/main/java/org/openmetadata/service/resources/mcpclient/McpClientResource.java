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
package org.openmetadata.service.resources.mcpclient;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.DELETE;
import jakarta.ws.rs.DefaultValue;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.QueryParam;
import jakarta.ws.rs.WebApplicationException;
import jakarta.ws.rs.core.Context;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import jakarta.ws.rs.core.SecurityContext;
import jakarta.ws.rs.core.StreamingOutput;
import java.io.IOException;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.api.chat.CreateMcpConversation;
import org.openmetadata.schema.entity.chat.McpConversation;
import org.openmetadata.schema.entity.chat.McpMessage;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.schema.utils.ResultList;
import org.openmetadata.service.limits.Limits;
import org.openmetadata.service.mcpclient.ChatEvent;
import org.openmetadata.service.mcpclient.ClientDisconnectedException;
import org.openmetadata.service.mcpclient.McpChatServiceHolder;
import org.openmetadata.service.mcpclient.McpClientService;
import org.openmetadata.service.mcpclient.McpClientService.ChatResponse;
import org.openmetadata.service.mcpclient.ToolExecutor;
import org.openmetadata.service.resources.Collection;
import org.openmetadata.service.security.Authorizer;

@Path("/v1/mcp-client")
@Tag(name = "McpClient")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
@Slf4j
@Collection(name = "McpClient")
public class McpClientResource {

  /**
   * JAX-RS instantiates this resource; we publish the singleton so the MCP server (started from a
   * separate module) can hand it the tool executor. The executor is then relayed to the per-app
   * {@link McpClientService} lazily in {@link #getService()}, decoupling tool-registration order
   * from app-installation order.
   */
  private static volatile McpClientResource instance;

  private volatile ToolRegistration toolRegistration;

  record ToolRegistration(ToolExecutor executor, List<Map<String, Object>> definitions) {}

  public static McpClientResource getInstance() {
    return instance;
  }

  @Getter
  @Setter
  public static class ChatRequest {
    private UUID conversationId;

    @NotBlank
    @Size(max = 100000)
    private String message;
  }

  public static class McpConversationList extends ResultList<McpConversation> {}

  public static class McpMessageList extends ResultList<McpMessage> {}

  public McpClientResource(Authorizer authorizer, Limits limits) {
    instance = this;
  }

  public void registerToolExecutor(
      ToolExecutor toolExecutor, List<Map<String, Object>> toolDefinitions) {
    this.toolRegistration = new ToolRegistration(toolExecutor, toolDefinitions);
  }

  @POST
  @Path("/chat")
  @Operation(
      operationId = "mcpClientChat",
      summary = "Chat with the MCP assistant",
      description = "Send a message and get a response from the MCP-powered AI assistant.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Chat response",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = ChatResponse.class))),
        @ApiResponse(responseCode = "400", description = "Bad request")
      })
  public Response chat(@Context SecurityContext securityContext, @Valid ChatRequest request) {
    ChatResponse response =
        getService().chat(securityContext, request.getConversationId(), request.getMessage());
    return Response.ok(response).build();
  }

  @POST
  @Path("/chat/stream")
  @Produces("text/event-stream")
  @Operation(
      operationId = "mcpClientChatStream",
      summary = "Chat with the MCP assistant (streaming)",
      description = "Send a message and get a streaming response via Server-Sent Events.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "SSE event stream",
            content = @Content(mediaType = "text/event-stream")),
        @ApiResponse(responseCode = "400", description = "Bad request")
      })
  public Response chatStream(@Context SecurityContext securityContext, @Valid ChatRequest request) {
    McpClientService service = getService();
    StreamingOutput streamingOutput =
        output -> emitChatStream(service, securityContext, request, output);
    return Response.ok(streamingOutput)
        .type("text/event-stream")
        .header("Cache-Control", "no-cache")
        .header("X-Accel-Buffering", "no")
        .build();
  }

  private static void emitChatStream(
      McpClientService service,
      SecurityContext securityContext,
      ChatRequest request,
      OutputStream output) {
    try {
      service.chatStream(
          securityContext,
          request.getConversationId(),
          request.getMessage(),
          event -> writeSseEvent(output, event.event(), event.data()));
    } catch (ClientDisconnectedException e) {
      LOG.info("MCP chat stream ended: client disconnected");
    } catch (RuntimeException e) {
      LOG.error("MCP chat stream failed", e);
      writeSseEventQuietly(output, "error", ChatEvent.error(e.getMessage()).data());
      writeSseEventQuietly(output, "done", ChatEvent.done().data());
    }
  }

  @POST
  @Path("/conversations")
  @Operation(
      operationId = "createMcpConversation",
      summary = "Create a new conversation",
      description = "Create a new empty MCP conversation.",
      responses = {
        @ApiResponse(
            responseCode = "201",
            description = "Conversation created",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = McpConversation.class))),
        @ApiResponse(responseCode = "400", description = "Bad request")
      })
  public Response createConversation(
      @Context SecurityContext securityContext, @Valid CreateMcpConversation request) {
    McpConversation conversation = getService().createConversation(securityContext, request);
    return Response.status(Response.Status.CREATED).entity(conversation).build();
  }

  @GET
  @Path("/conversations")
  @Operation(
      operationId = "listMcpConversations",
      summary = "List conversations",
      description = "List MCP conversations for the authenticated user.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "List of conversations",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = McpConversationList.class)))
      })
  public ResultList<McpConversation> listConversations(
      @Context SecurityContext securityContext,
      @Parameter(description = "Limit the number of conversations returned")
          @DefaultValue("20")
          @Min(1)
          @Max(100)
          @QueryParam("limit")
          int limit,
      @Parameter(description = "Offset for pagination")
          @DefaultValue("0")
          @Min(0)
          @QueryParam("offset")
          int offset) {
    McpClientService service = getService();
    List<McpConversation> conversations = service.listConversations(securityContext, limit, offset);
    int total = service.getConversationCount(securityContext);
    return new ResultList<>(conversations, offset, total);
  }

  @GET
  @Path("/conversations/{id}")
  @Operation(
      operationId = "getMcpConversation",
      summary = "Get a conversation",
      description = "Get a conversation with its messages populated.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "The conversation",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = McpConversation.class))),
        @ApiResponse(responseCode = "404", description = "Conversation not found")
      })
  public McpConversation getConversation(
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the conversation", schema = @Schema(type = "UUID"))
          @PathParam("id")
          UUID id) {
    return getService().getConversationWithMessages(securityContext, id);
  }

  @GET
  @Path("/conversations/{id}/messages")
  @Operation(
      operationId = "listMcpMessages",
      summary = "List messages in a conversation",
      description = "List messages for a given conversation.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "List of messages",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = McpMessageList.class))),
        @ApiResponse(responseCode = "404", description = "Conversation not found")
      })
  public ResultList<McpMessage> listMessages(
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the conversation", schema = @Schema(type = "UUID"))
          @PathParam("id")
          UUID id,
      @Parameter(description = "Limit the number of messages returned")
          @DefaultValue("50")
          @Min(1)
          @Max(1000)
          @QueryParam("limit")
          int limit,
      @Parameter(description = "Offset for pagination")
          @DefaultValue("0")
          @Min(0)
          @QueryParam("offset")
          int offset) {
    McpClientService service = getService();
    List<McpMessage> messages = service.listMessages(securityContext, id, limit, offset);
    int total = service.getMessageCount(securityContext, id);
    return new ResultList<>(messages, offset, total);
  }

  @DELETE
  @Path("/conversations/{id}")
  @Operation(
      operationId = "deleteMcpConversation",
      summary = "Delete a conversation",
      description = "Delete a conversation and all its messages.",
      responses = {
        @ApiResponse(responseCode = "204", description = "Conversation deleted"),
        @ApiResponse(responseCode = "404", description = "Conversation not found")
      })
  public Response deleteConversation(
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the conversation", schema = @Schema(type = "UUID"))
          @PathParam("id")
          UUID id) {
    getService().deleteConversation(securityContext, id);
    return Response.noContent().build();
  }

  private McpClientService getService() {
    if (!McpChatServiceHolder.isEnabled()) {
      throw new WebApplicationException(
          Response.status(Response.Status.SERVICE_UNAVAILABLE)
              .entity(Map.of("message", "MCP Chat is not enabled. Enable it in AI Settings."))
              .build());
    }
    McpClientService service = McpChatServiceHolder.get();
    if (service == null) {
      throw new WebApplicationException(
          Response.status(Response.Status.SERVICE_UNAVAILABLE)
              .entity(Map.of("message", "MCP Chat service is initializing. Please try again."))
              .build());
    }

    ToolRegistration reg = this.toolRegistration;
    if (reg != null) {
      service.updateTools(reg.executor(), reg.definitions());
    }

    return service;
  }

  private static void writeSseEvent(OutputStream output, String event, Object data) {
    try {
      String json = JsonUtils.pojoToJson(data);
      String frame = "event: " + event + "\ndata: " + json + "\n\n";
      output.write(frame.getBytes(StandardCharsets.UTF_8));
      output.flush();
    } catch (IOException e) {
      throw new ClientDisconnectedException("Failed to write SSE '" + event + "' event", e);
    }
  }

  private static void writeSseEventQuietly(OutputStream output, String event, Object data) {
    try {
      writeSseEvent(output, event, data);
    } catch (ClientDisconnectedException e) {
      LOG.debug("Could not write final SSE '{}' event; client already disconnected", event, e);
    }
  }
}

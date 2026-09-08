/*
 *  Copyright 2025 Collate
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
package org.openmetadata.mcp.server.transport;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import com.fasterxml.jackson.databind.ObjectMapper;
import io.modelcontextprotocol.server.McpStatelessServerHandler;
import io.modelcontextprotocol.spec.McpError;
import io.modelcontextprotocol.spec.McpSchema;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.BufferedReader;
import java.io.PrintWriter;
import java.io.StringReader;
import java.io.StringWriter;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import reactor.core.publisher.Mono;

class HttpServletStatelessServerTransportTest {

  private static final String JSON_RESPONSE = "{\"jsonrpc\":\"2.0\",\"id\":1,\"result\":{}}";

  private HttpServletResponse response;
  private StringWriter body;

  @BeforeEach
  void setUp() throws Exception {
    response = mock(HttpServletResponse.class);
    body = new StringWriter();
    when(response.getWriter()).thenReturn(new PrintWriter(body));
  }

  @Test
  void writeJsonResponse_setsContentTypeAndStatus() throws Exception {
    HttpServletStatelessServerTransport.writeJsonResponse(response, JSON_RESPONSE);

    verify(response).setContentType(HttpServletStatelessServerTransport.APPLICATION_JSON);
    verify(response).setCharacterEncoding(HttpServletStatelessServerTransport.UTF_8);
    verify(response).setStatus(HttpServletResponse.SC_OK);
    assertThat(body.toString()).isEqualTo(JSON_RESPONSE);
  }

  @Test
  void writeSseResponse_emitsSingleSseEvent() throws Exception {
    HttpServletStatelessServerTransport.writeSseResponse(response, JSON_RESPONSE);

    verify(response).setContentType(HttpServletStatelessServerTransport.TEXT_EVENT_STREAM);
    verify(response).setCharacterEncoding(HttpServletStatelessServerTransport.UTF_8);
    verify(response).setStatus(HttpServletResponse.SC_OK);
    assertThat(body.toString()).isEqualTo("data: " + JSON_RESPONSE + "\n\n");
  }

  @Test
  void writeSseResponse_setsStreamingHeaders() throws Exception {
    HttpServletStatelessServerTransport.writeSseResponse(response, JSON_RESPONSE);

    verify(response)
        .setHeader(
            HttpServletStatelessServerTransport.HEADER_CACHE_CONTROL,
            HttpServletStatelessServerTransport.CACHE_CONTROL_NO_CACHE);
    verify(response)
        .setHeader(
            HttpServletStatelessServerTransport.HEADER_CONNECTION,
            HttpServletStatelessServerTransport.CONNECTION_KEEP_ALIVE);
    verify(response)
        .setHeader(
            HttpServletStatelessServerTransport.HEADER_X_ACCEL_BUFFERING,
            HttpServletStatelessServerTransport.X_ACCEL_BUFFERING_NO);
  }

  @Test
  void writeSseResponse_payloadWithNewlines_prefixesEachLine() throws Exception {
    String multiLineJson = "{\n  \"jsonrpc\": \"2.0\"\n}";

    HttpServletStatelessServerTransport.writeSseResponse(response, multiLineJson);

    assertThat(body.toString()).isEqualTo("data: {\ndata:   \"jsonrpc\": \"2.0\"\ndata: }\n\n");
  }

  @Test
  void writeSseResponse_payloadWithCarriageReturnLineFeed_prefixesEachLine() throws Exception {
    String windowsJson = "{\r\n  \"x\": 1\r\n}";

    HttpServletStatelessServerTransport.writeSseResponse(response, windowsJson);

    assertThat(body.toString()).isEqualTo("data: {\ndata:   \"x\": 1\ndata: }\n\n");
  }

  @Test
  void writeJsonResponse_doesNotSetStreamingHeaders() throws Exception {
    HttpServletStatelessServerTransport.writeJsonResponse(response, JSON_RESPONSE);

    verify(response, org.mockito.Mockito.never()).setHeader(anyString(), anyString());
  }

  @Test
  void writeSseResponse_doesNotCallSendError() throws Exception {
    HttpServletStatelessServerTransport.writeSseResponse(response, JSON_RESPONSE);

    verify(response, org.mockito.Mockito.never()).sendError(anyInt());
    verify(response, org.mockito.Mockito.never()).sendError(anyInt(), anyString());
  }

  @Test
  void writeSseResponse_payloadStartsWithDataPrefix_perSseSpec() throws Exception {
    HttpServletStatelessServerTransport.writeSseResponse(response, JSON_RESPONSE);

    String written = body.toString();
    assertThat(written).startsWith("data: ");
    assertThat(written).endsWith("\n\n");
  }

  @Test
  void responseFlush_writerOnly() {
    verifyNoInteractions(response);
  }

  // ── responseError ─────────────────────────────────────────────────────────

  /**
   * Regression guard for the /mcp stack-trace leak: responseError used to hand the McpError
   * exception itself to Jackson, so every 400/500 body carried stackTrace, cause and suppressed.
   */
  @Test
  void responseError_omitsThrowableState() throws Exception {
    HttpServletStatelessServerTransport.responseError(
        response,
        HttpServletResponse.SC_INTERNAL_SERVER_ERROR,
        null,
        McpError.builder(McpSchema.ErrorCodes.INTERNAL_ERROR)
            .message("Internal server error")
            .build());

    assertThat(body.toString())
        .doesNotContain("stackTrace")
        .doesNotContain("cause")
        .doesNotContain("suppressed")
        .doesNotContain("localizedMessage");
  }

  @Test
  void responseError_writesJsonRpcEnvelope() throws Exception {
    HttpServletStatelessServerTransport.responseError(
        response,
        HttpServletResponse.SC_BAD_REQUEST,
        null,
        McpError.builder(McpSchema.ErrorCodes.INVALID_REQUEST)
            .message("Invalid message format")
            .build());

    assertThat(body.toString())
        .isEqualTo(
            "{\"jsonrpc\":\"2.0\",\"id\":null,"
                + "\"error\":{\"code\":-32600,\"message\":\"Invalid message format\"}}");
  }

  /** A failing request whose id we already parsed must still be correlatable by the client. */
  @Test
  void responseError_knownRequestId_echoesItIntoTheEnvelope() throws Exception {
    HttpServletStatelessServerTransport.responseError(
        response,
        HttpServletResponse.SC_INTERNAL_SERVER_ERROR,
        42,
        McpError.builder(McpSchema.ErrorCodes.INTERNAL_ERROR)
            .message("Failed to handle request")
            .build());

    assertThat(body.toString())
        .isEqualTo(
            "{\"jsonrpc\":\"2.0\",\"id\":42,"
                + "\"error\":{\"code\":-32603,\"message\":\"Failed to handle request\"}}");
  }

  @Test
  void responseError_setsContentTypeAndStatus() throws Exception {
    HttpServletStatelessServerTransport.responseError(
        response,
        HttpServletResponse.SC_BAD_REQUEST,
        null,
        McpError.builder(McpSchema.ErrorCodes.INVALID_REQUEST).message("nope").build());

    verify(response).setContentType(HttpServletStatelessServerTransport.APPLICATION_JSON);
    verify(response).setCharacterEncoding(HttpServletStatelessServerTransport.UTF_8);
    verify(response).setStatus(HttpServletResponse.SC_BAD_REQUEST);
  }

  @Test
  void shouldEmitSse_acceptsBoth_prefersJson() {
    assertThat(HttpServletStatelessServerTransport.shouldEmitSse(true, true)).isFalse();
  }

  @Test
  void shouldEmitSse_acceptsJsonOnly_emitsJson() {
    assertThat(HttpServletStatelessServerTransport.shouldEmitSse(true, false)).isFalse();
  }

  @Test
  void shouldEmitSse_acceptsSseOnly_emitsSse() {
    assertThat(HttpServletStatelessServerTransport.shouldEmitSse(false, true)).isTrue();
  }

  // ── doPost: handler-raised JSON-RPC errors ────────────────────────────────

  private static final String MCP_ENDPOINT = "/mcp";

  private static final String UNKNOWN_METHOD_REQUEST =
      "{\"jsonrpc\":\"2.0\",\"id\":7,\"method\":\"server/discover\",\"params\":{}}";

  private static HttpServletRequest requestFor(String accept, String payload) throws Exception {
    HttpServletRequest request = mock(HttpServletRequest.class);
    when(request.getRequestURI()).thenReturn(MCP_ENDPOINT);
    when(request.getHeader(HttpServletStatelessServerTransport.ACCEPT)).thenReturn(accept);
    when(request.getReader()).thenReturn(new BufferedReader(new StringReader(payload)));
    return request;
  }

  private static HttpServletStatelessServerTransport transportRejectingWith(Throwable failure) {
    McpStatelessServerHandler handler = mock(McpStatelessServerHandler.class);
    when(handler.handleRequest(any(), any())).thenReturn(Mono.error(failure));
    return transportWith(handler);
  }

  private static McpError methodNotFound(String method) {
    return McpError.builder(McpSchema.ErrorCodes.METHOD_NOT_FOUND)
        .message("Missing handler for request type: " + method)
        .build();
  }

  @Test
  void doPost_unknownMethod_answers200WithMethodNotFound() throws Exception {
    transportRejectingWith(methodNotFound("server/discover"))
        .doPost(requestFor("application/json", UNKNOWN_METHOD_REQUEST), response);

    verify(response).setStatus(HttpServletResponse.SC_OK);
    verify(response, never()).setStatus(HttpServletResponse.SC_INTERNAL_SERVER_ERROR);
    assertThat(body.toString())
        .contains("\"code\":-32601")
        .contains("\"id\":7")
        .contains("Missing handler for request type: server/discover")
        .doesNotContain("stackTrace");
  }

  @Test
  void doPost_internalMcpError_answers500() throws Exception {
    transportRejectingWith(
            McpError.builder(McpSchema.ErrorCodes.INTERNAL_ERROR).message("boom").build())
        .doPost(requestFor("application/json", UNKNOWN_METHOD_REQUEST), response);

    verify(response).setStatus(HttpServletResponse.SC_INTERNAL_SERVER_ERROR);
    assertThat(body.toString()).contains("\"code\":-32603");
  }

  private static HttpServletStatelessServerTransport transportWith(
      McpStatelessServerHandler handler) {
    HttpServletStatelessServerTransport transport =
        HttpServletStatelessServerTransport.builder()
            .objectMapper(new ObjectMapper())
            .messageEndpoint(MCP_ENDPOINT)
            .build();
    transport.setMcpHandler(handler);
    return transport;
  }

  private static String notification(String method) {
    return "{\"jsonrpc\":\"2.0\",\"method\":\"" + method + "\",\"params\":{}}";
  }

  @Test
  void doPost_initializedNotification_acceptedWithoutReachingTheHandler() throws Exception {
    McpStatelessServerHandler handler = mock(McpStatelessServerHandler.class);
    when(handler.handleNotification(any(), any())).thenReturn(Mono.empty());

    transportWith(handler)
        .doPost(
            requestFor("application/json", notification(McpSchema.METHOD_NOTIFICATION_INITIALIZED)),
            response);

    verify(response).setStatus(HttpServletResponse.SC_ACCEPTED);
    verify(handler, never()).handleNotification(any(), any());
    assertThat(body.toString()).isEmpty();
  }
}

package org.openmetadata.mcp.server.transport;

import static org.assertj.core.api.Assertions.assertThat;

import com.fasterxml.jackson.databind.ObjectMapper;
import io.modelcontextprotocol.spec.McpError;
import io.modelcontextprotocol.spec.McpSchema;
import java.util.Map;
import org.junit.jupiter.api.Test;

class JsonRpcErrorBodyTest {

  /**
   * The whole point of this class: an {@link McpError} is a {@link RuntimeException}, and letting
   * Jackson serialize it directly shipped a 60-frame stack trace to anonymous callers.
   */
  @Test
  void of_mcpError_carriesNoThrowableState() {
    McpError error =
        McpError.builder(McpSchema.ErrorCodes.INTERNAL_ERROR)
            .message("Internal server error")
            .build();

    String body = JsonRpcErrorBody.of(null, error);

    assertThat(body)
        .doesNotContain("stackTrace")
        .doesNotContain("cause")
        .doesNotContain("suppressed")
        .doesNotContain("localizedMessage")
        .doesNotContain("org.openmetadata")
        .doesNotContain("org.eclipse.jetty");
  }

  @Test
  void of_mcpError_emitsJsonRpcEnvelope() {
    McpError error =
        McpError.builder(McpSchema.ErrorCodes.INVALID_REQUEST)
            .message("Invalid message format")
            .build();

    assertThat(JsonRpcErrorBody.of(null, error))
        .isEqualTo(
            "{\"jsonrpc\":\"2.0\",\"id\":null,"
                + "\"error\":{\"code\":-32600,\"message\":\"Invalid message format\"}}");
  }

  @Test
  void of_codeAndMessage_emitsJsonRpcEnvelope() {
    assertThat(JsonRpcErrorBody.of(null, JsonRpcErrorBody.UNAUTHORIZED, "Missing bearer token"))
        .isEqualTo(
            "{\"jsonrpc\":\"2.0\",\"id\":null,"
                + "\"error\":{\"code\":-32001,\"message\":\"Missing bearer token\"}}");
  }

  /**
   * JSON-RPC 2.0 section 5 requires {@code id} on every response. {@code McpSchema.JSONRPCResponse}
   * is annotated NON_ABSENT and would drop it, which is why this class ships its own envelope.
   */
  @Test
  void of_alwaysEmitsNullId() {
    assertThat(JsonRpcErrorBody.of(null, -32001, "nope")).contains("\"id\":null");
  }

  /** {@code data} is optional and absent on everything this transport builds. */
  @Test
  void of_omitsAbsentData() {
    assertThat(JsonRpcErrorBody.of(null, -32001, "nope")).doesNotContain("data");
  }

  /**
   * Documents the defect this class exists to prevent, so the guards above cannot go vacuous: a
   * stock ObjectMapper serializes an McpError as the RuntimeException it is, stack frames and all.
   */
  @Test
  void plainSerializationOfMcpError_leaksTheStackTrace() throws Exception {
    McpError error = McpError.builder(McpSchema.ErrorCodes.INTERNAL_ERROR).message("boom").build();

    String leaked = new ObjectMapper().writeValueAsString(error);

    assertThat(leaked)
        .contains("stackTrace")
        .contains("suppressed")
        .contains("localizedMessage")
        .contains("org.openmetadata.mcp.server.transport.JsonRpcErrorBodyTest");
  }

  // ── request id ────────────────────────────────────────────────────────────

  /**
   * JSON-RPC 2.0 section 5: when the id is known it MUST be echoed. A client that pipelines
   * requests cannot tell which one failed otherwise.
   */
  @Test
  void of_knownNumericId_echoesIt() {
    assertThat(JsonRpcErrorBody.of(7, -32603, "Failed to handle request"))
        .isEqualTo(
            "{\"jsonrpc\":\"2.0\",\"id\":7,"
                + "\"error\":{\"code\":-32603,\"message\":\"Failed to handle request\"}}");
  }

  @Test
  void of_knownStringId_echoesIt() {
    assertThat(JsonRpcErrorBody.of("req-1", -32603, "boom")).contains("\"id\":\"req-1\"");
  }

  @Test
  void of_unknownId_emitsNull() {
    assertThat(JsonRpcErrorBody.of(null, -32603, "boom")).contains("\"id\":null");
  }

  /**
   * Section 4 restricts the id to a String, a Number or null. Anything else is not reflected back,
   * so a client cannot use the error path to have its own payload echoed to it.
   */
  @Test
  void of_nonConformingId_isNotReflectedBack() {
    assertThat(JsonRpcErrorBody.of(Map.of("evil", "payload"), -32603, "boom"))
        .contains("\"id\":null")
        .doesNotContain("evil");
  }

  @Test
  void of_escapesMessage() {
    assertThat(JsonRpcErrorBody.of(null, -32001, "a \"quoted\"\nmessage"))
        .isEqualTo(
            "{\"jsonrpc\":\"2.0\",\"id\":null,"
                + "\"error\":{\"code\":-32001,\"message\":\"a \\\"quoted\\\"\\nmessage\"}}");
  }
}

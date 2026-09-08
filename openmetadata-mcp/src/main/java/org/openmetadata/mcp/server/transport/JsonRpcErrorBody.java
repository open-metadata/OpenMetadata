package org.openmetadata.mcp.server.transport;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.NullNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import io.modelcontextprotocol.spec.McpError;
import io.modelcontextprotocol.spec.McpSchema;
import io.modelcontextprotocol.spec.McpSchema.JSONRPCResponse.JSONRPCError;

/**
 * Renders an MCP failure as a bare JSON-RPC 2.0 error envelope.
 *
 * <p>{@link McpError} extends {@link RuntimeException}. Serializing the exception itself — which
 * both the upstream SDK transport and this fork used to do — puts {@code stackTrace}, {@code cause},
 * {@code suppressed} and {@code localizedMessage} on the wire, so an unauthenticated
 * {@code POST /mcp} answered with a full Java stack trace naming our classes, the servlet container
 * internals and the exact JRE build. Only the code and message may ever reach a response body; the
 * throwable belongs in the log.
 */
public final class JsonRpcErrorBody {

  /**
   * JSON-RPC 2.0 reserves -32000..-32099 for implementation-defined server errors. MCP defines no
   * code for "not authenticated", and -32603 INTERNAL_ERROR is wrong because nothing internal
   * failed, so authentication failures use the first code of the reserved range.
   */
  public static final int UNAUTHORIZED = -32001;

  /**
   * A private mapper keeps the envelope byte-identical no matter how a caller configured its own
   * {@link ObjectMapper}.
   */
  private static final ObjectMapper MAPPER = new ObjectMapper();

  private JsonRpcErrorBody() {}

  public static String of(Object requestId, McpError error) {
    return of(requestId, error.getJsonRpcError());
  }

  public static String of(Object requestId, int code, String message) {
    return of(requestId, new JSONRPCError(code, message, null));
  }

  /**
   * The envelope is assembled node by node rather than serialized from a POJO because {@code id}
   * must always be present — JSON-RPC 2.0 section 5 requires the member on every response — whereas
   * {@code McpSchema.JSONRPCResponse} is annotated NON_ABSENT and would drop it whenever the id is
   * null. {@link JSONRPCError#data()} is deliberately not copied: it is the one member that could
   * carry caller-supplied or exception-derived content, and this class exists to guarantee that
   * nothing beyond a code and a message reaches an anonymous caller.
   */
  static String of(Object requestId, JSONRPCError error) {
    ObjectNode envelope = MAPPER.createObjectNode();
    envelope.put("jsonrpc", McpSchema.JSONRPC_VERSION);
    envelope.set("id", idNode(requestId));

    ObjectNode jsonRpcError = envelope.putObject("error");
    jsonRpcError.put("code", error.code());
    jsonRpcError.put("message", error.message());
    return envelope.toString();
  }

  /**
   * Echoes the request id so a client that pipelines requests can correlate the failure, falling
   * back to null where the id is genuinely unknown — before the body is parsed, or when it could
   * not be parsed. JSON-RPC 2.0 section 4 restricts the member to a String, a Number or null, so a
   * client that sent anything else gets null rather than having its own payload reflected back out
   * of an error path.
   */
  private static JsonNode idNode(Object requestId) {
    JsonNode node = NullNode.getInstance();
    if (requestId instanceof String || requestId instanceof Number) {
      node = MAPPER.valueToTree(requestId);
    }
    return node;
  }
}

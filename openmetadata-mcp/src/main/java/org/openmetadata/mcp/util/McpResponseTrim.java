package org.openmetadata.mcp.util;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.openmetadata.schema.utils.JsonUtils;

/**
 * Shared payload-trimming primitives for MCP tools. The truncation budgets, the response size cap,
 * the {@code substring(0, n) + "..."} truncate logic and the embedding/vector field list were each
 * copy-pasted across {@code GetLineageTool}, {@code RootCauseAnalysisTool}, {@code
 * SearchMetadataTool} and {@code SemanticSearchTool}. Centralizing them here makes a change to any
 * limit a one-line edit and keeps every tool's trimming behaviour identical.
 *
 * <p>This holds primitives only — each tool keeps ownership of <em>what</em> to trim. Tools that can
 * trim intelligently (drop whole results, emit an actionable depth hint) do so themselves; {@link
 * #oversizedEnvelope} is only the generic last-resort stub used by the dispatch-level safety net.
 */
public final class McpResponseTrim {

  /** SQL is the single heaviest lineage field; keep the gist of the transform, cap the size. */
  public static final int SQL_MAX_LENGTH = 500;

  /**
   * Free-text markdown (pipeline / edge descriptions) is capped for the same reason as SQL: a single
   * long doc string can be shared across many edges and reintroduce bloat.
   */
  public static final int TEXT_MAX_LENGTH = 500;

  /** Description length above which the search/semantic tools truncate. */
  public static final int DESCRIPTION_MAX_LENGTH = 500;

  /**
   * Where an over-length description is cut. Sits below {@link #DESCRIPTION_MAX_LENGTH} so the result
   * lands comfortably under the threshold rather than right at it.
   */
  public static final int DESCRIPTION_TRUNCATE_LENGTH = 450;

  /** Final safety net: even slimmed, a wide payload can blow the LLM/MCP context limit. */
  public static final int MAX_RESPONSE_CHARS = 100_000;

  /**
   * Elasticsearch index-only document fields — the embedding vector and the RAG source/context text
   * used to build it. Each adds several kB per node and carries no value for an LLM reading the
   * result, so search/lineage documents drop them before returning.
   */
  public static final List<String> VECTOR_NOISE_FIELDS =
      List.of(
          "embeddings",
          "embedding",
          "textToEmbed",
          "textToLLMContext",
          "fingerprint",
          "chunkCount",
          "chunkIndex");

  private static final String NO_MESSAGE = "<no message>";

  private McpResponseTrim() {}

  /** Cuts {@code value} to {@code maxLength} characters plus an ellipsis when it is longer. */
  public static String truncate(String value, int maxLength) {
    String result = value;
    if (value != null && value.length() > maxLength) {
      result = value.substring(0, maxLength) + "...";
    }
    return result;
  }

  /**
   * Truncates a free-text description using the search/semantic convention: only when it exceeds
   * {@link #DESCRIPTION_MAX_LENGTH}, cut to {@link #DESCRIPTION_TRUNCATE_LENGTH} so the truncated
   * result sits below the threshold. Distinct from {@link #truncate(String, int)} (cut-at-max) on
   * purpose — collapsing the two would change the output of half the tools.
   */
  public static String truncateDescription(String value) {
    String result = value;
    if (value != null && value.length() > DESCRIPTION_MAX_LENGTH) {
      result = value.substring(0, DESCRIPTION_TRUNCATE_LENGTH) + "...";
    }
    return result;
  }

  /** Serialized JSON length of a result, used by the size-budget checks. */
  public static int serializedLength(Object result) {
    return JsonUtils.pojoToJson(result).length();
  }

  /**
   * Generic oversized-response envelope for the dispatch-level safety net (tools without a smarter
   * per-tool trim). Stays on the success path ({@code truncated:true}) because a deliberate cap is
   * not a failure the caller can retry. Merges the supplied identity fields so the client can still
   * tell which call was capped.
   */
  public static Map<String, Object> oversizedEnvelope(
      int sizeChars, Map<String, Object> identity, String advice) {
    Map<String, Object> envelope = new LinkedHashMap<>();
    if (identity != null) {
      envelope.putAll(identity);
    }
    envelope.put("truncated", Boolean.TRUE);
    envelope.put("responseSizeChars", sizeChars);
    envelope.put("maxResponseChars", MAX_RESPONSE_CHARS);
    envelope.put("message", advice);
    return envelope;
  }

  /**
   * Returns the throwable's message, or a placeholder when it is null, so a client-facing payload
   * never renders {@code "... null"}. Use only for the message surfaced to the caller — logging
   * should keep passing the throwable itself for the stack trace.
   */
  public static String safeMessage(Throwable t) {
    String result = NO_MESSAGE;
    if (t != null && t.getMessage() != null) {
      result = t.getMessage();
    }
    return result;
  }
}

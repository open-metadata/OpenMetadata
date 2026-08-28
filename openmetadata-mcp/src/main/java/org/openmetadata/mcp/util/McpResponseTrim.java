package org.openmetadata.mcp.util;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
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
   * Machine-readable marker keys shared by tools, the dispatch layer and MCP clients. A tool signals
   * a logical failure with {@link #ERROR_KEY} (optionally {@link #STATUS_CODE_KEY}); a partial-but-
   * successful response with {@link #TRUNCATED_KEY} (dispatch floor) or {@link #HAS_MORE_KEY} plus
   * {@link #NEXT_OFFSET_KEY} (per-tool paging). The dispatch layer reads {@link #ERROR_KEY} to set
   * the protocol {@code isError} flag; the paging keys are the contract the unified-pagination work
   * builds on. Centralizing the strings keeps tool output and dispatch detection from drifting apart.
   */
  public static final String ERROR_KEY = "error";

  public static final String STATUS_CODE_KEY = "statusCode";
  public static final String TRUNCATED_KEY = "truncated";
  public static final String RESPONSE_SIZE_CHARS_KEY = "responseSizeChars";
  public static final String MAX_RESPONSE_CHARS_KEY = "maxResponseChars";
  public static final String HAS_MORE_KEY = "hasMore";
  public static final String NEXT_OFFSET_KEY = "nextOffset";
  public static final String NEXT_CURSOR_KEY = "nextCursor";
  public static final String TOTAL_KEY = "total";
  public static final String MESSAGE_KEY = "message";

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

  /**
   * Collapses an entity-reference-shaped map to the one field a caller can act on: its FQN.
   *
   * <p>Search hits embed full {@code EntityReference} objects for {@code service}, {@code database},
   * {@code databaseSchema} and {@code owners}, and every hit from the same schema repeats the same
   * descriptor. Since every MCP tool is addressed by {@code (entityType, fqn)}, the rest is unusable
   * weight.
   *
   * <p>Anything not reference-shaped is returned untouched, rather than silently emptied.
   */
  public static Object slimRef(Object value) {
    Object result = value;
    if (value instanceof Map<?, ?> ref) {
      Object fqn = ref.get("fullyQualifiedName");
      Object name = fqn != null ? fqn : ref.get("name");
      if (name != null) {
        result = unquoteSegment(name.toString()) + inheritedSuffix(ref);
      }
    }
    return result;
  }

  /**
   * Keeps the one flag that has to survive collapsing a reference to its name.
   *
   * <p>Without it, an owner inherited from the parent database looks identical to a deliberately
   * assigned steward - and that distinction is the whole answer to "who should I talk to".
   */
  private static String inheritedSuffix(Map<?, ?> ref) {
    return Boolean.TRUE.equals(ref.get("inherited")) ? " (inherited)" : "";
  }

  /**
   * Drops the quoting OpenMetadata adds around an FQN segment containing a dot.
   *
   * <p>A user named {@code vishnu.jain} has the FQN {@code "vishnu.jain"}, quotes included, so an
   * owners list mixed quoted and unquoted entries. The quotes only separate segments inside a
   * multi-part FQN; on a single segment they say nothing and make the value harder to reuse.
   */
  private static String unquoteSegment(String fqn) {
    String result = fqn;
    boolean singleQuotedSegment =
        fqn.length() > 1
            && fqn.charAt(0) == '"'
            && fqn.charAt(fqn.length() - 1) == '"'
            && fqn.indexOf('"', 1) == fqn.length() - 1;
    if (singleQuotedSegment) {
      result = fqn.substring(1, fqn.length() - 1);
    }
    return result;
  }

  /** {@link #slimRef} across a list, e.g. {@code owners} or {@code domains}. */
  public static Object slimRefs(Object value) {
    Object result = value;
    if (value instanceof List<?> refs) {
      result = refs.stream().map(McpResponseTrim::slimRef).toList();
    }
    return result;
  }

  /**
   * Collapses a tag-label-shaped map to its {@code tagFQN}. Tier and classification labels carry a
   * paragraph-length {@code description} that repeats on every hit carrying that tag.
   */
  public static Object slimTag(Object value) {
    Object result = value;
    if (value instanceof Map<?, ?> tag && tag.get("tagFQN") != null) {
      result = tag.get("tagFQN");
    } else if (value instanceof List<?> tags) {
      result = tags.stream().map(McpResponseTrim::slimTag).toList();
    }
    return result;
  }

  /**
   * Collapses a certification to its FQN plus a resolved validity, e.g. {@code
   * "Certification.Gold (EXPIRED 2026-07-29)"}.
   *
   * <p>The nested label repeats a description, colour and icon URL on every certified hit. More
   * importantly, expiry ships as raw epoch millis next to {@code state: "Confirmed"}, so a lapsed
   * badge reads as a live trust signal unless the caller does the date arithmetic itself.
   */
  public static Object slimCertification(Object value, long nowMillis) {
    Object result = value;
    if (value instanceof Map<?, ?> certification) {
      Object label = certification.get("tagLabel");
      Map<?, ?> tag = label instanceof Map<?, ?> inner ? inner : certification;
      Object fqn = tag.get("tagFQN");
      if (fqn != null) {
        result = fqn + expirySuffix(certification, tag, nowMillis);
      }
    }
    return result;
  }

  private static String expirySuffix(Map<?, ?> certification, Map<?, ?> tag, long nowMillis) {
    Object expiry = expiryOf(certification, tag);
    String suffix = "";
    if (expiry instanceof Number millis) {
      String date =
          java.time.Instant.ofEpochMilli(millis.longValue())
              .atZone(java.time.ZoneOffset.UTC)
              .toLocalDate()
              .toString();
      suffix =
          millis.longValue() < nowMillis
              ? " (EXPIRED " + date + ")"
              : " (valid until " + date + ")";
    } else {
      // The index is inconsistent: some documents carry the full certification, others only
      // {tagLabel:{tagFQN}}. A bare label reads as a live badge and "(expiry unknown)" reads as "no
      // expiry set", so say what is actually true - the date exists, just not in this projection.
      suffix = " (expiry not in this index - check get_entity_details before trusting)";
    }
    return suffix;
  }

  private static Object expiryOf(Map<?, ?> certification, Map<?, ?> tag) {
    Object expiry = certification.get("expiryDate");
    if (expiry == null && tag.get("metadata") instanceof Map<?, ?> metadata) {
      expiry = metadata.get("expiryDate");
    }
    if (expiry == null) {
      expiry = tag.get("expiryDate");
    }
    return expiry;
  }

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
    envelope.put(TRUNCATED_KEY, Boolean.TRUE);
    envelope.put(RESPONSE_SIZE_CHARS_KEY, sizeChars);
    envelope.put(MAX_RESPONSE_CHARS_KEY, MAX_RESPONSE_CHARS);
    envelope.put(MESSAGE_KEY, advice);
    return envelope;
  }

  /** A backend message longer than this is summarised; the full text stays in the server log. */
  public static final int FAILURE_MESSAGE_MAX_LENGTH = 400;

  /** Matches the useful half of a search-backend error: the first concrete cause type it names. */
  private static final Pattern ROOT_CAUSE_TYPE = Pattern.compile("\"type\"\\s*:\\s*\"([a-z_]+)\"");

  /**
   * Compresses a backend failure into something a model can act on.
   *
   * <p>An OpenSearch {@code ResponseException} stringifies to its whole response body - one failing
   * search put ~4,000 characters in front of the model, mostly the same error repeated per shard,
   * and none of it said whether retrying would help.
   *
   * <p>So: keep the first line, name the cause once, and say whether the arguments were at fault.
   * The full text is already in the server log for the operator.
   */
  public static String summarizeFailure(Throwable t, boolean serverFault) {
    String message = safeMessage(t);
    String summary = message;
    if (message.length() > FAILURE_MESSAGE_MAX_LENGTH) {
      summary = firstLine(message) + causeSuffix(message);
      summary = truncate(summary, FAILURE_MESSAGE_MAX_LENGTH);
    }
    if (serverFault) {
      summary +=
          " [This is a backend fault, not a problem with the arguments you sent. Retrying the same"
              + " call will not help; try a different tool or a narrower request.]";
    }
    return summary;
  }

  private static String firstLine(String message) {
    int newline = message.indexOf('\n');
    String line = newline > 0 ? message.substring(0, newline) : message;
    return truncate(line, FAILURE_MESSAGE_MAX_LENGTH / 2);
  }

  /** Names the underlying cause once, rather than letting it repeat per failed shard. */
  private static String causeSuffix(String message) {
    Matcher matcher = ROOT_CAUSE_TYPE.matcher(message);
    String suffix = "";
    if (matcher.find()) {
      suffix = " (cause: " + matcher.group(1) + ")";
    }
    return suffix;
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

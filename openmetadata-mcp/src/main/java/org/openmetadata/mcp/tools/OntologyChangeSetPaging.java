package org.openmetadata.mcp.tools;

import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;

import com.fasterxml.jackson.databind.node.ObjectNode;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.Arrays;
import java.util.HexFormat;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.regex.Pattern;
import org.openmetadata.mcp.util.McpResponseTrim;
import org.openmetadata.mcp.util.PageCursor;
import org.openmetadata.mcp.util.ResponseBudget;
import org.openmetadata.schema.entity.data.OntologyChangeSet;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.utils.JsonUtils;

/** Projects an authorized proposal into whole-item pages without changing its stored timeline. */
final class OntologyChangeSetPaging {
  static final int DEFAULT_LIMIT = 10;
  static final int MAX_LIMIT = 25;
  private static final String APPLICATION_RESULT = "applicationResult";
  private static final String RESULTS = "results";
  private static final String LIMIT = "limit";
  private static final String CURSOR = "cursor";
  private static final String SECTION = "section";
  private static final String ID = "id";
  private static final String RETURNED_COUNT = "returnedCount";
  private static final int MAX_CURSOR_CHARS = 512;
  private static final Pattern CURSOR_VALUE = Pattern.compile("([0-9a-f]{64}):([0-9]{1,10})");

  private OntologyChangeSetPaging() {}

  static ObjectNode acknowledgement(
      final OntologyChangeSet proposal, final Map<String, Object> outcome) {
    final ObjectNode response = metadata(proposal);
    for (final String key : List.of("_operation", "changed", "changeRequestId")) {
      if (outcome.containsKey(key)) {
        response.set(key, JsonUtils.valueToTree(outcome.get(key)));
      }
    }
    response.put("readTool", "get_ontology_change_set");
    return response;
  }

  static ObjectNode read(final OntologyChangeSet proposal, final Request request) {
    final List<?> items = request.section().items(proposal);
    final String snapshot = fingerprint(proposal, request.section());
    final int offset = request.offset(snapshot);
    if (offset > items.size()) {
      throw new IllegalArgumentException("'cursor' offset exceeds this proposal page");
    }
    final List<?> candidates =
        items.subList(offset, Math.min(items.size(), offset + request.limit()));
    final ObjectNode response = metadata(proposal);
    response.put(SECTION, request.section().wireName);
    response.put("offset", offset);
    response.put(McpResponseTrim.TOTAL_KEY, items.size());
    final int count = fitCount(response, candidates, items.size(), snapshot);
    setItems(response, request.section(), candidates.subList(0, count));
    completePage(response, offset + count, items.size(), count, snapshot);
    return response;
  }

  private static int fitCount(
      final ObjectNode response, final List<?> candidates, final int total, final String snapshot) {
    // Reserve the longest continuation and count before measuring complete serialized items.
    response.put(McpResponseTrim.HAS_MORE_KEY, true);
    response.put(McpResponseTrim.NEXT_CURSOR_KEY, cursor(snapshot, total));
    response.put(RETURNED_COUNT, candidates.size());
    final int count =
        ResponseBudget.fitCount(candidates, McpResponseTrim.serializedLength(response));
    if (count == 0 && !candidates.isEmpty()) {
      throw new IllegalArgumentException("Proposal metadata exceeds the response budget; use REST");
    }
    return count;
  }

  private static ObjectNode metadata(final OntologyChangeSet proposal) {
    final ObjectNode response = JsonUtils.getObjectNode();
    response.put(ID, proposal.getId().toString());
    response.put("name", proposal.getName());
    response.set("state", JsonUtils.valueToTree(proposal.getState()));
    response.put("version", proposal.getVersion());
    response.put("updatedAt", proposal.getUpdatedAt());
    response.put("undoCursor", proposal.getUndoCursor());
    response.put("baseWorkingRevision", proposal.getBaseWorkingRevision());
    response.put("operationCount", listOrEmpty(proposal.getOperations()).size());
    response.put("applicationResultCount", Section.APPLICATION_RESULTS.items(proposal).size());
    response.put("glossaryCount", listOrEmpty(proposal.getGlossaries()).size());
    response.set("ontology", reference(proposal.getOntology()));
    response.set(Section.OPERATIONS.wireName, JsonUtils.getObjectMapper().createArrayNode());
    response.set(Section.GLOSSARIES.wireName, JsonUtils.getObjectMapper().createArrayNode());
    response.set(APPLICATION_RESULT, applicationSummary(proposal));
    return response;
  }

  private static ObjectNode reference(final EntityReference reference) {
    ObjectNode result = null;
    if (reference != null) {
      result = JsonUtils.getObjectNode();
      result.set(ID, JsonUtils.valueToTree(reference.getId()));
      result.put("type", reference.getType());
      result.put("name", reference.getName());
      result.put("fullyQualifiedName", reference.getFullyQualifiedName());
    }
    return result;
  }

  private static ObjectNode applicationSummary(final OntologyChangeSet proposal) {
    final var result = proposal.getApplicationResult();
    ObjectNode summary = null;
    if (result != null) {
      summary = JsonUtils.getObjectNode();
      summary.put("appliedAt", result.getAppliedAt());
      summary.put("appliedBy", result.getAppliedBy());
      summary.put("operationsProcessed", result.getOperationsProcessed());
      summary.put("operationsApplied", result.getOperationsApplied());
      summary.put("operationsFailed", result.getOperationsFailed());
      summary.set(RESULTS, JsonUtils.getObjectMapper().createArrayNode());
    }
    return summary;
  }

  private static void setItems(
      final ObjectNode response, final Section section, final List<?> items) {
    if (section == Section.OPERATIONS) {
      response.set(Section.OPERATIONS.wireName, JsonUtils.valueToTree(items));
    } else if (section == Section.GLOSSARIES) {
      response.set(Section.GLOSSARIES.wireName, JsonUtils.valueToTree(items));
    } else if (response.path(APPLICATION_RESULT).isObject()) {
      ((ObjectNode) response.get(APPLICATION_RESULT)).set(RESULTS, JsonUtils.valueToTree(items));
    }
  }

  private static void completePage(
      final ObjectNode response,
      final int next,
      final int total,
      final int count,
      final String snapshot) {
    response.put(RETURNED_COUNT, count);
    response.put(McpResponseTrim.HAS_MORE_KEY, next < total);
    response.remove(McpResponseTrim.NEXT_CURSOR_KEY);
    if (next < total) {
      response.put(McpResponseTrim.NEXT_CURSOR_KEY, cursor(snapshot, next));
    }
  }

  private static String fingerprint(final OntologyChangeSet proposal, final Section section) {
    final String input = section.wireName + ":" + JsonUtils.pojoToJson(proposal);
    try {
      return HexFormat.of()
          .formatHex(
              MessageDigest.getInstance("SHA-256").digest(input.getBytes(StandardCharsets.UTF_8)));
    } catch (final NoSuchAlgorithmException error) {
      throw new IllegalStateException("SHA-256 is required for ontology proposal paging", error);
    }
  }

  private static String cursor(final String snapshot, final int offset) {
    return PageCursor.encodeKeyset(snapshot + ":" + offset);
  }

  enum Section {
    OPERATIONS("operations"),
    APPLICATION_RESULTS("applicationResults"),
    GLOSSARIES("glossaries");

    private final String wireName;

    Section(final String wireName) {
      this.wireName = wireName;
    }

    private List<?> items(final OntologyChangeSet proposal) {
      return switch (this) {
        case OPERATIONS -> listOrEmpty(proposal.getOperations());
        case APPLICATION_RESULTS -> proposal.getApplicationResult() == null
            ? List.of()
            : listOrEmpty(proposal.getApplicationResult().getResults());
        case GLOSSARIES -> listOrEmpty(proposal.getGlossaries()).stream()
            .map(OntologyChangeSetPaging::reference)
            .toList();
      };
    }

    private static Section from(final Object value) {
      return Arrays.stream(values())
          .filter(section -> section.wireName.equals(value))
          .findFirst()
          .orElseThrow(
              () ->
                  new IllegalArgumentException(
                      "'section' must be operations, applicationResults or glossaries"));
    }
  }

  record Request(UUID id, Section section, int limit, String cursor) {
    static Request from(final Map<String, Object> values) {
      OntologyToolSupport.requireOnly(values, Set.of(ID, SECTION, LIMIT, CURSOR));
      return new Request(
          OntologyToolSupport.id(values, ID),
          Section.from(values.getOrDefault(SECTION, Section.OPERATIONS.wireName)),
          limit(values.getOrDefault(LIMIT, DEFAULT_LIMIT)),
          cursorValue(values.get(CURSOR)));
    }

    private static int limit(final Object value) {
      int parsed = 0;
      if (value instanceof Number number) {
        try {
          parsed = new BigDecimal(number.toString()).intValueExact();
        } catch (final NumberFormatException | ArithmeticException error) {
          throw new IllegalArgumentException(
              "'limit' must be an integer from 1 to " + MAX_LIMIT, error);
        }
      }
      if (parsed < 1 || parsed > MAX_LIMIT) {
        throw new IllegalArgumentException("'limit' must be an integer from 1 to " + MAX_LIMIT);
      }
      return parsed;
    }

    private static String cursorValue(final Object value) {
      String result = null;
      if (value != null) {
        if (!(value instanceof String text) || text.isBlank() || text.length() > MAX_CURSOR_CHARS) {
          throw invalidCursor();
        }
        result = text;
      }
      return result;
    }

    private int offset(final String snapshot) {
      int offset = 0;
      if (cursor != null) {
        final var decoded =
            PageCursor.decode(cursor)
                .filter(value -> value.kind() == PageCursor.Kind.KEYSET)
                .orElseThrow(Request::invalidCursor);
        final var match = CURSOR_VALUE.matcher(decoded.after());
        if (!match.matches()) {
          throw invalidCursor();
        }
        if (!snapshot.equals(match.group(1))) {
          throw new IllegalArgumentException(
              "Proposal or section changed; restart without 'cursor'");
        }
        offset = parseOffset(match.group(2));
      }
      return offset;
    }

    private static int parseOffset(final String value) {
      try {
        return Integer.parseInt(value);
      } catch (final NumberFormatException error) {
        throw invalidCursor();
      }
    }

    private static IllegalArgumentException invalidCursor() {
      return new IllegalArgumentException("Invalid 'cursor'; restart without it");
    }
  }
}

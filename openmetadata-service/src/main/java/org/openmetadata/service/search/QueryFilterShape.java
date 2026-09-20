package org.openmetadata.service.search;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.ws.rs.core.Response;
import java.util.List;
import java.util.Map;
import org.openmetadata.sdk.exception.SearchException;

/**
 * Checks that a caller's {@code queryFilter} is shaped like query DSL, not merely like valid JSON.
 *
 * <p>The filter is forwarded to the engine inside a {@code wrapper} query, and the only guard on
 * that path parsed it as JSON. A filter that is valid JSON but not a valid query therefore reached
 * the engine and was rejected there, with {@code [bool] failed to parse field [must]} — the failure
 * recorded against issue #27990 after the one in the issue body.
 *
 * <p>One invariant is enforced, because it is the one the DSL actually guarantees: the boolean
 * clause keys hold either a query object or an array of query objects, never a bare value or a
 * nested array. Anything stricter would risk rejecting a filter the engine would have accepted.
 */
public final class QueryFilterShape {

  private static final List<String> BOOL_CLAUSE_KEYS =
      List.of("must", "should", "filter", "must_not");
  private static final String QUERY_WRAPPER_KEY = "query";
  private static final String NOT_QUERY_DSL =
      "queryFilter is not a valid query: expected query DSL, got %s";

  private static final ObjectMapper MAPPER = new ObjectMapper();

  private QueryFilterShape() {}

  /**
   * Validates {@code queryFilter} and returns the query JSON to forward, unwrapping the optional
   * outer {@code query} key.
   *
   * @throws SearchException with status 400 when the filter is not usable as a query
   */
  public static String requireQueryDsl(String queryFilter) {
    JsonNode root = parseOrReject(queryFilter);
    JsonNode query = root.has(QUERY_WRAPPER_KEY) ? root.get(QUERY_WRAPPER_KEY) : root;
    if (!isWellFormed(query)) {
      throw badRequest(String.format(NOT_QUERY_DSL, "a malformed boolean clause"));
    }
    return query.toString();
  }

  private static JsonNode parseOrReject(String queryFilter) {
    try {
      return MAPPER.readTree(queryFilter);
    } catch (JsonProcessingException e) {
      throw badRequest(String.format(NOT_QUERY_DSL, "text that is not JSON"));
    }
  }

  private static SearchException badRequest(String message) {
    return SearchException.withStatus(Response.Status.BAD_REQUEST, message);
  }

  /** Whether {@code filter}, already parsed from JSON, is shaped like query DSL. */
  public static boolean isWellFormed(JsonNode filter) {
    return filter != null && filter.isObject() && hasWellFormedClauses(filter);
  }

  private static boolean hasWellFormedClauses(JsonNode node) {
    for (Map.Entry<String, JsonNode> field : node.properties()) {
      if (BOOL_CLAUSE_KEYS.contains(field.getKey()) && !isClauseValue(field.getValue())) {
        return false;
      }
      if (!hasWellFormedChildren(field.getValue())) {
        return false;
      }
    }
    return true;
  }

  private static boolean hasWellFormedChildren(JsonNode value) {
    if (value.isObject()) {
      return hasWellFormedClauses(value);
    }
    if (value.isArray()) {
      for (JsonNode element : value) {
        if (element.isObject() && !hasWellFormedClauses(element)) {
          return false;
        }
      }
    }
    return true;
  }

  /** A clause is one query object, or an array whose every element is a query object. */
  private static boolean isClauseValue(JsonNode clause) {
    if (clause.isObject()) {
      return true;
    }
    if (!clause.isArray()) {
      return false;
    }
    for (JsonNode element : clause) {
      if (!element.isObject()) {
        return false;
      }
    }
    return true;
  }
}

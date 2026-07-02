package org.openmetadata.mcp.tools;

import java.io.IOException;
import java.util.HashMap;
import java.util.Map;
import lombok.extern.slf4j.Slf4j;
import org.apache.jena.query.Query;
import org.apache.jena.query.QueryException;
import org.apache.jena.query.QueryFactory;
import org.openmetadata.service.limits.Limits;
import org.openmetadata.service.rdf.RdfRepository;
import org.openmetadata.service.rdf.federation.SparqlFederationGuard;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.security.auth.CatalogSecurityContext;

/**
 * Read-only SPARQL query tool for AI agents. Wraps {@code RdfRepository.executeSparqlQuery}.
 *
 * <p>This tool is deliberately the only path through which an MCP client can talk SPARQL.
 * Hardening:
 *
 * <ul>
 *   <li>Rejects SPARQL UPDATE / INSERT / DELETE / LOAD / CLEAR / DROP / CREATE — only
 *       SELECT, ASK, DESCRIBE, CONSTRUCT pass the gate.
 *   <li>Federation: enforces the same allowlist as REST, so an MCP client cannot bypass it.
 *   <li>Result size: caps the response body at {@code maxBytes} (default 1 MiB) to prevent the
 *       triplestore from streaming a huge result into the agent context.
 *   <li>Format: SELECT/ASK accept the four SPARQL result formats (json, xml, csv, tsv);
 *       CONSTRUCT/DESCRIBE accept the RDF serializations (turtle, jsonld, ntriples, rdfxml).
 * </ul>
 */
@Slf4j
public class SparqlQueryTool implements McpTool {

  private static final int DEFAULT_MAX_BYTES = 1 * 1024 * 1024;
  private static final int HARD_MAX_BYTES = 16 * 1024 * 1024;

  @Override
  public Map<String, Object> execute(
      Authorizer authorizer, CatalogSecurityContext securityContext, Map<String, Object> params)
      throws IOException {
    String query = string(params, "query");
    if (query == null || query.isBlank()) {
      return error("'query' parameter is required");
    }

    Query parsed;
    try {
      parsed = QueryFactory.create(query);
    } catch (QueryException e) {
      return error("SPARQL parse error: " + e.getMessage());
    }
    if (!isReadOnly(parsed)) {
      return error(
          "Only read-only SPARQL queries (SELECT, ASK, DESCRIBE, CONSTRUCT) are allowed via this tool. Use the admin REST endpoint for SPARQL UPDATE.");
    }

    RdfRepository repository = RdfRepository.getInstanceOrNull();
    if (repository == null || !repository.isEnabled()) {
      return error("RDF repository is not enabled on this OpenMetadata server");
    }

    try {
      new SparqlFederationGuard(repository.getConfig()).enforce(query);
    } catch (SparqlFederationGuard.FederationDisallowedException e) {
      return error(e.getMessage());
    }

    String format = normalizeFormat(string(params, "format"));
    String mimeType = mimeFor(format);
    String inferenceLevel = string(params, "inferenceLevel");

    int maxBytes = clamp(intParam(params, "maxBytes", DEFAULT_MAX_BYTES), 1024, HARD_MAX_BYTES);

    String body;
    try {
      body =
          inferenceLevel != null
                  && !inferenceLevel.isBlank()
                  && !"none".equalsIgnoreCase(inferenceLevel)
              ? repository.executeSparqlQueryWithInference(query, mimeType, inferenceLevel)
              : repository.executeSparqlQuery(query, mimeType);
    } catch (Exception e) {
      LOG.error("SPARQL query execution failed", e);
      return error("SPARQL execution failed: " + e.getMessage());
    }

    Map<String, Object> result = new HashMap<>();
    result.put("format", format);
    result.put("queryType", parsed.queryType().toString());
    if (body == null) {
      result.put("body", "");
      result.put("truncated", false);
      result.put("byteCount", 0);
      return result;
    }
    byte[] bytes = body.getBytes(java.nio.charset.StandardCharsets.UTF_8);
    boolean truncated = bytes.length > maxBytes;
    if (truncated) {
      // Truncate by bytes (not chars). Multi-byte UTF-8 sequences must not be split mid-rune,
      // so back off until we land on the start of a code point (top bits != 10xxxxxx).
      int cut = maxBytes;
      while (cut > 0 && (bytes[cut] & 0xC0) == 0x80) {
        cut--;
      }
      result.put("body", new String(bytes, 0, cut, java.nio.charset.StandardCharsets.UTF_8));
    } else {
      result.put("body", body);
    }
    result.put("truncated", truncated);
    result.put("byteCount", bytes.length);
    return result;
  }

  @Override
  public Map<String, Object> execute(
      Authorizer authorizer,
      Limits limits,
      CatalogSecurityContext securityContext,
      Map<String, Object> params) {
    throw new UnsupportedOperationException("SparqlQueryTool does not enforce write limits.");
  }

  private static boolean isReadOnly(Query query) {
    return query.isSelectType()
        || query.isAskType()
        || query.isDescribeType()
        || query.isConstructType();
  }

  private static String normalizeFormat(String format) {
    if (format == null || format.isBlank()) {
      return "json";
    }
    return switch (format.toLowerCase()) {
      case "json", "xml", "csv", "tsv", "turtle", "rdfxml", "ntriples", "jsonld" -> format
          .toLowerCase();
      default -> "json";
    };
  }

  private static String mimeFor(String format) {
    return switch (format) {
      case "xml" -> "application/sparql-results+xml";
      case "csv" -> "text/csv";
      case "tsv" -> "text/tab-separated-values";
      case "turtle" -> "text/turtle";
      case "rdfxml" -> "application/rdf+xml";
      case "ntriples" -> "application/n-triples";
      case "jsonld" -> "application/ld+json";
      default -> "application/sparql-results+json";
    };
  }

  private static String string(Map<String, Object> params, String key) {
    Object v = params.get(key);
    return v instanceof String s ? s : null;
  }

  private static int intParam(Map<String, Object> params, String key, int defaultValue) {
    Object v = params.get(key);
    if (v instanceof Number n) return n.intValue();
    if (v instanceof String s) {
      try {
        return Integer.parseInt(s);
      } catch (NumberFormatException e) {
        return defaultValue;
      }
    }
    return defaultValue;
  }

  private static int clamp(int v, int lo, int hi) {
    return Math.min(Math.max(v, lo), hi);
  }

  private static Map<String, Object> error(String message) {
    Map<String, Object> result = new HashMap<>();
    result.put("error", message);
    return result;
  }
}

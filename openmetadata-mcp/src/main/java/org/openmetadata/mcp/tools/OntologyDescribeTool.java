package org.openmetadata.mcp.tools;

import java.io.IOException;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.Map;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.service.limits.Limits;
import org.openmetadata.service.rdf.RdfIriValidator;
import org.openmetadata.service.rdf.RdfRepository;
import org.openmetadata.service.resources.rdf.OntologyDocument;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.security.auth.CatalogSecurityContext;

/**
 * Returns either the entire OpenMetadata ontology or a focused DESCRIBE for a single class /
 * property URI.
 *
 * <p>The full ontology is served from the bundled classpath resource (no triplestore round
 * trip). A focused DESCRIBE goes through the triplestore so it picks up any side-ontology
 * extensions registered there.
 */
@Slf4j
public class OntologyDescribeTool implements McpTool {

  @Override
  public Map<String, Object> execute(
      Authorizer authorizer, CatalogSecurityContext securityContext, Map<String, Object> params)
      throws IOException {
    String resource = string(params, "resource");
    String format = normalizeFormat(string(params, "format"));

    if (resource == null || resource.isBlank()) {
      OntologyDocument.SerializedOntology serialized = OntologyDocument.serializeAsString(format);
      Map<String, Object> result = new LinkedHashMap<>();
      result.put("scope", "full-ontology");
      result.put("format", format);
      result.put("mediaType", serialized.mediaType());
      result.put("body", serialized.body());
      return result;
    }

    String validatedResource = RdfIriValidator.validateEntityIri(resource);
    if (validatedResource == null) {
      return error(
          "'resource' must be a valid absolute http(s) IRI (no whitespace, control characters,"
              + " angle brackets, or quotes)");
    }

    RdfRepository repository = RdfRepository.getInstanceOrNull();
    if (repository == null || !repository.isEnabled()) {
      return error("RDF repository is not enabled; cannot DESCRIBE individual ontology resources");
    }

    String describe = "DESCRIBE <" + validatedResource + ">";
    String mime = formatMime(format);
    String body;
    try {
      body = repository.executeSparqlQueryDirect(describe, mime);
    } catch (Exception e) {
      LOG.error("Ontology DESCRIBE failed for {}", validatedResource, e);
      return error("DESCRIBE failed: " + e.getMessage());
    }

    Map<String, Object> result = new LinkedHashMap<>();
    result.put("scope", "describe");
    result.put("resource", validatedResource);
    result.put("format", format);
    result.put("mediaType", mime);
    result.put("body", body == null ? "" : body);
    return result;
  }

  @Override
  public Map<String, Object> execute(
      Authorizer authorizer,
      Limits limits,
      CatalogSecurityContext securityContext,
      Map<String, Object> params) {
    throw new UnsupportedOperationException("OntologyDescribeTool does not enforce write limits.");
  }

  private static String normalizeFormat(String format) {
    if (format == null) return "turtle";
    return switch (format.toLowerCase()) {
      case "jsonld", "json-ld", "ld+json" -> "jsonld";
      case "rdfxml", "rdf+xml", "rdf/xml" -> "rdfxml";
      case "ntriples", "n-triples" -> "ntriples";
      default -> "turtle";
    };
  }

  /**
   * Maps a normalised format name to the SPARQL-accept MIME type the triplestore expects. Every
   * format returned by {@link #normalizeFormat} must round-trip through here.
   */
  private static String formatMime(String format) {
    return switch (format) {
      case "jsonld" -> "application/ld+json";
      case "rdfxml" -> "application/rdf+xml";
      case "ntriples" -> "application/n-triples";
      default -> "text/turtle";
    };
  }

  private static String string(Map<String, Object> params, String key) {
    Object v = params.get(key);
    return v instanceof String s ? s : null;
  }

  private static Map<String, Object> error(String message) {
    Map<String, Object> result = new HashMap<>();
    result.put("error", message);
    return result;
  }
}

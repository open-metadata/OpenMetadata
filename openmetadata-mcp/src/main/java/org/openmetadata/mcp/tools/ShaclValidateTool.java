package org.openmetadata.mcp.tools;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.StringReader;
import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.apache.jena.rdf.model.Model;
import org.apache.jena.rdf.model.ModelFactory;
import org.apache.jena.riot.Lang;
import org.apache.jena.riot.RDFDataMgr;
import org.apache.jena.riot.RDFFormat;
import org.apache.jena.shacl.ValidationReport;
import org.openmetadata.service.limits.Limits;
import org.openmetadata.service.rdf.RdfIriValidator;
import org.openmetadata.service.rdf.RdfRepository;
import org.openmetadata.service.resources.rdf.RdfShaclValidator;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.security.auth.CatalogSecurityContext;

/**
 * Runs SHACL validation against either a single entity's subgraph or the entire dataset and
 * returns the resulting validation report.
 *
 * <p>If {@code entityId} + {@code entityType} (or {@code entityUri}) is supplied, the tool runs
 * {@code DESCRIBE <uri>} first and validates only that subgraph. Otherwise it pulls everything
 * and validates the whole graph (admin-style usage; expensive).
 */
@Slf4j
public class ShaclValidateTool implements McpTool {

  @Override
  public Map<String, Object> execute(
      Authorizer authorizer, CatalogSecurityContext securityContext, Map<String, Object> params)
      throws IOException {
    RdfRepository repository = RdfRepository.getInstanceOrNull();
    if (repository == null || !repository.isEnabled()) {
      return error("RDF repository is not enabled on this OpenMetadata server");
    }

    String entityUri = resolveEntityUri(params, repository.getBaseUri());
    if (entityUri != null && entityUri.startsWith("error:")) {
      return error(entityUri.substring("error:".length()));
    }

    if (entityUri == null && !Boolean.TRUE.equals(params.get("fullGraph"))) {
      return error(
          "Full-graph SHACL validation must be explicitly enabled by passing fullGraph=true. "
              + "It loads the entire triplestore into memory and can OOM the MCP server. Prefer "
              + "passing entityId+entityType (or entityUri) to scope the check.");
    }

    String constructQuery =
        entityUri != null
            ? "DESCRIBE <" + entityUri + ">"
            : "CONSTRUCT { ?s ?p ?o } WHERE { ?s ?p ?o }";

    String dataTurtle;
    try {
      dataTurtle = repository.executeSparqlQueryDirect(constructQuery, "text/turtle");
    } catch (Exception e) {
      LOG.error("Subgraph fetch for SHACL failed", e);
      return error("Failed to fetch subgraph: " + e.getMessage());
    }

    Model dataModel = ModelFactory.createDefaultModel();
    try (StringReader reader = new StringReader(dataTurtle == null ? "" : dataTurtle)) {
      RDFDataMgr.read(dataModel, reader, repository.getBaseUri(), Lang.TURTLE);
    } catch (Exception e) {
      LOG.error("Failed to parse subgraph for SHACL validation", e);
      return error("Failed to parse subgraph: " + e.getMessage());
    }

    ValidationReport report = RdfShaclValidator.validate(dataModel);
    String format = normalizeFormat(string(params, "format"));
    RDFFormat rdfFormat =
        "jsonld".equals(format) ? RDFFormat.JSONLD_PRETTY : RDFFormat.TURTLE_PRETTY;
    ByteArrayOutputStream out = new ByteArrayOutputStream();
    RDFDataMgr.write(out, report.getModel(), rdfFormat);

    Map<String, Object> result = new LinkedHashMap<>();
    result.put("scope", entityUri == null ? "full-graph" : "entity");
    if (entityUri != null) {
      result.put("entityUri", entityUri);
    }
    result.put("conforms", report.conforms());
    long violationCount = report.getEntries() == null ? 0 : report.getEntries().size();
    result.put("violationCount", violationCount);
    result.put("format", format);
    result.put("report", out.toString(StandardCharsets.UTF_8));
    return result;
  }

  @Override
  public Map<String, Object> execute(
      Authorizer authorizer,
      Limits limits,
      CatalogSecurityContext securityContext,
      Map<String, Object> params) {
    throw new UnsupportedOperationException("ShaclValidateTool does not enforce write limits.");
  }

  private static String resolveEntityUri(Map<String, Object> params, String baseUri) {
    String entityUri = string(params, "entityUri");
    if (entityUri != null && !entityUri.isBlank()) {
      String validated = RdfIriValidator.validateEntityIri(entityUri);
      if (validated == null) {
        return "error:'entityUri' must be a valid absolute http(s) IRI";
      }
      return validated;
    }
    String entityId = string(params, "entityId");
    String entityType = string(params, "entityType");
    if (entityId == null && entityType == null) {
      return null; // full-graph scope
    }
    if (entityId == null || entityType == null) {
      return "error:Both 'entityId' and 'entityType' are required when scoping by entity, or omit both for full-graph scope";
    }
    try {
      UUID.fromString(entityId);
    } catch (IllegalArgumentException e) {
      return "error:'entityId' must be a UUID";
    }
    if (!entityType.matches("[A-Za-z][A-Za-z0-9]*")) {
      return "error:'entityType' must be alphanumeric";
    }
    return baseUri + "entity/" + entityType + "/" + entityId;
  }

  private static String normalizeFormat(String format) {
    if (format == null) return "turtle";
    return switch (format.toLowerCase()) {
      case "jsonld", "json-ld", "ld+json" -> "jsonld";
      default -> "turtle";
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

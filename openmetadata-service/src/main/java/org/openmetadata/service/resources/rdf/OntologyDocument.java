package org.openmetadata.service.resources.rdf;

import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import lombok.extern.slf4j.Slf4j;
import org.apache.jena.rdf.model.Model;
import org.apache.jena.rdf.model.ModelFactory;
import org.apache.jena.riot.Lang;
import org.apache.jena.riot.RDFDataMgr;
import org.apache.jena.riot.RDFFormat;

/**
 * Loads the canonical OpenMetadata ontology from the classpath and serves it in the requested
 * RDF serialization. The TTL files ship in the openmetadata-spec module:
 *
 * <ul>
 *   <li>{@code /rdf/ontology/openmetadata.ttl} — the main OWL ontology
 *   <li>{@code /rdf/ontology/openmetadata-prov.ttl} — PROV-aligned extension
 * </ul>
 *
 * Both are merged into a single response so that consumers don't have to follow imports.
 */
@Slf4j
public final class OntologyDocument {

  private static final String MAIN_RESOURCE = "/rdf/ontology/openmetadata.ttl";
  private static final String PROV_RESOURCE = "/rdf/ontology/openmetadata-prov.ttl";

  private OntologyDocument() {}

  /** Holder pattern for thread-safe lazy parsing. The merged model is immutable post-load. */
  private static final class Holder {
    private static final Model MODEL = loadModel();
  }

  private static Model loadModel() {
    Model model = ModelFactory.createDefaultModel();
    readInto(model, MAIN_RESOURCE);
    readInto(model, PROV_RESOURCE);
    return model;
  }

  private static void readInto(Model model, String resourcePath) {
    try (InputStream is = OntologyDocument.class.getResourceAsStream(resourcePath)) {
      if (is == null) {
        LOG.warn("Ontology resource not found on classpath: {}", resourcePath);
        return;
      }
      RDFDataMgr.read(model, is, Lang.TURTLE);
    } catch (IOException e) {
      LOG.warn("Failed to read ontology resource {}: {}", resourcePath, e.getMessage());
    } catch (RuntimeException e) {
      // RDFDataMgr.read can throw Jena RuntimeExceptions (e.g. RiotException) on a malformed
      // TTL. Catch broadly so a corrupt ontology file degrades to a partial/empty model rather
      // than failing class initialization and taking down /rdf/ontology + MCP describe.
      LOG.warn("Failed to parse ontology resource {}: {}", resourcePath, e.getMessage());
    }
  }

  /**
   * Serialize the merged ontology in the requested RDF format. Returns body, the chosen media
   * type, and the file extension. Suitable for callers that don't speak JAX-RS Response (e.g.
   * MCP tools).
   */
  public static SerializedOntology serializeAsString(String format) {
    Format f = Format.parse(format);
    ByteArrayOutputStream out = new ByteArrayOutputStream();
    RDFDataMgr.write(out, Holder.MODEL, f.rdfFormat);
    return new SerializedOntology(out.toString(StandardCharsets.UTF_8), f.mediaType, f.extension);
  }

  public record SerializedOntology(String body, String mediaType, String extension) {}

  static Response serve(String format) {
    Format f = Format.parse(format);
    try {
      ByteArrayOutputStream out = new ByteArrayOutputStream();
      RDFDataMgr.write(out, Holder.MODEL, f.rdfFormat);
      return Response.ok(out.toString(StandardCharsets.UTF_8))
          .type(f.mediaType)
          .header("Content-Disposition", "inline; filename=openmetadata-ontology." + f.extension)
          .build();
    } catch (Exception e) {
      LOG.error("Failed to serialize ontology as {}", format, e);
      return Response.serverError()
          .entity("{\"error\": \"failed to serialize ontology\"}")
          .type(MediaType.APPLICATION_JSON)
          .build();
    }
  }

  private enum Format {
    TURTLE(RDFFormat.TURTLE_PRETTY, "text/turtle", "ttl"),
    RDFXML(RDFFormat.RDFXML_PRETTY, "application/rdf+xml", "rdf"),
    NTRIPLES(RDFFormat.NTRIPLES, "application/n-triples", "nt"),
    JSONLD(RDFFormat.JSONLD_PRETTY, "application/ld+json", "jsonld");

    final RDFFormat rdfFormat;
    final String mediaType;
    final String extension;

    Format(RDFFormat rdfFormat, String mediaType, String extension) {
      this.rdfFormat = rdfFormat;
      this.mediaType = mediaType;
      this.extension = extension;
    }

    static Format parse(String requested) {
      if (requested == null) {
        return TURTLE;
      }
      return switch (requested.toLowerCase()) {
        case "rdfxml", "rdf+xml", "rdf/xml" -> RDFXML;
        case "ntriples", "n-triples" -> NTRIPLES;
        case "jsonld", "json-ld", "ld+json" -> JSONLD;
        default -> TURTLE;
      };
    }
  }
}

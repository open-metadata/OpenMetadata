package org.openmetadata.service.resources.rdf;

import java.io.IOException;
import java.io.InputStream;
import lombok.extern.slf4j.Slf4j;
import org.apache.jena.graph.Graph;
import org.apache.jena.rdf.model.Model;
import org.apache.jena.rdf.model.ModelFactory;
import org.apache.jena.riot.Lang;
import org.apache.jena.riot.RDFDataMgr;
import org.apache.jena.shacl.Shapes;
import org.apache.jena.shacl.ValidationReport;

/**
 * Loads {@code openmetadata-shapes.ttl} from the classpath and validates an arbitrary RDF model
 * against it. The validation is "report only" — callers decide whether a non-empty report is a
 * blocker. The shapes graph is parsed once per JVM (Holder pattern).
 */
@Slf4j
public final class RdfShaclValidator {

  private static final String SHAPES_RESOURCE = "/rdf/shapes/openmetadata-shapes.ttl";

  private RdfShaclValidator() {}

  private static final class Holder {
    private static final Shapes SHAPES = loadShapes();
  }

  private static Shapes loadShapes() {
    Model shapesModel = ModelFactory.createDefaultModel();
    try (InputStream is = RdfShaclValidator.class.getResourceAsStream(SHAPES_RESOURCE)) {
      if (is == null) {
        LOG.warn("SHACL shapes resource not found on classpath: {}", SHAPES_RESOURCE);
        return Shapes.parse(shapesModel.getGraph());
      }
      RDFDataMgr.read(shapesModel, is, Lang.TURTLE);
    } catch (IOException e) {
      LOG.warn("Failed to read SHACL shapes resource {}: {}", SHAPES_RESOURCE, e.getMessage());
    } catch (RuntimeException e) {
      // RDFDataMgr.read can throw RiotException (and other Jena RuntimeExceptions) on a malformed
      // TTL. Catch broadly so a corrupt resource degrades to an empty shape set rather than
      // failing class initialization and taking down callers (RdfResource, MCP tools).
      LOG.warn("Failed to parse SHACL shapes resource {}: {}", SHAPES_RESOURCE, e.getMessage());
      shapesModel = ModelFactory.createDefaultModel();
    }
    return Shapes.parse(shapesModel.getGraph());
  }

  /** Validate {@code data} against the OpenMetadata shapes. Never throws on conforming data. */
  public static ValidationReport validate(Graph data) {
    return org.apache.jena.shacl.ShaclValidator.get().validate(Holder.SHAPES, data);
  }

  public static ValidationReport validate(Model data) {
    return validate(data.getGraph());
  }

  /** Expose the shapes for callers that need to inspect or extend them. */
  public static Shapes shapes() {
    return Holder.SHAPES;
  }
}

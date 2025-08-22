package org.openmetadata.service.rdf;

import java.io.InputStream;
import lombok.extern.slf4j.Slf4j;

@Slf4j
public class OntologyLoader {

  private static final String ONTOLOGY_PATH = "/rdf/ontology/";
  private static final String SHAPES_PATH = "/rdf/shapes/";
  private static final String ONTOLOGY_GRAPH = "https://open-metadata.org/graph/ontology";
  private static final String SHAPES_GRAPH = "https://open-metadata.org/graph/shapes";

  private final RdfRepository rdfRepository;

  public OntologyLoader(RdfRepository rdfRepository) {
    this.rdfRepository = rdfRepository;
  }

  /**
   * Load all ontologies and shapes into the RDF store
   */
  public void loadOntologies() {
    if (!rdfRepository.isEnabled()) {
      LOG.info("RDF repository is not enabled, skipping ontology loading");
      return;
    }

    try {
      // Load the complete ontology
      loadOntologyFile("openmetadata.ttl", ONTOLOGY_GRAPH);

      // Load SHACL shapes
      loadShapesFile("openmetadata-shapes.ttl", SHAPES_GRAPH);

      LOG.info("Successfully loaded OpenMetadata ontologies and shapes");
    } catch (Exception e) {
      LOG.error("Failed to load ontologies", e);
    }
  }

  /**
   * Load a single ontology file into a named graph
   */
  private void loadOntologyFile(String filename, String graphUri) {
    String path = ONTOLOGY_PATH + filename;
    try (InputStream is = getClass().getResourceAsStream(path)) {
      if (is == null) {
        LOG.warn("Ontology file not found: {}", path);
        return;
      }

      // Instead of loading into memory and converting, directly load the file
      rdfRepository.loadTurtleFile(is, graphUri);

      LOG.info("Loaded ontology {} into graph {}", filename, graphUri);
    } catch (Exception e) {
      LOG.error("Failed to load ontology file: {}", filename, e);
    }
  }

  /**
   * Load a SHACL shapes file into a named graph
   */
  private void loadShapesFile(String filename, String graphUri) {
    String path = SHAPES_PATH + filename;
    try (InputStream is = getClass().getResourceAsStream(path)) {
      if (is == null) {
        LOG.warn("Shapes file not found: {}", path);
        return;
      }

      // Instead of loading into memory and converting, directly load the file
      rdfRepository.loadTurtleFile(is, graphUri);

      LOG.info("Loaded shapes {} into graph {}", filename, graphUri);
    } catch (Exception e) {
      LOG.error("Failed to load shapes file: {}", filename, e);
    }
  }

  /**
   * Check if ontologies are already loaded
   */
  public boolean areOntologiesLoaded() {
    try {
      String checkQuery = "ASK { GRAPH <" + ONTOLOGY_GRAPH + "> { ?s ?p ?o } }";
      String result =
          rdfRepository.executeSparqlQuery(checkQuery, "application/sparql-results+json");
      return result.contains("\"boolean\" : true");
    } catch (Exception e) {
      LOG.error("Failed to check if ontologies are loaded", e);
      return false;
    }
  }
}

package org.openmetadata.service.resources.rdf;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import jakarta.ws.rs.core.Response;
import org.apache.jena.rdf.model.Model;
import org.apache.jena.rdf.model.ModelFactory;
import org.apache.jena.riot.Lang;
import org.apache.jena.riot.RDFDataMgr;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class OntologyDocumentTest {

  private static final String OM_NS = "https://open-metadata.org/ontology/";
  private static final String OWL_VERSION_INFO = "http://www.w3.org/2002/07/owl#versionInfo";

  @Test
  @DisplayName(
      "Ontology endpoint serves Turtle by default with the bumped version and core classes")
  void testServeTurtle() {
    Response response = OntologyDocument.serve("turtle");
    assertEquals(200, response.getStatus());
    String body = response.getEntity().toString();
    assertNotNull(body);

    Model parsed = ModelFactory.createDefaultModel();
    RDFDataMgr.read(
        parsed,
        new java.io.ByteArrayInputStream(body.getBytes(java.nio.charset.StandardCharsets.UTF_8)),
        Lang.TURTLE);

    assertTrue(
        parsed.contains(
            parsed.createResource(OM_NS),
            parsed.createProperty(OWL_VERSION_INFO),
            parsed.createLiteral("1.1.0")),
        "Ontology document should declare owl:versionInfo \"1.1.0\" on the om: ontology");

    assertTrue(
        parsed.containsResource(parsed.createResource(OM_NS + "Column")),
        "Core om:Column class must be present in the served ontology");
    assertTrue(
        parsed.containsResource(parsed.createResource(OM_NS + "TableConstraint")),
        "Newly added om:TableConstraint class must be present");
    assertTrue(
        parsed.containsResource(parsed.createResource(OM_NS + "LineageDetails")),
        "Newly declared om:LineageDetails class must be present");
  }

  @Test
  @DisplayName("Ontology endpoint can render the same document as JSON-LD")
  void testServeJsonLd() {
    Response response = OntologyDocument.serve("jsonld");
    assertEquals(200, response.getStatus());
    assertEquals("application/ld+json", response.getMediaType().toString());
    String body = response.getEntity().toString();
    assertTrue(body.contains("@context") || body.contains("@graph"));
  }

  @Test
  @DisplayName("Unknown format defaults to Turtle")
  void testUnknownFormatFallsBackToTurtle() {
    Response response = OntologyDocument.serve("nonsense");
    assertEquals(200, response.getStatus());
    assertEquals("text/turtle", response.getMediaType().toString());
  }
}

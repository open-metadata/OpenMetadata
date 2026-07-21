/*
 *  Copyright 2026 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

package org.openmetadata.service.resources.rdf;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.io.ByteArrayInputStream;
import java.nio.charset.StandardCharsets;
import org.apache.jena.rdf.model.Model;
import org.apache.jena.rdf.model.ModelFactory;
import org.apache.jena.riot.Lang;
import org.apache.jena.riot.RDFDataMgr;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.openmetadata.service.rdf.OntologyDocument;

class OntologyDocumentTest {

  private static final String OM_NS = "https://open-metadata.org/ontology/";
  private static final String OWL_VERSION_INFO = "http://www.w3.org/2002/07/owl#versionInfo";

  @Test
  @DisplayName(
      "Ontology endpoint serves Turtle by default with the bumped version and core classes")
  void testServeTurtle() {
    OntologyDocument.SerializedOntology ontology = OntologyDocument.serialize("turtle");
    String body = ontology.body();
    assertNotNull(body);

    Model parsed = ModelFactory.createDefaultModel();
    RDFDataMgr.read(
        parsed, new ByteArrayInputStream(body.getBytes(StandardCharsets.UTF_8)), Lang.TURTLE);

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
    OntologyDocument.SerializedOntology ontology = OntologyDocument.serialize("jsonld");
    assertEquals("application/ld+json", ontology.mediaType());
    String body = ontology.body();
    assertTrue(body.contains("@context") || body.contains("@graph"));
  }

  @Test
  @DisplayName("Unknown format is rejected")
  void testUnknownFormatIsRejected() {
    assertThrows(IllegalArgumentException.class, () -> OntologyDocument.serialize("nonsense"));
  }
}

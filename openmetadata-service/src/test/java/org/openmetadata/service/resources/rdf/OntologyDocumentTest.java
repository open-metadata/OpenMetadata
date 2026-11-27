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
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.io.ByteArrayInputStream;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Set;
import org.apache.jena.rdf.model.Model;
import org.apache.jena.rdf.model.ModelFactory;
import org.apache.jena.rdf.model.Property;
import org.apache.jena.rdf.model.Resource;
import org.apache.jena.rdf.model.ResourceFactory;
import org.apache.jena.riot.Lang;
import org.apache.jena.riot.RDFDataMgr;
import org.apache.jena.vocabulary.RDFS;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.openmetadata.service.rdf.OntologyDocument;

class OntologyDocumentTest {

  private static final String OM_NS = "https://open-metadata.org/ontology/";
  private static final Property DOMAIN_INCLUDES =
      ResourceFactory.createProperty("https://schema.org/domainIncludes");
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
            parsed.createLiteral("2.1.0")),
        "Ontology document should declare owl:versionInfo \"2.1.0\" on the om: ontology");

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

  @Test
  @DisplayName(
      "A class reads back with the properties whose domain covers it, each with its comment")
  void testDescribeClassWithApplicableProperties() {
    Model term =
        parse(OntologyDocument.describeTerm("om:Table", "turtle").orElseThrow().document().body());

    assertCommented(term, "Table");
    assertCommented(term, "joinedWith");
    assertCommented(term, "fullyQualifiedName");
    assertCommented(term, "hasColumn");
    assertCommented(term, "belongsToSchema");
    assertCommented(term, "belongsToDomain");
    assertCommented(term, "downstream");
    assertFalse(
        term.contains(term.createResource(OM_NS + "belongsToDomain"), DOMAIN_INCLUDES),
        "A shared property is listed with its label and comment only");
    assertFalse(
        term.containsResource(term.createResource(OM_NS + "hasChart")),
        "A dashboard-only property must not be listed for om:Table");
  }

  @Test
  @DisplayName("A column reads back with the shared properties the projection uses on columns")
  void testDescribeColumnWithSharedProperties() {
    Model term =
        parse(OntologyDocument.describeTerm("om:Column", "turtle").orElseThrow().document().body());

    assertCommented(term, "Column");
    assertCommented(term, "hasChildColumn");
    assertTrue(term.contains(term.createResource(OM_NS + "hasChildColumn"), RDFS.label));
  }

  @Test
  void testDescribeInputPortWithUnionDomainProperties() {
    final Model term =
        parse(
            OntologyDocument.describeTerm("om:InputPort", "turtle")
                .orElseThrow()
                .document()
                .body());

    for (final String property :
        List.of("portName", "portProtocol", "portFormat", "portEndpoint", "portDataAsset")) {
      assertCommented(term, property);
    }
  }

  @Test
  @DisplayName("A shared property read on its own lists the classes the projection uses it on")
  void testDescribeSharedPropertyListsItsClasses() {
    Model term =
        parse(
            OntologyDocument.describeTerm("om:belongsToDomain", "turtle")
                .orElseThrow()
                .document()
                .body());

    assertTrue(
        term.contains(
            term.createResource(OM_NS + "belongsToDomain"),
            DOMAIN_INCLUDES,
            term.createResource(OM_NS + "Table")));
  }

  @Test
  @DisplayName("A property reads back alone, by prefixed name or full IRI")
  void testDescribeProperty() {
    Model term =
        parse(
            OntologyDocument.describeTerm(OM_NS + "upstream", "turtle")
                .orElseThrow()
                .document()
                .body());

    assertCommented(term, "upstream");
    assertEquals(
        Set.of(term.createResource(OM_NS + "upstream")),
        term.listSubjects().filterKeep(Resource::isURIResource).toSet());
    assertEquals(
        term.size(),
        parse(
                OntologyDocument.describeTerm("om:upstream", "turtle")
                    .orElseThrow()
                    .document()
                    .body())
            .size());
  }

  @Test
  @DisplayName("A term the ontology does not declare reads back as absent")
  void testDescribeUnknownTerm() {
    assertTrue(OntologyDocument.describeTerm("om:NoSuchTerm", "turtle").isEmpty());
    assertTrue(OntologyDocument.describeTerm("nope:Table", "turtle").isEmpty());
  }

  private static Model parse(String body) {
    Model parsed = ModelFactory.createDefaultModel();
    RDFDataMgr.read(
        parsed, new ByteArrayInputStream(body.getBytes(StandardCharsets.UTF_8)), Lang.TURTLE);
    return parsed;
  }

  private static void assertCommented(Model term, String localName) {
    assertTrue(
        term.contains(term.createResource(OM_NS + localName), RDFS.comment),
        "om:" + localName + " must be described with its rdfs:comment");
  }
}

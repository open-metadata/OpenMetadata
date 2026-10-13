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

package org.openmetadata.service.rdf;

import static org.junit.jupiter.api.Assertions.assertEquals;

import java.io.File;
import java.io.StringWriter;
import java.util.List;
import org.apache.jena.rdf.model.Model;
import org.apache.jena.riot.Lang;
import org.apache.jena.riot.RDFDataMgr;
import org.semanticweb.owlapi.apibinding.OWLManager;
import org.semanticweb.owlapi.formats.TurtleDocumentFormat;
import org.semanticweb.owlapi.io.OWLParserException;
import org.semanticweb.owlapi.io.RDFParserMetaData;
import org.semanticweb.owlapi.io.StringDocumentSource;
import org.semanticweb.owlapi.model.IRI;
import org.semanticweb.owlapi.model.MissingImportHandlingStrategy;
import org.semanticweb.owlapi.model.OWLOntology;
import org.semanticweb.owlapi.model.OWLOntologyCreationException;
import org.semanticweb.owlapi.model.OWLOntologyLoaderConfiguration;
import org.semanticweb.owlapi.model.OWLOntologyManager;
import org.semanticweb.owlapi.profiles.OWL2DLProfile;
import org.semanticweb.owlapi.profiles.OWLProfileViolation;

/**
 * Reads a Jena projection the way the reasoner worker in the openmetadata/fuseki image does: OWL
 * API 5.5.1, no network, no punning repair, non-strict parsing. Rejects any placeholder OWL API
 * substitutes for a malformed construct and any triple the OWL 2 RDF mapping cannot consume.
 */
final class OwlApiProjection {
  private static final String OWLAPI_ERROR_NAMESPACE = "http://org.semanticweb.owlapi/error#";
  private static final IRI NO_NETWORK =
      IRI.create(new File("/nonexistent/openmetadata-tests/imports-are-never-fetched").toURI());

  private OwlApiProjection() {}

  static OWLOntology parse(final Model model) {
    final OWLOntologyManager manager = OWLManager.createOWLOntologyManager();
    manager.getIRIMappers().clear();
    manager.getIRIMappers().add(iri -> NO_NETWORK);
    final OWLOntology ontology;
    try {
      ontology =
          manager.loadOntologyFromOntologyDocument(
              new StringDocumentSource(
                  nTriples(model), "urn:openmetadata:test", new TurtleDocumentFormat(), null),
              configuration());
    } catch (OWLOntologyCreationException | OWLParserException exception) {
      throw new AssertionError("OWL API could not parse the projection", exception);
    }
    assertEquals(List.of(), malformedConstructs(ontology), "malformed constructs");
    assertEquals(List.of(), unparsedTriples(ontology), "triples the OWL 2 mapping cannot consume");
    return ontology;
  }

  static List<String> dlViolations(final OWLOntology ontology) {
    return new OWL2DLProfile()
        .checkOntology(ontology).getViolations().stream()
            .map(OWLProfileViolation::toString)
            .sorted()
            .toList();
  }

  /**
   * N-Triples, read with OWL API's Turtle parser, as the worker reads its closure document: Jena 6
   * writes Turtle with SPARQL-style PREFIX lines, which OWL API 5 does not accept.
   */
  static String nTriples(final Model model) {
    final StringWriter writer = new StringWriter();
    RDFDataMgr.write(writer, model, Lang.NTRIPLES);
    return writer.toString();
  }

  private static OWLOntologyLoaderConfiguration configuration() {
    return new OWLOntologyLoaderConfiguration()
        .setMissingImportHandlingStrategy(MissingImportHandlingStrategy.THROW_EXCEPTION)
        .setFollowRedirects(false)
        .setRetriesToAttempt(0)
        .setRepairIllegalPunnings(false)
        .setReportStackTraces(false)
        .setStrict(false);
  }

  private static List<String> malformedConstructs(final OWLOntology ontology) {
    return ontology
        .signature()
        .map(entity -> entity.getIRI().toString())
        .filter(iri -> iri.startsWith(OWLAPI_ERROR_NAMESPACE))
        .sorted()
        .toList();
  }

  private static List<String> unparsedTriples(final OWLOntology ontology) {
    return ontology
        .getFormat()
        .getOntologyLoaderMetaData()
        .filter(RDFParserMetaData.class::isInstance)
        .map(RDFParserMetaData.class::cast)
        .map(meta -> meta.getUnparsedTriples().map(Object::toString).sorted().toList())
        .orElse(List.of());
  }
}

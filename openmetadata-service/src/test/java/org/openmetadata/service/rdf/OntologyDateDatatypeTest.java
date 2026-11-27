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
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.net.URI;
import java.util.List;
import org.apache.jena.datatypes.TypeMapper;
import org.apache.jena.rdf.model.Model;
import org.apache.jena.rdf.model.ModelFactory;
import org.apache.jena.rdf.model.Resource;
import org.apache.jena.vocabulary.OWL2;
import org.apache.jena.vocabulary.RDF;
import org.apache.jena.vocabulary.RDFS;
import org.apache.jena.vocabulary.XSD;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.entity.data.OntologyAxiom;
import org.openmetadata.schema.entity.data.OntologyProperty;
import org.openmetadata.schema.type.OntologyAxiomType;
import org.openmetadata.schema.type.OntologyExpression;
import org.openmetadata.schema.type.OntologyExpressionKind;
import org.openmetadata.schema.type.OntologyLiteral;
import org.openmetadata.schema.type.OntologyPropertyKind;
import org.openmetadata.schema.type.OntologyRestrictionKind;
import org.openmetadata.service.ontology.NativeOntologyDocument;
import org.openmetadata.service.ontology.OntologyPropertyRules;
import org.openmetadata.service.ontology.OwlDatatypeSupport;
import org.semanticweb.owlapi.model.IRI;
import org.semanticweb.owlapi.model.OWLDatatype;
import org.semanticweb.owlapi.model.OWLOntology;

class OntologyDateDatatypeTest {
  private static final URI PROPERTY = URI.create("https://example.org/onto/birthDate");
  private static final URI PERSON = URI.create("https://example.org/onto/Person");

  private static OntologyProperty dateProperty(final URI range) {
    return new OntologyProperty()
        .withIri(PROPERTY)
        .withKind(OntologyPropertyKind.DATA)
        .withRange(List.of(range));
  }

  @Test
  void dateRangeIsAcceptedAndXsdDateIsNot() {
    assertNull(OntologyPropertyRules.datatypeViolation(dateProperty(OwlDatatypeSupport.DATE)));
    assertNotNull(
        OntologyPropertyRules.datatypeViolation(dateProperty(URI.create(XSD.date.getURI()))));
  }

  @Test
  void exportDefinesDateAsDateTime() {
    final Model model = ModelFactory.createDefaultModel();
    OntologyPropertyRdfWriter.write(model, dateProperty(OwlDatatypeSupport.DATE), null);
    final Resource date = model.createResource(OwlDatatypeSupport.DATE.toString());
    assertTrue(model.contains(date, RDF.type, RDFS.Datatype));
    assertTrue(model.contains(date, OWL2.equivalentClass, XSD.dateTime));
    assertTrue(model.contains(model.createResource(PROPERTY.toString()), RDFS.range, date));
  }

  @Test
  void exportedDatePropertyReimportsWithoutSkips() {
    final Model model = ModelFactory.createDefaultModel();
    OntologyPropertyRdfWriter.write(model, dateProperty(OwlDatatypeSupport.DATE), null);
    final NativeOntologyDocument document = NativeOntologyRdfImporter.read(model);
    assertEquals(0, document.skipped().getTotal());
    assertEquals(List.of(), document.axioms());
    assertEquals(List.of(), document.concepts());
    assertEquals(1, document.properties().size());
    assertEquals(List.of(OwlDatatypeSupport.DATE), document.properties().getFirst().getRange());
  }

  @Test
  void dateDefinitionAloneNeverBecomesAnAxiom() {
    final Model model = ModelFactory.createDefaultModel();
    model
        .createResource(OwlDatatypeSupport.DATE.toString())
        .addProperty(RDF.type, RDFS.Datatype)
        .addProperty(OWL2.equivalentClass, XSD.dateTime);
    final NativeOntologyDocument document = NativeOntologyRdfImporter.read(model);
    assertEquals(List.of(), document.axioms());
    assertEquals(List.of(), document.concepts());
  }

  @Test
  void dateValuesAreTypedAsDateTime() {
    assertTrue(
        OwlDatatypeSupport.isValidLiteral(
            new OntologyLiteral()
                .withValue("2026-11-16T00:00:00")
                .withDatatypeIri(URI.create(XSD.dateTime.getURI()))));
    // Parsing any om:date literal registers a permissive type in Jena's JVM-wide TypeMapper.
    TypeMapper.getInstance().getSafeTypeByName(OwlDatatypeSupport.DATE.toString());
    // OWL 2 gives a defined datatype no lexical space, so no literal can carry it.
    assertFalse(
        OwlDatatypeSupport.isValidLiteral(
            new OntologyLiteral()
                .withValue("2026-11-16T00:00:00")
                .withDatatypeIri(OwlDatatypeSupport.DATE)));
  }

  @Test
  void exportedDateRangeIsOwl2Dl() {
    final Model model = ModelFactory.createDefaultModel();
    OntologyPropertyRdfWriter.write(model, dateProperty(OwlDatatypeSupport.DATE), null);
    final OWLOntology ontology = OwlApiProjection.parse(model);
    assertEquals(List.of(), OwlApiProjection.dlViolations(ontology));
    assertEquals(1, ontology.datatypeDefinitions(datatype(ontology)).count());
  }

  @Test
  void restrictionOverDateIsADataRestrictionDefinedAsDateTime() {
    final Model model = ModelFactory.createDefaultModel();
    new OntologyExpressionRdfWriter(iri -> false).write(model, someDate());
    final Resource date = model.createResource(OwlDatatypeSupport.DATE.toString());
    assertTrue(model.contains(null, OWL2.someValuesFrom, date));
    assertTrue(model.contains(date, OWL2.equivalentClass, XSD.dateTime));
    final OWLOntology ontology = OwlApiProjection.parse(model);
    assertEquals(List.of(), OwlApiProjection.dlViolations(ontology));
    assertEquals(1, ontology.datatypeDefinitions(datatype(ontology)).count());
  }

  private static OWLDatatype datatype(final OWLOntology ontology) {
    return ontology
        .getOWLOntologyManager()
        .getOWLDataFactory()
        .getOWLDatatype(IRI.create(OwlDatatypeSupport.DATE));
  }

  private static OntologyAxiom someDate() {
    final OntologyExpression restriction =
        new OntologyExpression()
            .withKind(OntologyExpressionKind.RESTRICTION)
            .withPropertyIri(PROPERTY)
            .withRestrictionKind(OntologyRestrictionKind.SOME)
            .withFiller(
                new OntologyExpression()
                    .withKind(OntologyExpressionKind.NAMED_CLASS)
                    .withClassIri(OwlDatatypeSupport.DATE));
    return new OntologyAxiom()
        .withAxiomType(OntologyAxiomType.SUBCLASS_OF)
        .withSubjectIri(PERSON)
        .withExpressions(List.of(restriction));
  }
}

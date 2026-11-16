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
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.net.URI;
import java.util.List;
import org.apache.jena.rdf.model.Model;
import org.apache.jena.rdf.model.ModelFactory;
import org.apache.jena.rdf.model.Resource;
import org.apache.jena.vocabulary.OWL2;
import org.apache.jena.vocabulary.RDF;
import org.apache.jena.vocabulary.RDFS;
import org.apache.jena.vocabulary.XSD;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.entity.data.OntologyProperty;
import org.openmetadata.schema.type.OntologyLiteral;
import org.openmetadata.schema.type.OntologyPropertyKind;
import org.openmetadata.service.ontology.NativeOntologyDocument;
import org.openmetadata.service.ontology.OntologyPropertyRules;
import org.openmetadata.service.ontology.OwlDatatypeSupport;

class OntologyDateDatatypeTest {
  private static final URI PROPERTY = URI.create("https://example.org/onto/birthDate");

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
    assertEquals(1, document.properties().size());
    assertEquals(List.of(OwlDatatypeSupport.DATE), document.properties().getFirst().getRange());
  }

  @Test
  void dateValuesAreTypedAsDateTime() {
    assertTrue(
        OwlDatatypeSupport.isValidLiteral(
            new OntologyLiteral()
                .withValue("2026-11-16T00:00:00")
                .withDatatypeIri(URI.create(XSD.dateTime.getURI()))));
    // OWL 2 gives a defined datatype no lexical space, so no literal can carry it.
    assertEquals(
        false,
        OwlDatatypeSupport.isValidLiteral(
            new OntologyLiteral()
                .withValue("2026-11-16T00:00:00")
                .withDatatypeIri(OwlDatatypeSupport.DATE)));
  }
}

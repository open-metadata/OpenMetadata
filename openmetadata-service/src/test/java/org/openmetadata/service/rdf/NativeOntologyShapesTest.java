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
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;
import org.apache.jena.rdf.model.Model;
import org.apache.jena.rdf.model.ModelFactory;
import org.apache.jena.rdf.model.RDFNode;
import org.apache.jena.rdf.model.Resource;
import org.apache.jena.shacl.ValidationReport;
import org.apache.jena.vocabulary.OWL2;
import org.apache.jena.vocabulary.RDF;
import org.apache.jena.vocabulary.RDFS;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.type.NativeOntologyShaclReport;
import org.openmetadata.schema.type.NativeOntologyShaclSeverity;
import org.openmetadata.service.rdf.RdfShaclValidator.ShapeSet;

class NativeOntologyShapesTest {
  private static final String EX = "https://example.org/ontology/";
  private static final String SHAPES = "https://open-metadata.org/shapes/native-ontology#";

  private final RdfShaclReportMapper mapper = new RdfShaclReportMapper();

  @Test
  void namedCatalogSelectionRetainsTheDefaultShapes() {
    assertSame(RdfShaclValidator.shapes(), RdfShaclValidator.shapes(ShapeSet.CATALOG));
  }

  @Test
  void missingOrMalformedShapeResourcesFailClosed() {
    assertThrows(
        IllegalStateException.class,
        () -> RdfShaclValidator.loadShapes("/rdf/shapes/missing-native-test.ttl"));
    assertThrows(
        IllegalStateException.class,
        () -> RdfShaclValidator.loadShapes("/rdf/shapes/malformed-native-test.ttl"));
  }

  @Test
  void missingClassLabelIsNamedViolation() {
    Model model = ModelFactory.createDefaultModel();
    try {
      namedClass(model, "Unlabeled");
      NativeOntologyShaclReport report = validate(model);
      assertEquals(1, report.getViolationCount());
      assertEquals(0, report.getWarningCount());
      assertEquals(EX + "Unlabeled", report.getFindings().getFirst().getFocusIri().toString());
      assertEquals(
          SHAPES + "ClassLabelShape", report.getFindings().getFirst().getShapeIri().toString());
      assertEquals("Class needs an rdfs:label", report.getFindings().getFirst().getMessage());
    } finally {
      model.close();
    }
  }

  @Test
  void labeledClassPasses() {
    Model model = ModelFactory.createDefaultModel();
    try {
      namedClass(model, "Labeled").addProperty(RDFS.label, "Labeled");
      assertEquals(0, validate(model).getViolationCount());
    } finally {
      model.close();
    }
  }

  @Test
  void zeroAndOneCellEnumsFailAndTwoCellsPass() {
    for (int size = 0; size <= 2; size++) {
      Model model = ModelFactory.createDefaultModel();
      try {
        Resource property =
            model.createResource(EX + "status").addProperty(RDF.type, OWL2.DatatypeProperty);
        Resource range = model.createResource(EX + "statusValues");
        property.addProperty(RDFS.range, range);
        range.addProperty(
            OWL2.equivalentClass,
            model
                .createResource()
                .addProperty(
                    OWL2.oneOf,
                    model.createList(
                        List.<RDFNode>of(model.createLiteral("same"), model.createLiteral("same"))
                            .subList(0, size)
                            .iterator())));
        NativeOntologyShaclReport report = validate(model);
        assertEquals(size < 2 ? 1 : 0, report.getViolationCount(), "list size " + size);
        if (size < 2) {
          assertEquals(EX + "status", report.getFindings().getFirst().getFocusIri().toString());
          assertEquals(
              SHAPES + "EnumerationShape",
              report.getFindings().getFirst().getShapeIri().toString());
        }
      } finally {
        model.close();
      }
    }
  }

  @Test
  void propertyWithoutEnumerationPasses() {
    Model model = ModelFactory.createDefaultModel();
    try {
      model.createResource(EX + "status").addProperty(RDF.type, OWL2.DatatypeProperty);
      assertEquals(0, validate(model).getViolationCount());
    } finally {
      model.close();
    }
  }

  @Test
  void findingsCapPreservesTotalViolationCount() {
    Model model = ModelFactory.createDefaultModel();
    try {
      for (int index = 0; index < 1_001; index++) {
        namedClass(model, "Unlabeled" + index);
      }
      Resource deprecated =
          namedClass(model, "Deprecated")
              .addProperty(RDFS.label, "Deprecated")
              .addLiteral(OWL2.deprecated, true);
      namedClass(model, "Child")
          .addProperty(RDFS.label, "Child")
          .addProperty(RDFS.subClassOf, deprecated);
      NativeOntologyShaclReport report = validate(model);
      assertEquals(1_001, report.getViolationCount());
      assertEquals(1, report.getWarningCount());
      assertEquals(1_000, report.getFindings().size());
      assertTrue(report.getTruncated());
      assertEquals(
          SHAPES + "DeprecatedParentShape",
          report.getFindings().getFirst().getShapeIri().toString());
    } finally {
      model.close();
    }
  }

  @Test
  void directDeprecatedParentWarnsOnlyForActiveChild() {
    Model model = ModelFactory.createDefaultModel();
    try {
      Resource parent =
          namedClass(model, "Parent")
              .addProperty(RDFS.label, "Parent")
              .addLiteral(OWL2.deprecated, true);
      Resource child =
          namedClass(model, "Child")
              .addProperty(RDFS.label, "Child")
              .addProperty(RDFS.subClassOf, parent);
      NativeOntologyShaclReport warning = validate(model);
      assertEquals(0, warning.getViolationCount());
      assertEquals(1, warning.getWarningCount());
      assertEquals(
          NativeOntologyShaclSeverity.WARNING, warning.getFindings().getFirst().getSeverity());
      assertEquals(
          SHAPES + "DeprecatedParentShape",
          warning.getFindings().getFirst().getShapeIri().toString());
      child.addLiteral(OWL2.deprecated, true);
      assertEquals(0, validate(model).getWarningCount());
    } finally {
      model.close();
    }
  }

  @Test
  void anonymousOrNonDeprecatedParentDoesNotWarn() {
    Model model = ModelFactory.createDefaultModel();
    try {
      Resource child = namedClass(model, "Child").addProperty(RDFS.label, "Child");
      child.addProperty(RDFS.subClassOf, model.createResource().addLiteral(OWL2.deprecated, true));
      assertEquals(0, validate(model).getWarningCount());
      assertFalse(
          RdfShaclValidator.validate(model, ShapeSet.CATALOG).getEntries().stream()
              .anyMatch(
                  entry ->
                      SHAPES
                          .concat("DeprecatedParentShape")
                          .equals(String.valueOf(entry.source()))));
    } finally {
      model.close();
    }
  }

  private NativeOntologyShaclReport validate(Model model) {
    ValidationReport report = RdfShaclValidator.validate(model, ShapeSet.NATIVE_ONTOLOGY);
    return mapper.mapNative(report);
  }

  private static Resource namedClass(Model model, String localName) {
    return model.createResource(EX + localName).addProperty(RDF.type, OWL2.Class);
  }
}

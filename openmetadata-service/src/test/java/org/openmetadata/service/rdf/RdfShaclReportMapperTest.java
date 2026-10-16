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
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.io.StringReader;
import java.util.ArrayList;
import java.util.List;
import org.apache.jena.rdf.model.Model;
import org.apache.jena.rdf.model.ModelFactory;
import org.apache.jena.riot.Lang;
import org.apache.jena.riot.RDFDataMgr;
import org.apache.jena.shacl.ShaclValidator;
import org.apache.jena.shacl.Shapes;
import org.apache.jena.shacl.ValidationReport;
import org.apache.jena.shacl.validation.ReportEntry;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.type.RdfValidationReport;
import org.openmetadata.schema.type.RdfValidationViolation;

class RdfShaclReportMapperTest {

  private static final String SHACL = "http://www.w3.org/ns/shacl#";
  private static final String EX = "http://example.com/";
  private static final int MAX_TYPED_VIOLATIONS = 1_000;

  private final RdfShaclReportMapper mapper = new RdfShaclReportMapper();

  @Test
  void severityIsShaclIriNotObjectHash() {
    ValidationReport report =
        validate(minCountShape(SHACL + "Violation", EX + "alice"), emptyModel());

    ReportEntry entry = new ArrayList<>(report.getEntries()).get(0);
    assertTrue(entry.severity().level().isURI(), "severity level must be a URI IRI node");
    assertEquals(SHACL + "Violation", entry.severity().level().getURI());

    RdfValidationReport mapped = mapper.map(report);
    assertEquals(1, mapped.getViolations().size());
    RdfValidationViolation violation = mapped.getViolations().get(0);

    assertEquals(
        SHACL + "Violation",
        violation.getSeverity(),
        "severity must be the SHACL Violation IRI, not the Object.toString() class-name+hash form");
    assertFalse(
        violation.getSeverity().startsWith("org.apache.jena.shacl.validation.Severity@"),
        "severity must not be the default Object.toString() class-name+hash form");
  }

  @Test
  void mapsEveryShaclSeverityToItsIri() {
    for (String severity : List.of("Info", "Warning", "Violation")) {
      ValidationReport report =
          validate(minCountShape(SHACL + severity, EX + "alice"), emptyModel());
      RdfValidationReport mapped = mapper.map(report);

      assertFalse(mapped.getViolations().isEmpty(), "expected a violation for sh:" + severity);
      String actual = mapped.getViolations().get(0).getSeverity();
      assertEquals(SHACL + severity, actual, "severity for sh:" + severity);
      assertFalse(
          actual.startsWith("org.apache.jena.shacl."),
          "severity must never leak the Jena Severity class-name form (was: " + actual + ")");
    }
  }

  @Test
  void populatesAllTypedViolationFieldsWithoutRegression() {
    ValidationReport report =
        validate(minCountShape(SHACL + "Violation", EX + "alice"), emptyModel());
    RdfValidationReport mapped = mapper.map(report);
    RdfValidationViolation violation = mapped.getViolations().get(0);

    assertEquals(EX + "alice", violation.getFocusNode());
    assertNotNull(
        violation.getResultPath(), "resultPath must be surfaced for a property-shape violation");
    assertTrue(
        violation.getResultPath().contains(EX + "name"),
        "resultPath must surface the ex:name IRI (was: " + violation.getResultPath() + ")");
    assertNotNull(violation.getMessage());
    assertFalse(violation.getMessage().isBlank(), "message must fall back to a non-blank default");
    assertEquals(SHACL + "Violation", violation.getSeverity());
  }

  @Test
  void reportTurtleStillCarriesShaclSeverityIri() {
    ValidationReport report =
        validate(minCountShape(SHACL + "Violation", EX + "alice"), emptyModel());
    RdfValidationReport mapped = mapper.map(report);

    assertNotNull(mapped.getReportTurtle());
    assertFalse(mapped.getReportTurtle().isBlank(), "reportTurtle must serialize the SHACL report");
    Model reportModel = ModelFactory.createDefaultModel();
    RDFDataMgr.read(reportModel, new StringReader(mapped.getReportTurtle()), null, Lang.TURTLE);
    assertTrue(
        reportModel.contains(
            null,
            reportModel.createProperty(SHACL + "resultSeverity"),
            reportModel.createResource(SHACL + "Violation")),
        "reportTurtle must carry the sh:resultSeverity sh:Violation triple (machine-readable path is unaffected by the mapper bug)");
  }

  @Test
  void typedViolationsAreTruncatedAboveLimitWhileCountAndReportStayComplete() {
    int targetCount = MAX_TYPED_VIOLATIONS + 1;
    String[] targets = new String[targetCount];
    for (int i = 0; i < targetCount; i++) {
      targets[i] = EX + "n" + i;
    }
    ValidationReport report = validate(minCountShape(SHACL + "Violation", targets), emptyModel());
    RdfValidationReport mapped = mapper.map(report);

    assertEquals(targetCount, mapped.getViolationCount());
    assertEquals(MAX_TYPED_VIOLATIONS, mapped.getViolations().size());
    assertTrue(mapped.getTruncated());
    for (RdfValidationViolation violation : mapped.getViolations()) {
      assertEquals(SHACL + "Violation", violation.getSeverity());
    }
    assertNotNull(mapped.getReportTurtle());
    assertFalse(
        mapped.getReportTurtle().isBlank(),
        "reportTurtle must remain complete when typed list is truncated");
  }

  private ValidationReport validate(String shapesTtl, Model data) {
    Model shapesModel = parseTurtle(shapesTtl);
    Shapes shapes = Shapes.parse(shapesModel.getGraph());
    return ShaclValidator.get().validate(shapes, data.getGraph());
  }

  private static Model emptyModel() {
    return ModelFactory.createDefaultModel();
  }

  private static Model parseTurtle(String ttl) {
    Model model = ModelFactory.createDefaultModel();
    RDFDataMgr.read(model, new StringReader(ttl), null, Lang.TURTLE);
    return model;
  }

  private static String minCountShape(String severityIri, String... targetUris) {
    StringBuilder shape = new StringBuilder();
    shape.append("@prefix sh: <").append(SHACL).append("> .\n");
    shape.append("@prefix ex: <").append(EX).append("> .\n\n");
    shape.append("ex:AliceShape a sh:NodeShape ;\n    sh:targetNode ");
    for (int i = 0; i < targetUris.length; i++) {
      if (i > 0) {
        shape.append(", ");
      }
      shape.append("<").append(targetUris[i]).append(">");
    }
    shape.append(" ;\n    sh:property [\n        sh:path ex:name ;\n");
    shape.append("        sh:minCount 1 ;\n        sh:severity <");
    shape.append(severityIri).append("> ;\n    ] .\n");
    return shape.toString();
  }
}

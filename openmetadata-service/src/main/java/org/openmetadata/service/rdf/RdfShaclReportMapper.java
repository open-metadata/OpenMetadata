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

import java.io.StringWriter;
import java.net.URI;
import java.util.Comparator;
import java.util.List;
import org.apache.jena.riot.RDFDataMgr;
import org.apache.jena.riot.RDFFormat;
import org.apache.jena.shacl.ValidationReport;
import org.apache.jena.shacl.validation.ReportEntry;
import org.apache.jena.shacl.validation.Severity;
import org.openmetadata.schema.type.NativeOntologyShaclFinding;
import org.openmetadata.schema.type.NativeOntologyShaclReport;
import org.openmetadata.schema.type.NativeOntologyShaclSeverity;
import org.openmetadata.schema.type.RdfValidationReport;
import org.openmetadata.schema.type.RdfValidationViolation;

public final class RdfShaclReportMapper {
  private static final int MAX_TYPED_VIOLATIONS = 1_000;

  public RdfValidationReport map(final ValidationReport report) {
    final List<ReportEntry> entries = List.copyOf(report.getEntries());
    final List<RdfValidationViolation> violations =
        entries.stream().limit(MAX_TYPED_VIOLATIONS).map(this::map).toList();
    return new RdfValidationReport()
        .withConforms(report.conforms())
        .withPerformed(true)
        .withReportTurtle(serialize(report))
        .withTruncated(entries.size() > MAX_TYPED_VIOLATIONS)
        .withViolationCount(entries.size())
        .withViolations(violations);
  }

  public RdfValidationReport skipped() {
    return new RdfValidationReport()
        .withConforms(true)
        .withPerformed(false)
        .withReportTurtle("")
        .withTruncated(false)
        .withViolationCount(0)
        .withViolations(List.of());
  }

  public NativeOntologyShaclReport mapNative(final ValidationReport report) {
    final List<ReportEntry> entries = List.copyOf(report.getEntries());
    final List<NativeOntologyShaclFinding> findings =
        entries.stream()
            .map(this::mapNative)
            .sorted(
                Comparator.comparing(
                        (NativeOntologyShaclFinding finding) -> finding.getFocusIri().toString())
                    .thenComparing(finding -> finding.getShapeIri().toString())
                    .thenComparing(finding -> finding.getSeverity().value())
                    .thenComparing(NativeOntologyShaclFinding::getMessage))
            .limit(MAX_TYPED_VIOLATIONS)
            .toList();
    final long warnings =
        entries.stream()
            .filter(entry -> severity(entry) == NativeOntologyShaclSeverity.WARNING)
            .count();
    return new NativeOntologyShaclReport()
        .withViolationCount(Math.toIntExact(entries.size() - warnings))
        .withWarningCount(Math.toIntExact(warnings))
        .withTruncated(entries.size() > MAX_TYPED_VIOLATIONS)
        .withFindings(findings);
  }

  private NativeOntologyShaclFinding mapNative(final ReportEntry entry) {
    if (entry.focusNode() == null
        || !entry.focusNode().isURI()
        || entry.source() == null
        || !entry.source().isURI()) {
      throw new IllegalStateException("Native SHACL finding requires named focus and shape IRIs");
    }
    return new NativeOntologyShaclFinding()
        .withFocusIri(URI.create(entry.focusNode().getURI()))
        .withShapeIri(URI.create(entry.source().getURI()))
        .withSeverity(severity(entry))
        .withMessage(
            entry.message() == null ? "Native ontology constraint violation" : entry.message());
  }

  private static NativeOntologyShaclSeverity severity(final ReportEntry entry) {
    final String level = entry.severity().level().getURI();
    if ("http://www.w3.org/ns/shacl#Warning".equals(level)) {
      return NativeOntologyShaclSeverity.WARNING;
    }
    if ("http://www.w3.org/ns/shacl#Violation".equals(level)) {
      return NativeOntologyShaclSeverity.VIOLATION;
    }
    throw new IllegalStateException("Unexpected native SHACL severity: " + level);
  }

  private RdfValidationViolation map(final ReportEntry entry) {
    return new RdfValidationViolation()
        .withFocusNode(stringValue(entry.focusNode()))
        .withMessage(entry.message() == null ? "SHACL constraint violation" : entry.message())
        .withResultPath(stringValue(entry.resultPath()))
        .withSeverity(severityIri(entry.severity()))
        .withSourceConstraint(stringValue(entry.sourceConstraintComponent()))
        .withValue(stringValue(entry.value()));
  }

  private static String serialize(final ValidationReport report) {
    final StringWriter writer = new StringWriter();
    RDFDataMgr.write(writer, report.getModel(), RDFFormat.TURTLE_PRETTY);
    return writer.toString();
  }

  private static String stringValue(final Object value) {
    return value == null ? null : value.toString();
  }

  private static String severityIri(final Severity severity) {
    return severity == null ? null : severity.level().toString();
  }
}

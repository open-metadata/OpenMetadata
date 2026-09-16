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
import java.util.List;
import org.apache.jena.riot.RDFDataMgr;
import org.apache.jena.riot.RDFFormat;
import org.apache.jena.shacl.ValidationReport;
import org.apache.jena.shacl.validation.ReportEntry;
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

  private RdfValidationViolation map(final ReportEntry entry) {
    return new RdfValidationViolation()
        .withFocusNode(stringValue(entry.focusNode()))
        .withMessage(entry.message() == null ? "SHACL constraint violation" : entry.message())
        .withResultPath(stringValue(entry.resultPath()))
        .withSeverity(stringValue(entry.severity()))
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
}

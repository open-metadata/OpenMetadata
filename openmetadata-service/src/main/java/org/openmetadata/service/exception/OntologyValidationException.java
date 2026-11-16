package org.openmetadata.service.exception;

import java.util.List;
import java.util.stream.Collectors;
import org.openmetadata.schema.api.data.OntologyValidationError;
import org.openmetadata.schema.type.OntologyReleaseStructureIssue;

public final class OntologyValidationException extends IllegalArgumentException {
  private final OntologyValidationError error;

  public OntologyValidationException(
      final int count, final List<OntologyReleaseStructureIssue> violations) {
    super(
        "Ontology validation failed: "
            + violations.stream()
                .limit(3)
                .map(issue -> issue.getViolation().getMessage())
                .collect(Collectors.joining("; ")));
    error =
        new OntologyValidationError()
            .withCode(400)
            .withMessage(getMessage())
            .withViolationCount(count)
            .withViolations(List.copyOf(violations));
  }

  public OntologyValidationError getError() {
    return error;
  }
}

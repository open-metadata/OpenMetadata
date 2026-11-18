package org.openmetadata.service.ontology;

import java.util.Optional;
import java.util.function.Supplier;
import org.openmetadata.schema.api.data.OntologyReleaseValidation;

/** The SHACL gate of a release export: a release that does not validate is not exported. */
public final class OntologyExportGate {
  private OntologyExportGate() {}

  /**
   * The report that refuses the export, or empty when the export may proceed. The validation only
   * runs when the gate is on, so an ungated export costs nothing extra.
   */
  public static Optional<OntologyReleaseValidation> refusal(
      final boolean shaclGate, final Supplier<OntologyReleaseValidation> validation) {
    return shaclGate
        ? Optional.of(validation.get()).filter(report -> !Boolean.TRUE.equals(report.getValid()))
        : Optional.empty();
  }
}

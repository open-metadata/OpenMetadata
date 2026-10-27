package org.openmetadata.service.ontology;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.api.data.OntologyReleaseValidation;

class OntologyExportGateTest {
  private final AtomicInteger validations = new AtomicInteger();

  private OntologyReleaseValidation report(final boolean valid) {
    validations.incrementAndGet();
    return new OntologyReleaseValidation().withValid(valid);
  }

  @Test
  void anInvalidReleaseIsRefusedWithItsReport() {
    final var refusal = OntologyExportGate.refusal(true, () -> report(false));

    assertEquals(false, refusal.orElseThrow().getValid());
  }

  @Test
  void aValidReleaseIsNotRefused() {
    assertTrue(OntologyExportGate.refusal(true, () -> report(true)).isEmpty());
  }

  @Test
  void aReportWithoutAVerdictIsRefused() {
    assertTrue(OntologyExportGate.refusal(true, () -> new OntologyReleaseValidation()).isPresent());
  }

  @Test
  void anUngatedExportNeverValidates() {
    assertTrue(OntologyExportGate.refusal(false, () -> report(false)).isEmpty());
    assertEquals(0, validations.get());
  }
}

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

package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import io.micrometer.core.instrument.MeterRegistry;
import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.openmetadata.it.tests.security.scale.ClassHistogram;
import org.openmetadata.it.tests.security.scale.CredentialMeters;
import org.openmetadata.it.tests.security.scale.Percentiles;

class CredentialScaleHelpersTest {
  @Test
  void percentilesUseTheNearestRank() {
    double[] samples = {50, 10, 40, 20, 30};

    assertEquals(30, Percentiles.of(samples, 50));
    assertEquals(50, Percentiles.of(samples, 95));
    assertEquals(10, Percentiles.of(samples, 1));
  }

  @Test
  void spreadShowsMedianAndRange() {
    assertEquals("20 (10 to 30)", Percentiles.spread(List.of(30.0, 10.0, 20.0), "%.0f"));
  }

  @Test
  void histogramLinesAreSummedPerClass() {
    String text =
        "num     #instances         #bytes  class name (module)\n"
            + "-------------------------------------------------------\n"
            + "   1:          10           100  [B (java.base@21)\n"
            + "   2:           2            64  org.openmetadata.service.security.credentials.TokenDigest\n"
            + "   3:           1            16  org.openmetadata.service.security.credentials.TokenDigest\n";

    assertEquals(
        Map.of("[B", 100L, "org.openmetadata.service.security.credentials.TokenDigest", 80L),
        ClassHistogram.parse(text));
  }

  @Test
  void metersAreReadByNameAndTagAndAnAbsentMeterReadsAsZero() {
    MeterRegistry registry = new SimpleMeterRegistry();
    CredentialMeters meters = new CredentialMeters(registry);
    assertTrue(meters.verifierPresent());
    assertEquals(0, meters.counterSum("om.credential.checks", "decision", "accept"));

    registry.counter("om.credential.checks", "decision", "accept").increment(3);
    registry.counter("om.credential.checks", "decision", "reject").increment(2);

    assertEquals(3, meters.counterSum("om.credential.checks", "decision", "accept"));
    assertEquals(5, meters.counterSum("om.credential.checks"));
  }
}

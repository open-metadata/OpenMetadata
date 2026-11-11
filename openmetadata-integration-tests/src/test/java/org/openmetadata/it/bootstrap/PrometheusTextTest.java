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
package org.openmetadata.it.bootstrap;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import org.junit.jupiter.api.Test;

class PrometheusTextTest {
  private static final String SCRAPE =
      """
      # HELP om_credential_reads_total Credential reads
      # TYPE om_credential_reads_total counter
      om_credential_reads_total{outcome="ok",reason="miss"} 3.0
      om_credential_reads_total{outcome="error",reason="miss"} 1.0
      om_credential_reads_total{outcome="ok",reason="stale"} 4.0
      om_credential_reads_seconds_count{reason="miss"} 99.0
      om_credential_cached_subjects 7.0
      """;

  @Test
  void sumsEverySeriesWhoseLabelsIncludeTheGivenOnes() {
    assertEquals(4.0, PrometheusText.sum(SCRAPE, "om_credential_reads_total", "reason", "miss"));
    assertEquals(8.0, PrometheusText.sum(SCRAPE, "om_credential_reads_total"));
    assertEquals(
        3.0,
        PrometheusText.sum(SCRAPE, "om_credential_reads_total", "reason", "miss", "outcome", "ok"));
  }

  @Test
  void aSeriesWithoutLabelsIsFoundByItsName() {
    assertEquals(7.0, PrometheusText.sum(SCRAPE, "om_credential_cached_subjects"));
  }

  @Test
  void aNameThatOnlyPrefixesAnotherSeriesDoesNotMatchIt() {
    assertThrows(
        IllegalStateException.class, () -> PrometheusText.sum(SCRAPE, "om_credential_reads"));
  }

  @Test
  void aLabelValueNoSeriesHasFailsInsteadOfReadingZero() {
    assertThrows(
        IllegalStateException.class,
        () -> PrometheusText.sum(SCRAPE, "om_credential_reads_total", "reason", "nudge"));
  }
}

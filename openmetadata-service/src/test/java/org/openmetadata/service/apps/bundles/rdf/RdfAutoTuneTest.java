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
package org.openmetadata.service.apps.bundles.rdf;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.OptionalLong;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.system.EventPublisherJob;
import org.openmetadata.service.rdf.RdfRepository;

@DisplayName("RdfAutoTune")
class RdfAutoTuneTest {

  private static final long CONFIGURED_16_MB = 16L << 20;

  @Test
  @DisplayName("small server heap shrinks the append budget to heap/8")
  void smallHeapShrinksBudget() {
    long fourGb = 4L << 30;
    assertEquals(fourGb / 8, RdfAutoTune.deriveAppendBudgetBytes(fourGb, 1L << 30));
  }

  @Test
  @DisplayName("large server heap keeps the configured ceiling")
  void largeHeapKeepsConfiguredCeiling() {
    assertEquals(
        CONFIGURED_16_MB, RdfAutoTune.deriveAppendBudgetBytes(64L << 30, CONFIGURED_16_MB));
  }

  @Test
  @DisplayName("tiny server heap is floored at 1 MB")
  void tinyHeapFlooredAtOneMb() {
    assertEquals(
        RdfAutoTune.MIN_APPEND_BUDGET_BYTES,
        RdfAutoTune.deriveAppendBudgetBytes(2L << 20, CONFIGURED_16_MB));
  }

  @Test
  @DisplayName("autoTune off means no metrics fetch and no override")
  void disabledAutoTuneIsNoOp() {
    RdfRepository repository = mock(RdfRepository.class);
    EventPublisherJob jobData = new EventPublisherJob().withAutoTune(false);
    Long schemaDefaultPayloadSize = jobData.getPayLoadSize();

    RdfAutoTune.applyTo(jobData, repository);

    verify(repository, never()).fetchStorageMaxHeapBytes();
    assertEquals(schemaDefaultPayloadSize, jobData.getPayLoadSize());
  }

  @Test
  @DisplayName("unreachable metrics fall back to configured defaults")
  void unreachableMetricsFallBack() {
    RdfRepository repository = mock(RdfRepository.class);
    when(repository.fetchStorageMaxHeapBytes()).thenReturn(OptionalLong.empty());
    EventPublisherJob jobData = new EventPublisherJob().withAutoTune(true);
    Long schemaDefaultPayloadSize = jobData.getPayLoadSize();

    RdfAutoTune.applyTo(jobData, repository);

    verify(repository, never()).setAppendPayloadBudgetOverride(anyLong());
    assertEquals(schemaDefaultPayloadSize, jobData.getPayLoadSize());
  }

  @Test
  @DisplayName("small heap sets a run-scoped override and records the effective budget")
  void smallHeapSetsOverrideAndRecordsBudget() {
    RdfRepository repository = mock(RdfRepository.class);
    when(repository.fetchStorageMaxHeapBytes()).thenReturn(OptionalLong.of(64L << 20));
    when(repository.configuredAppendPayloadBytes()).thenReturn(CONFIGURED_16_MB);
    EventPublisherJob jobData = new EventPublisherJob().withAutoTune(true);

    RdfAutoTune.applyTo(jobData, repository);

    verify(repository).setAppendPayloadBudgetOverride(8L << 20);
    assertEquals(8L << 20, jobData.getPayLoadSize());
  }

  @Test
  @DisplayName("ample heap records the configured budget without an override")
  void ampleHeapRecordsConfiguredBudget() {
    RdfRepository repository = mock(RdfRepository.class);
    when(repository.fetchStorageMaxHeapBytes()).thenReturn(OptionalLong.of(64L << 30));
    when(repository.configuredAppendPayloadBytes()).thenReturn(CONFIGURED_16_MB);
    EventPublisherJob jobData = new EventPublisherJob().withAutoTune(true);

    RdfAutoTune.applyTo(jobData, repository);

    verify(repository, never()).setAppendPayloadBudgetOverride(anyLong());
    assertEquals(CONFIGURED_16_MB, jobData.getPayLoadSize());
  }
}

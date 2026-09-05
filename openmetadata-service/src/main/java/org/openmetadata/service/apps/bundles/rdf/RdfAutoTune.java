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

import java.util.OptionalLong;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.system.EventPublisherJob;
import org.openmetadata.service.rdf.RdfRepository;

/**
 * Auto-tune-lite for RDF reindex runs, gated on the app's {@code autoTune} flag. Samples the Fuseki
 * server's max heap from its Prometheus endpoint and shrinks the insert-only append budget when the
 * server is smaller than the configured budget assumes — a request body approaching the server heap
 * turns into GC pressure inside the single-writer transaction. The configured budget is always the
 * ceiling: auto-tune only ever shrinks. The effective budget is recorded on the run record's
 * {@code payLoadSize} so operators can see what the run actually used.
 */
@Slf4j
public final class RdfAutoTune {

  /** A single append body should stay well under the server heap; 1/8 leaves parse+index room. */
  static final int FUSEKI_HEAP_BUDGET_DIVISOR = 8;

  static final long MIN_APPEND_BUDGET_BYTES = 1L << 20;

  private RdfAutoTune() {}

  public static void applyTo(EventPublisherJob jobData, RdfRepository repository) {
    if (Boolean.TRUE.equals(jobData.getAutoTune())) {
      OptionalLong serverHeap = repository.fetchStorageMaxHeapBytes();
      if (serverHeap.isPresent()) {
        applyBudget(jobData, repository, serverHeap.getAsLong());
      } else {
        LOG.info("RDF auto-tune: storage metrics unreachable; using configured defaults");
      }
    }
  }

  private static void applyBudget(
      EventPublisherJob jobData, RdfRepository repository, long serverHeapBytes) {
    long configured = repository.configuredAppendPayloadBytes();
    long derived = deriveAppendBudgetBytes(serverHeapBytes, configured);
    if (derived < configured) {
      repository.setAppendPayloadBudgetOverride(derived);
      LOG.warn(
          "RDF auto-tune: shrinking append budget {} -> {} bytes (Fuseki max heap {} bytes)",
          configured,
          derived,
          serverHeapBytes);
    }
    jobData.setPayLoadSize(derived);
  }

  static long deriveAppendBudgetBytes(long serverHeapBytes, long configuredBytes) {
    long heapDerived = serverHeapBytes / FUSEKI_HEAP_BUDGET_DIVISOR;
    return Math.max(MIN_APPEND_BUDGET_BYTES, Math.min(configuredBytes, heapDerived));
  }
}

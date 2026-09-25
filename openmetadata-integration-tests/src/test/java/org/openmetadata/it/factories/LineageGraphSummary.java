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

package org.openmetadata.it.factories;

import java.time.Duration;

/**
 * What {@link LineageGraphLoader} actually built, and how long each phase took.
 *
 * <p>The per-phase durations are published with the benchmark: seeding throughput is the thing most
 * likely to change underneath a latency regression and be mistaken for one.
 */
public record LineageGraphSummary(
    int services,
    int databases,
    int schemas,
    int tables,
    int edges,
    int columnEdges,
    Duration hierarchyDuration,
    Duration tableDuration,
    Duration edgeDuration,
    LineageFocusPoints focusPoints) {

  public Duration totalDuration() {
    return hierarchyDuration.plus(tableDuration).plus(edgeDuration);
  }

  public double tablesPerSecond() {
    final double seconds = tableDuration.toMillis() / 1000.0;
    return seconds > 0 ? tables / seconds : 0;
  }

  public double edgesPerSecond() {
    final double seconds = edgeDuration.toMillis() / 1000.0;
    return seconds > 0 ? edges / seconds : 0;
  }
}

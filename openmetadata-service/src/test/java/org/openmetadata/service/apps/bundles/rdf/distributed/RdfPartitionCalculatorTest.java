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
package org.openmetadata.service.apps.bundles.rdf.distributed;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

@DisplayName("RdfPartitionCalculator partition-count caps")
class RdfPartitionCalculatorTest {

  /** Calculator with a fixed entity count so tests need no repository registry. */
  private static final class FixedCountCalculator extends RdfPartitionCalculator {
    private final long count;

    private FixedCountCalculator(int partitionSize, long count) {
      super(partitionSize);
      this.count = count;
    }

    @Override
    public long getEntityCount(String entityType) {
      return count;
    }
  }

  @Test
  @DisplayName("per-entity cap widens partitions instead of truncating coverage")
  void perEntityCapWidensPartitions() {
    long totalCount = 200_000_000L;
    FixedCountCalculator calculator = new FixedCountCalculator(10_000, totalCount);

    List<RdfIndexPartition> partitions =
        calculator.calculatePartitionsForEntity(UUID.randomUUID(), "table");

    assertTrue(
        partitions.size() <= RdfPartitionCalculator.MAX_PARTITIONS_PER_ENTITY_TYPE,
        "partition count must stay under the per-entity cap");
    assertEquals(
        totalCount,
        partitions.getLast().getRangeEnd(),
        "widening must preserve full coverage of the entity range");
    assertEquals(0L, partitions.getFirst().getRangeStart());
  }

  @Test
  @DisplayName("small counts are unaffected by the caps")
  void smallCountsUnaffected() {
    FixedCountCalculator calculator = new FixedCountCalculator(10_000, 25_000L);

    List<RdfIndexPartition> partitions =
        calculator.calculatePartitionsForEntity(UUID.randomUUID(), "topic");

    assertEquals(3, partitions.size());
    assertEquals(25_000L, partitions.getLast().getRangeEnd());
  }

  @Test
  @DisplayName("a job exceeding the total partition cap fails loudly")
  void totalCapThrows() {
    // Six types at the per-entity cap each would create 60k partition rows — enough
    // claim/heartbeat traffic to hurt the database before indexing starts.
    FixedCountCalculator calculator = new FixedCountCalculator(10_000, 200_000_000L);
    Set<String> entityTypes = Set.of("table", "topic", "dashboard", "pipeline", "mlmodel", "user");

    IllegalStateException thrown =
        assertThrows(
            IllegalStateException.class,
            () -> calculator.calculatePartitions(UUID.randomUUID(), entityTypes));

    assertTrue(thrown.getMessage().contains("too many partitions"));
  }
}

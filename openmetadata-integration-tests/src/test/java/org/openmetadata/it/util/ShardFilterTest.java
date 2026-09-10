package org.openmetadata.it.util;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import java.util.stream.IntStream;
import org.junit.jupiter.api.Test;

/**
 * Pins the property that makes sharding safe: every class runs on exactly one shard. A filter that
 * drops a class silently loses coverage, and one that duplicates it wastes a shard's budget —
 * neither shows up as a red build, so it is asserted here rather than discovered in CI.
 */
class ShardFilterTest {

  private static final List<String> CLASS_NAMES =
      IntStream.range(0, 500)
          .mapToObj("org.openmetadata.it.tests.search.Sample%dIT"::formatted)
          .toList();

  @Test
  void everyClassLandsOnExactlyOneShard() {
    for (int total = 2; total <= 8; total++) {
      for (final String className : CLASS_NAMES) {
        final int shardTotal = total;
        final long owners =
            IntStream.range(0, shardTotal)
                .filter(index -> ShardFilter.belongsToShard(className, shardTotal, index))
                .count();
        assertThat(owners)
            .as("%s across %d shards must be claimed exactly once", className, shardTotal)
            .isEqualTo(1);
      }
    }
  }

  @Test
  void assignmentIsStableAcrossCalls() {
    final String className = CLASS_NAMES.getFirst();
    final boolean first = ShardFilter.belongsToShard(className, 3, 1);

    assertThat(ShardFilter.belongsToShard(className, 3, 1)).isEqualTo(first);
  }

  @Test
  void singleShardKeepsEverything() {
    assertThat(CLASS_NAMES)
        .allSatisfy(className -> assertThat(ShardFilter.belongsToShard(className, 1, 0)).isTrue());
  }

  // A hash can only be as balanced as the names it sees; this guards against a degenerate
  // partition (e.g. a modulo bug parking every class on shard 0), not against perfect balance.
  @Test
  void shardsAreRoughlyBalanced() {
    final int total = 4;
    for (int index = 0; index < total; index++) {
      final int shardIndex = index;
      final long assigned =
          CLASS_NAMES.stream()
              .filter(className -> ShardFilter.belongsToShard(className, total, shardIndex))
              .count();
      assertThat(assigned)
          .as(
              "shard %d of %d should hold a non-trivial slice of %d classes",
              index, total, CLASS_NAMES.size())
          .isBetween(50L, 200L);
    }
  }
}

package org.openmetadata.it.util;

import java.util.Optional;
import org.junit.platform.engine.FilterResult;
import org.junit.platform.engine.TestDescriptor;
import org.junit.platform.engine.TestSource;
import org.junit.platform.engine.support.descriptor.ClassSource;
import org.junit.platform.engine.support.descriptor.MethodSource;
import org.junit.platform.launcher.PostDiscoveryFilter;

/**
 * Splits a suite across CI shards so a serial suite's wall clock divides by the shard count.
 *
 * <p>Enabled with {@code -Djpw.shard.total=N -Djpw.shard.index=I}; absent those it includes
 * everything, so local runs and unsharded profiles are unaffected. Registered through {@code
 * META-INF/services/org.junit.platform.launcher.PostDiscoveryFilter}.
 *
 * <p>Assignment is {@code hash(className) % total} rather than a checked-in class list: a list has
 * to be rebalanced by hand and silently drops any test nobody remembered to add, whereas a hash
 * assigns new classes on its own. {@link String#hashCode()} is specified by the JLS, so a class
 * lands in the same shard on every JVM and every run — a failure reproduces on the shard that
 * reported it.
 *
 * <p>Balance is only statistical. It is good enough when no single class dominates; when one does
 * (search-it's ReindexStopUnderLoadIT is ~20% of the suite), the shard holding it sets the floor.
 */
public final class ShardFilter implements PostDiscoveryFilter {

  private static final String TOTAL_PROPERTY = "jpw.shard.total";
  private static final String INDEX_PROPERTY = "jpw.shard.index";

  private final int total = Integer.getInteger(TOTAL_PROPERTY, 1);
  private final int index = Integer.getInteger(INDEX_PROPERTY, 0);

  @Override
  public FilterResult apply(final TestDescriptor descriptor) {
    if (!isSharding()) {
      return FilterResult.included("sharding disabled");
    }
    return classNameOf(descriptor)
        .map(className -> filterFor(className))
        .orElseGet(() -> FilterResult.included("no class source"));
  }

  private FilterResult filterFor(final String className) {
    return belongsToShard(className, total, index)
        ? FilterResult.included(null)
        : FilterResult.excluded("assigned to another shard");
  }

  private boolean isSharding() {
    if (total <= 1) {
      return false;
    }
    if (index < 0 || index >= total) {
      throw new IllegalArgumentException(
          String.format(
              "%s=%d is out of range for %s=%d", INDEX_PROPERTY, index, TOTAL_PROPERTY, total));
    }
    return true;
  }

  /** Package-private and pure so {@link ShardFilterTest} can pin the partition invariants. */
  static boolean belongsToShard(final String className, final int total, final int index) {
    return total <= 1 || Math.floorMod(className.hashCode(), total) == index;
  }

  private static Optional<String> classNameOf(final TestDescriptor descriptor) {
    return descriptor.getSource().flatMap(ShardFilter::classNameOf);
  }

  private static Optional<String> classNameOf(final TestSource source) {
    return switch (source) {
      case ClassSource classSource -> Optional.of(classSource.getClassName());
      case MethodSource methodSource -> Optional.of(methodSource.getClassName());
      default -> Optional.empty();
    };
  }

  @Override
  public String toString() {
    return "ShardFilter[" + index + "/" + total + "]";
  }
}

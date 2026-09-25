package org.openmetadata.it.util;

import java.util.Collections;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.atomic.AtomicLong;
import org.openmetadata.schema.EntityInterface;

public class TestNamespace {
  private static final String RUN_ID = UUID.randomUUID().toString().replaceAll("-", "");
  private static final AtomicLong UNIQUE_SHORT_ID_SEQUENCE = new AtomicLong();
  private static final String SHORT_ID_SEQUENCE_FORMAT = "%08x";
  private static final long SHORT_ID_SEQUENCE_MASK = 0xFFFFFFFFL;
  private static final long SHORT_ID_SEQUENCE_STEP = 0x9E3779B9L;
  private static final long SHORT_ID_SEQUENCE_OFFSET =
      Long.parseUnsignedLong(RUN_ID.substring(8, 16), 16);
  private final String classId;
  private String methodId;
  private String cachedShortPrefix;

  // Root entities created in this namespace, deleted recursively + hardDelete by
  // TestNamespaceExtension after the test so they never accumulate on a shared/external cluster.
  // Only roots are tracked (services, glossaries, domains, …) — children cascade on delete.
  private final List<EntityRoot> roots = new CopyOnWriteArrayList<>();

  public TestNamespace(String classId) {
    this.classId = classId;
  }

  /** A top-level entity to delete during cleanup. {@code entityType} is the OM type (e.g. "table"). */
  public record EntityRoot(String entityType, UUID id) {}

  /**
   * Register a root entity for post-test cleanup and return it unchanged, so factory call sites can
   * wrap their create fluently: {@code return ns.trackRoot(Entity.DATABASE_SERVICE, svc);}.
   */
  public <T extends EntityInterface> T trackRoot(String entityType, T entity) {
    if (entity != null && entity.getId() != null) {
      roots.add(new EntityRoot(entityType, entity.getId()));
    }
    return entity;
  }

  public void trackRoot(String entityType, UUID id) {
    if (id != null) {
      roots.add(new EntityRoot(entityType, id));
    }
  }

  public List<EntityRoot> trackedRoots() {
    return Collections.unmodifiableList(roots);
  }

  public List<EntityRoot> drainTrackedRoots() {
    List<EntityRoot> trackedRoots = List.copyOf(roots);
    roots.clear();
    return trackedRoots;
  }

  public void setMethodId(String methodId) {
    this.methodId = methodId;
    // Reset cached short prefix when method changes
    this.cachedShortPrefix = null;
  }

  public String prefix(String base) {
    return base + "__" + RUN_ID + "__" + classId + (methodId != null ? ("__" + methodId) : "");
  }

  /**
   * Short prefix for entities with nested hierarchies to avoid exceeding FQN length limit. Returns
   * the same value for all calls within the same test method. Use this when you need a consistent
   * prefix across multiple entities created in the same test (e.g., shared database service).
   */
  public String shortPrefix() {
    if (cachedShortPrefix == null) {
      // Use first 8 chars of run ID + short hash of method name + random suffix for uniqueness
      String shortRun = RUN_ID.substring(0, 8);
      String methodHash =
          methodId != null ? Integer.toHexString(Math.abs(methodId.hashCode()) % 0xFFFF) : "0";
      String uniqueSuffix = java.util.UUID.randomUUID().toString().substring(0, 4);
      cachedShortPrefix = shortRun + methodHash + uniqueSuffix;
    }
    return cachedShortPrefix;
  }

  public String shortPrefix(String base) {
    return shortPrefix() + "_" + base;
  }

  /**
   * Generates a compact ID without the repeated-zero runs that make fuzzy search queries expand
   * past the engine clause limit. The odd step permutes the 32-bit counter space, so suffixes stay
   * collision-free while their characters remain dispersed.
   */
  public String uniqueShortId() {
    final String shortRun = RUN_ID.substring(0, 8);
    final long sequence = UNIQUE_SHORT_ID_SEQUENCE.getAndIncrement();
    final long dispersedSequence =
        (SHORT_ID_SEQUENCE_OFFSET + sequence * SHORT_ID_SEQUENCE_STEP) & SHORT_ID_SEQUENCE_MASK;
    return shortRun + SHORT_ID_SEQUENCE_FORMAT.formatted(dispersedSequence);
  }

  public String runTagKey() {
    return "testRunId";
  }

  public String runTagValue() {
    return RUN_ID;
  }
}

package org.openmetadata.it.util;

import java.util.Collections;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.CopyOnWriteArrayList;
import org.openmetadata.schema.EntityInterface;

public class TestNamespace {
  private static final String RUN_ID = UUID.randomUUID().toString().replaceAll("-", "");
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
   * Generate a unique short ID for each call. Use this when creating multiple independent entities
   * within the same test method that need different names (e.g., multiple tables).
   */
  public String uniqueShortId() {
    String shortRun = RUN_ID.substring(0, 8);
    String methodHash =
        methodId != null ? Integer.toHexString(Math.abs(methodId.hashCode()) % 0xFFFF) : "0";
    String uniqueSuffix = java.util.UUID.randomUUID().toString().substring(0, 4);
    return shortRun + methodHash + uniqueSuffix;
  }

  public String runTagKey() {
    return "testRunId";
  }

  public String runTagValue() {
    return RUN_ID;
  }
}

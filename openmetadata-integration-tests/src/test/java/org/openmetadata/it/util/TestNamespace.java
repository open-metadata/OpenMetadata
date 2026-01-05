package org.openmetadata.it.util;

import java.util.UUID;

public class TestNamespace {
  private static final String RUN_ID = UUID.randomUUID().toString().replaceAll("-", "");
  private final String classId;
  private String methodId;
  private String cachedShortPrefix;

  public TestNamespace(String classId) {
    this.classId = classId;
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
   * the same value for all calls within the same test method.
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

  public String runTagKey() {
    return "testRunId";
  }

  public String runTagValue() {
    return RUN_ID;
  }
}

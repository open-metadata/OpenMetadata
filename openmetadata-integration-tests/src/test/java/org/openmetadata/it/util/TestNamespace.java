package org.openmetadata.it.util;

import java.util.UUID;

public class TestNamespace {
  private static final String RUN_ID = UUID.randomUUID().toString().replaceAll("-", "");
  private final String classId;
  private String methodId;

  public TestNamespace(String classId) {
    this.classId = classId;
  }

  public void setMethodId(String methodId) {
    this.methodId = methodId;
  }

  public String prefix(String base) {
    return base + "__" + RUN_ID + "__" + classId + (methodId != null ? ("__" + methodId) : "");
  }

  public String runTagKey() {
    return "testRunId";
  }

  public String runTagValue() {
    return RUN_ID;
  }
}

package org.openmetadata.service.migration.api;

public record TestResult(String name, boolean passed, String detail) {
  public static TestResult pass(String name) {
    return new TestResult(name, true, "");
  }

  public static TestResult fail(String name, String detail) {
    return new TestResult(name, false, detail);
  }
}

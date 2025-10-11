package org.openmetadata.it.util;

import org.junit.jupiter.api.extension.BeforeAllCallback;
import org.junit.jupiter.api.extension.BeforeEachCallback;
import org.junit.jupiter.api.extension.ExtensionContext;
import org.junit.jupiter.api.extension.ParameterContext;
import org.junit.jupiter.api.extension.ParameterResolver;

public class TestNamespaceExtension
    implements BeforeAllCallback, BeforeEachCallback, ParameterResolver {
  private TestNamespace ns;

  @Override
  public void beforeAll(ExtensionContext context) {
    String classId = context.getRequiredTestClass().getSimpleName();
    ns = new TestNamespace(classId);
  }

  @Override
  public void beforeEach(ExtensionContext context) {
    String methodId = context.getRequiredTestMethod().getName();
    ns.setMethodId(methodId);
  }

  @Override
  public boolean supportsParameter(
      ParameterContext parameterContext, ExtensionContext extensionContext) {
    return parameterContext.getParameter().getType().equals(TestNamespace.class);
  }

  @Override
  public Object resolveParameter(
      ParameterContext parameterContext, ExtensionContext extensionContext) {
    return ns;
  }
}

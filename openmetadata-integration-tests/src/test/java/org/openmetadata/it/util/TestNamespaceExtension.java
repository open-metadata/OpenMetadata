package org.openmetadata.it.util;

import org.junit.jupiter.api.extension.BeforeEachCallback;
import org.junit.jupiter.api.extension.ExtensionContext;
import org.junit.jupiter.api.extension.ExtensionContext.Namespace;
import org.junit.jupiter.api.extension.ParameterContext;
import org.junit.jupiter.api.extension.ParameterResolver;

/**
 * JUnit 5 extension that provides a unique TestNamespace per test method.
 * This ensures proper isolation when tests run in parallel.
 */
public class TestNamespaceExtension implements BeforeEachCallback, ParameterResolver {

  private static final Namespace NAMESPACE = Namespace.create(TestNamespaceExtension.class);
  private static final String NS_KEY = "testNamespace";

  @Override
  public void beforeEach(ExtensionContext context) {
    String classId = context.getRequiredTestClass().getSimpleName();
    String methodId = context.getRequiredTestMethod().getName();

    // Create a new TestNamespace for each test method
    TestNamespace ns = new TestNamespace(classId);
    ns.setMethodId(methodId);

    // Store in the context so it's unique per test method
    context.getStore(NAMESPACE).put(NS_KEY, ns);
  }

  @Override
  public boolean supportsParameter(
      ParameterContext parameterContext, ExtensionContext extensionContext) {
    return parameterContext.getParameter().getType().equals(TestNamespace.class);
  }

  @Override
  public Object resolveParameter(
      ParameterContext parameterContext, ExtensionContext extensionContext) {
    return extensionContext.getStore(NAMESPACE).get(NS_KEY, TestNamespace.class);
  }
}

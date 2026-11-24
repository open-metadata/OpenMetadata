package org.openmetadata.it.util;

import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.junit.jupiter.api.extension.AfterEachCallback;
import org.junit.jupiter.api.extension.BeforeEachCallback;
import org.junit.jupiter.api.extension.ExtensionContext;
import org.junit.jupiter.api.extension.ExtensionContext.Namespace;
import org.junit.jupiter.api.extension.ParameterContext;
import org.junit.jupiter.api.extension.ParameterResolver;
import org.junitpioneer.jupiter.RetryingTest;

/**
 * JUnit 5 extension that provides a unique TestNamespace per test method.
 * This ensures proper isolation when tests run in parallel.
 *
 * <p>After each test it recursively hard-deletes the root entities the test created (tracked via
 * {@link TestNamespace#trackRoot}) so they never accumulate — critical on a shared/external cluster
 * where leftovers would pile up across tests and bloat every subsequent reindex.
 *
 * <p>Each retry of a {@link RetryingTest} gets its own names, so it never collides with entities an
 * earlier attempt created and did not clean up.
 */
public class TestNamespaceExtension
    implements BeforeEachCallback, AfterEachCallback, ParameterResolver {

  private static final Namespace NAMESPACE = Namespace.create(TestNamespaceExtension.class);
  private static final String NS_KEY = "testNamespace";
  private static final Pattern ATTEMPT = Pattern.compile("test-template-invocation:#(\\d+)]$");

  @Override
  public void beforeEach(ExtensionContext context) {
    String classId = context.getRequiredTestClass().getSimpleName();
    String methodId = context.getRequiredTestMethod().getName() + retrySuffix(context);

    // Create a new TestNamespace for each test method
    TestNamespace ns = new TestNamespace(classId);
    ns.setMethodId(methodId);

    // Store in the context so it's unique per test method
    context.getStore(NAMESPACE).put(NS_KEY, ns);
  }

  // The first attempt keeps the plain method name; attempt N of a retrying test appends "_rN".
  private static String retrySuffix(ExtensionContext context) {
    Matcher attempt = ATTEMPT.matcher(context.getUniqueId());
    String suffix = "";
    if (context.getRequiredTestMethod().isAnnotationPresent(RetryingTest.class)
        && attempt.find()
        && Integer.parseInt(attempt.group(1)) > 1) {
      suffix = "_r%s".formatted(attempt.group(1));
    }
    return suffix;
  }

  @Override
  public void afterEach(ExtensionContext context) {
    TestNamespace ns = context.getStore(NAMESPACE).get(NS_KEY, TestNamespace.class);
    if (ns != null) {
      NamespaceCleanup.deleteRoots(ns.drainTrackedRoots());
    }
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

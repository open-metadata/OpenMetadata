package org.openmetadata.it.util;

import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import org.junit.jupiter.api.extension.AfterEachCallback;
import org.junit.jupiter.api.extension.BeforeEachCallback;
import org.junit.jupiter.api.extension.ExtensionContext;
import org.junit.jupiter.api.extension.ExtensionContext.Namespace;
import org.junit.jupiter.api.extension.ParameterContext;
import org.junit.jupiter.api.extension.ParameterResolver;

/**
 * JUnit 5 extension that provides a unique TestNamespace per test method.
 * This ensures proper isolation when tests run in parallel.
 *
 * <p>After each test it recursively hard-deletes the root entities the test created (tracked via
 * {@link TestNamespace#trackRoot}) so they never accumulate — critical on a shared/external cluster
 * where leftovers would pile up across tests and bloat every subsequent reindex.
 */
public class TestNamespaceExtension
    implements BeforeEachCallback, AfterEachCallback, ParameterResolver {

  private static final Namespace NAMESPACE = Namespace.create(TestNamespaceExtension.class);
  private static final String NS_KEY = "testNamespace";
  private static final Set<String> STARTED_TESTS = ConcurrentHashMap.newKeySet();

  @Override
  public void beforeEach(ExtensionContext context) {
    String classId = context.getRequiredTestClass().getSimpleName();
    String methodId = context.getRequiredTestMethod().getName();
    // A test seen twice in one JVM is failsafe's re-run; fresh names keep it clear of what the
    // failed attempt left behind (ADR:2026-10-15-merge-queue-its-retry-a-failed-test-once).
    if (!STARTED_TESTS.add(context.getUniqueId())) {
      methodId = methodId + "__retry";
    }

    // Create a new TestNamespace for each test method
    TestNamespace ns = new TestNamespace(classId);
    ns.setMethodId(methodId);

    // Store in the context so it's unique per test method
    context.getStore(NAMESPACE).put(NS_KEY, ns);
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

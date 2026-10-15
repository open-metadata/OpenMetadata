package org.openmetadata.it.audit;

import java.lang.reflect.Method;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import org.junit.jupiter.api.extension.ExtensionContext;
import org.junit.jupiter.api.extension.InvocationInterceptor;
import org.junit.jupiter.api.extension.ReflectiveInvocationContext;

/** THROWAWAY retry audit: run every test fully, then fail its first attempt so failsafe re-runs it. */
public class ForceFirstAttemptFailure implements InvocationInterceptor {

  private static final Set<String> SEEN = ConcurrentHashMap.newKeySet();

  @Override
  public void interceptTestMethod(
      Invocation<Void> invocation,
      ReflectiveInvocationContext<Method> invocationContext,
      ExtensionContext extensionContext)
      throws Throwable {
    runThenFailFirst(invocation, extensionContext);
  }

  @Override
  public void interceptTestTemplateMethod(
      Invocation<Void> invocation,
      ReflectiveInvocationContext<Method> invocationContext,
      ExtensionContext extensionContext)
      throws Throwable {
    runThenFailFirst(invocation, extensionContext);
  }

  private static void runThenFailFirst(Invocation<Void> invocation, ExtensionContext context)
      throws Throwable {
    final boolean firstAttempt = SEEN.add(context.getUniqueId());
    invocation.proceed();
    if (firstAttempt) {
      throw new AssertionError("RETRY-AUDIT forced first-attempt failure");
    }
  }
}

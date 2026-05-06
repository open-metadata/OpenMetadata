package org.openmetadata.jpw.ui;

import com.microsoft.playwright.BrowserContext;
import org.junit.jupiter.api.extension.AfterEachCallback;
import org.junit.jupiter.api.extension.BeforeEachCallback;
import org.junit.jupiter.api.extension.ExtensionContext;
import org.junit.jupiter.api.extension.ParameterContext;
import org.junit.jupiter.api.extension.ParameterResolver;
import org.openmetadata.jpw.server.ServerHandle;
import org.openmetadata.jpw.ui.auth.AdminJwtAuth;
import org.openmetadata.jpw.ui.auth.AuthStrategy;
import org.openmetadata.jpw.util.UiTestServer;

/**
 * Orchestrates per-test {@link UiSession} lifecycle.
 *
 * <p>For each {@code @Test}: opens a fresh {@link BrowserContext} on the JVM-wide
 * {@link SessionBrowser}, applies an {@link AuthStrategy} (admin JWT by default), and
 * starts a {@link TraceRecorder}. Trace is saved on failure, discarded on success. The
 * context is closed after the test runs, so each test sees a clean cookie/storage state.
 *
 * <p>Tests opt in via {@code @ExtendWith(UiSessionExtension.class)} and receive a
 * {@link UiSession} parameter on their test methods.
 */
public final class UiSessionExtension
    implements BeforeEachCallback, AfterEachCallback, ParameterResolver {

  private static final ExtensionContext.Namespace NAMESPACE =
      ExtensionContext.Namespace.create(UiSessionExtension.class);
  private static final String SESSION_KEY = "uiSession";
  private static final String CONTEXT_KEY = "browserContext";
  private static final String RECORDER_KEY = "traceRecorder";

  private static final AuthStrategy DEFAULT_AUTH = new AdminJwtAuth();

  @Override
  public void beforeEach(final ExtensionContext extensionContext) {
    final ServerHandle server = UiTestServer.get();
    final BrowserContext context = SessionBrowser.get().newContext();
    DEFAULT_AUTH.inject(context);
    final TraceRecorder recorder = TraceRecorder.start(context);
    final UiSession session = new UiSession(context, server);
    final ExtensionContext.Store store = extensionContext.getStore(NAMESPACE);
    store.put(CONTEXT_KEY, context);
    store.put(RECORDER_KEY, recorder);
    store.put(SESSION_KEY, session);
  }

  @Override
  public void afterEach(final ExtensionContext extensionContext) {
    final ExtensionContext.Store store = extensionContext.getStore(NAMESPACE);
    final BrowserContext context = store.get(CONTEXT_KEY, BrowserContext.class);
    final TraceRecorder recorder = store.get(RECORDER_KEY, TraceRecorder.class);
    if (recorder != null) {
      finishRecording(extensionContext, recorder);
    }
    if (context != null) {
      context.close();
    }
  }

  @Override
  public boolean supportsParameter(
      final ParameterContext parameterContext, final ExtensionContext extensionContext) {
    return parameterContext.getParameter().getType() == UiSession.class;
  }

  @Override
  public Object resolveParameter(
      final ParameterContext parameterContext, final ExtensionContext extensionContext) {
    return extensionContext.getStore(NAMESPACE).get(SESSION_KEY, UiSession.class);
  }

  private static void finishRecording(
      final ExtensionContext extensionContext, final TraceRecorder recorder) {
    if (extensionContext.getExecutionException().isPresent()) {
      recorder.stopAndSave(traceStem(extensionContext));
    } else {
      recorder.stopAndDiscard();
    }
  }

  private static String traceStem(final ExtensionContext extensionContext) {
    final String testName =
        extensionContext.getTestMethod().map(java.lang.reflect.Method::getName).orElse("test");
    final String className =
        extensionContext.getTestClass().map(Class::getSimpleName).orElse("Test");
    return "trace-" + className + "-" + testName;
  }
}

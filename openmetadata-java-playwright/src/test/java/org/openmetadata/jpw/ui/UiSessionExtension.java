package org.openmetadata.jpw.ui;

import com.microsoft.playwright.Browser.NewContextOptions;
import com.microsoft.playwright.BrowserContext;
import com.microsoft.playwright.Page;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;
import java.util.List;
import java.util.Objects;
import org.junit.jupiter.api.extension.AfterEachCallback;
import org.junit.jupiter.api.extension.BeforeEachCallback;
import org.junit.jupiter.api.extension.ExtensionContext;
import org.junit.jupiter.api.extension.ParameterContext;
import org.junit.jupiter.api.extension.ParameterResolver;
import org.openmetadata.jpw.auth.AuthSession;
import org.openmetadata.jpw.auth.NoPreloadAuth;
import org.openmetadata.jpw.server.ServerHandle;
import org.openmetadata.jpw.util.UiTestServer;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

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

  private static final Logger LOG = LoggerFactory.getLogger(UiSessionExtension.class);
  private static final ExtensionContext.Namespace NAMESPACE =
      ExtensionContext.Namespace.create(UiSessionExtension.class);
  private static final String SESSION_KEY = "uiSession";
  private static final String CONTEXT_KEY = "browserContext";
  private static final String RECORDER_KEY = "traceRecorder";

  private static final Path VIDEO_DIR = Paths.get("target", "playwright-videos");

  @Override
  public void beforeEach(final ExtensionContext extensionContext) {
    final ServerHandle server = UiTestServer.get();
    final BrowserContext context = SessionBrowser.get().newContext(buildContextOptions());
    if (!hasNoPreloadAuth(extensionContext)) {
      AuthSession.backend().injectIntoBrowser(context, AuthSession.current());
    }
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
    if (context == null) {
      return;
    }
    final List<Path> videosBeforeClose = collectVideoPaths(context);
    context.close();
    renameVideos(videosBeforeClose, traceStem(extensionContext));
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

  private static NewContextOptions buildContextOptions() {
    final NewContextOptions options =
        new NewContextOptions().setPermissions(List.of("clipboard-read", "clipboard-write"));
    if (isVideoEnabled()) {
      options.setRecordVideoDir(VIDEO_DIR);
    }
    return options;
  }

  private static boolean hasNoPreloadAuth(final ExtensionContext extensionContext) {
    return extensionContext
        .getTestMethod()
        .map(method -> method.isAnnotationPresent(NoPreloadAuth.class))
        .orElse(false);
  }

  private static boolean isVideoEnabled() {
    final String prop = System.getProperty("PW_VIDEO");
    if (prop != null && !prop.isBlank()) {
      return Boolean.parseBoolean(prop);
    }
    final String env = System.getenv("PW_VIDEO");
    return Boolean.parseBoolean(env);
  }

  private static List<Path> collectVideoPaths(final BrowserContext context) {
    if (!isVideoEnabled()) {
      return List.of();
    }
    return context.pages().stream()
        .map(Page::video)
        .filter(Objects::nonNull)
        .map(video -> {
          try {
            return video.path();
          } catch (RuntimeException e) {
            LOG.warn("Could not resolve video path: {}", e.getMessage());
            return null;
          }
        })
        .filter(Objects::nonNull)
        .toList();
  }

  private static void renameVideos(final List<Path> videoPaths, final String stem) {
    for (int i = 0; i < videoPaths.size(); i++) {
      final Path src = videoPaths.get(i);
      final String suffix = videoPaths.size() == 1 ? "" : "-" + i;
      final Path dst = src.resolveSibling(stem + suffix + "-" + System.currentTimeMillis() + ".webm");
      try {
        Files.move(src, dst, StandardCopyOption.REPLACE_EXISTING);
      } catch (IOException e) {
        LOG.warn("Could not rename video {} -> {}: {}", src, dst, e.getMessage());
      }
    }
  }
}

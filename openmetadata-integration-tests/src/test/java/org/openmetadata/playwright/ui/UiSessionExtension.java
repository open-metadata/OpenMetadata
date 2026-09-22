package org.openmetadata.playwright.ui;

import com.microsoft.playwright.Browser.NewContextOptions;
import com.microsoft.playwright.BrowserContext;
import com.microsoft.playwright.Page;
import com.microsoft.playwright.Video;
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
import org.openmetadata.it.auth.AuthSession;
import org.openmetadata.it.auth.NoPreloadAuth;
import org.openmetadata.it.server.ServerHandle;
import org.openmetadata.it.util.UiTestServer;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * Orchestrates per-test {@link UiSession} lifecycle.
 *
 * <p>For each {@code @Test}: opens a fresh {@link BrowserContext} on the JVM-wide
 * {@link SessionBrowser}, injects auth via {@code AuthSession.backend().injectIntoBrowser(...)}
 * (admin JWT by default), and starts a {@link TraceRecorder}. Trace is saved on failure,
 * discarded on success/skip. The context is closed after the test runs, so each test sees a
 * clean cookie/storage state.
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
    // Snapshot Video handles BEFORE close (pages() is empty after close), but resolve
    // .path() only AFTER close — Playwright finalizes the file on close, so the path
    // call would block/fail otherwise.
    final List<Video> videos = collectVideos(context);
    context.close();
    renameVideos(resolveVideoPaths(videos), traceStem(extensionContext));
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
    if (isRealFailure(extensionContext.getExecutionException().orElse(null))) {
      recorder.stopAndSave(traceStem(extensionContext));
    } else {
      recorder.stopAndDiscard();
    }
  }

  // A failed assumption (TestAbortedException) is a skip, not a failure — don't waste a
  // trace on it. Anything else present is a genuine failure worth capturing.
  private static boolean isRealFailure(final Throwable executionException) {
    return executionException != null
        && !(executionException instanceof org.opentest4j.TestAbortedException);
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

  private static List<Video> collectVideos(final BrowserContext context) {
    if (!isVideoEnabled()) {
      return List.of();
    }
    return context.pages().stream().map(Page::video).filter(Objects::nonNull).toList();
  }

  private static List<Path> resolveVideoPaths(final List<Video> videos) {
    return videos.stream()
        .map(
            video -> {
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
      final Path dst =
          src.resolveSibling(stem + suffix + "-" + System.currentTimeMillis() + ".webm");
      try {
        Files.move(src, dst, StandardCopyOption.REPLACE_EXISTING);
      } catch (IOException e) {
        LOG.warn("Could not rename video {} -> {}: {}", src, dst, e.getMessage());
      }
    }
  }
}

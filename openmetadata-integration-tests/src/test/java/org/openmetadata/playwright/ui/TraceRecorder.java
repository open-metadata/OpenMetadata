package org.openmetadata.playwright.ui;

import com.microsoft.playwright.BrowserContext;
import com.microsoft.playwright.Tracing;
import java.nio.file.Path;
import java.nio.file.Paths;

/**
 * Records a Playwright trace for a single test. Persists the trace zip to
 * {@code target/playwright-traces/} only when the test fails — keeps green runs cheap.
 *
 * <p>Replay locally with {@code npx playwright show-trace <file>}.
 */
public final class TraceRecorder {

  private static final Path TRACE_DIR = Paths.get("target", "playwright-traces");

  private final BrowserContext context;

  private TraceRecorder(final BrowserContext context) {
    this.context = context;
  }

  public static TraceRecorder start(final BrowserContext context) {
    context
        .tracing()
        .start(new Tracing.StartOptions().setScreenshots(true).setSnapshots(true).setSources(true));
    return new TraceRecorder(context);
  }

  public void stopAndDiscard() {
    context.tracing().stop();
  }

  public Path stopAndSave(final String filenameStem) {
    final Path tracePath =
        TRACE_DIR.resolve(filenameStem + "-" + System.currentTimeMillis() + ".zip");
    final boolean dirReady =
        tracePath.getParent().toFile().mkdirs() || tracePath.getParent().toFile().isDirectory();
    if (!dirReady) {
      throw new IllegalStateException("Could not prepare trace directory " + tracePath.getParent());
    }
    context.tracing().stop(new Tracing.StopOptions().setPath(tracePath));
    return tracePath;
  }
}

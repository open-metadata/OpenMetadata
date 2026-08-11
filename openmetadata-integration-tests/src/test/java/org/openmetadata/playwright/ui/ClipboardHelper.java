package org.openmetadata.playwright.ui;

import com.microsoft.playwright.Locator;
import com.microsoft.playwright.Locator.ClickOptions;
import com.microsoft.playwright.Page;
import java.util.Locale;

/**
 * Reads clipboard content via a hidden textarea after a copy-button click.
 *
 * <p>Direct {@code navigator.clipboard.readText()} doesn't work reliably across all
 * Playwright contexts (focus and permission edge cases), so we mirror the TS suite's
 * pattern: hover and click the copy button, then synthesize a paste into a hidden
 * textarea and read its value. The textarea is removed after each call.
 *
 * <p>The {@link UiSessionExtension} grants {@code clipboard-read}/{@code clipboard-write}
 * to every test context — callers do not need to wire permissions.
 */
public final class ClipboardHelper {

  private static final String TEXTAREA_ID = "__jpw_clipboard_reader__";
  private static final int MAX_PASTE_ATTEMPTS = 30;
  private static final int PASTE_ATTEMPT_INTERVAL_MS = 100;
  private static final String CREATE_TEXTAREA =
      """
      (id) => {
        const textarea = document.createElement('textarea');
        textarea.id = id;
        textarea.style.cssText = 'position:fixed;left:-9999px;top:0;';
        document.body.appendChild(textarea);
      }
      """;
  private static final String REMOVE_TEXTAREA =
      """
      (id) => {
        document.getElementById(id)?.remove();
      }
      """;

  private ClipboardHelper() {}

  /** Hovers + clicks the copy button, then returns the clipboard contents. */
  public static String copyAndRead(final Page page, final Locator copyButton) {
    copyButton.hover();
    copyButton.click(new ClickOptions().setForce(true));
    return readViaPaste(page);
  }

  /**
   * The browser's clipboard write happens asynchronously after the copy click. Rather
   * than sleeping a fixed interval (flaky under CI load), we retry the paste-into-hidden-
   * textarea read until the value is non-empty or we exhaust the attempt budget.
   */
  private static String readViaPaste(final Page page) {
    page.evaluate(CREATE_TEXTAREA, TEXTAREA_ID);
    try {
      final Locator textarea = page.locator(idSelector(TEXTAREA_ID));
      for (int attempt = 0; attempt < MAX_PASTE_ATTEMPTS; attempt++) {
        textarea.focus();
        textarea.evaluate("(el) => { el.value = ''; }");
        page.keyboard().press("ControlOrMeta+V");
        final String value = textarea.inputValue();
        if (value != null && !value.isEmpty()) {
          return value;
        }
        page.waitForTimeout(PASTE_ATTEMPT_INTERVAL_MS);
      }
      return textarea.inputValue();
    } finally {
      page.evaluate(REMOVE_TEXTAREA, TEXTAREA_ID);
    }
  }

  private static String idSelector(final String id) {
    return String.format(Locale.ROOT, "#%s", id);
  }
}

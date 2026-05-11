package org.openmetadata.it.ui;

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
  private static final int CLIPBOARD_WRITE_DELAY_MS = 300;
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
    page.waitForTimeout(CLIPBOARD_WRITE_DELAY_MS);
    return readViaPaste(page);
  }

  private static String readViaPaste(final Page page) {
    page.evaluate(CREATE_TEXTAREA, TEXTAREA_ID);
    final Locator textarea = page.locator(idSelector(TEXTAREA_ID));
    textarea.focus();
    page.keyboard().press("ControlOrMeta+V");
    final String value = textarea.inputValue();
    page.evaluate(REMOVE_TEXTAREA, TEXTAREA_ID);
    return value;
  }

  private static String idSelector(final String id) {
    return String.format(Locale.ROOT, "#%s", id);
  }
}

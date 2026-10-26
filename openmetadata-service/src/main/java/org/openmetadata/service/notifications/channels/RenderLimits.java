package org.openmetadata.service.notifications.channels;

/** How much a chat notification may grow while it is turned from HTML into Markdown and parsed. */
public final class RenderLimits {

  public static final int MAX_MARKDOWN_CHARS = 50_000;
  public static final long MAX_TABLE_CELLS = 50_000L;
  public static final int MAX_HTML_CHARS = 200_000;
  public static final int MAX_HTML_DEPTH = 48;

  private RenderLimits() {}
}

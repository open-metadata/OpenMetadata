package org.openmetadata.service.notifications.channels;

/**
 * Interface for channel-specific renderers that convert template content to channel formats.
 *
 * <p>Implementations fall into two categories:
 *
 * <ul>
 *   <li><b>HTML-based channels (Email):</b> Receive compiled HTML templates directly without
 *       conversion
 *   <li><b>Markdown-based channels (Slack, Teams, GChat):</b> Receive HTML templates that are
 *       automatically converted to Markdown via {@link HtmlToMarkdownAdapter}, then rendered to
 *       channel-specific formats (BlockKit, AdaptiveCards, etc.)
 * </ul>
 *
 * <p>Thread-safety: Implementations must be thread-safe. Use the visitor pattern with local state
 * for renderers that parse AST nodes.
 */
public interface ChannelRenderer {

  /**
   * Render template content to a channel-specific notification message.
   *
   * <p>The template content format depends on the implementation:
   *
   * <ul>
   *   <li>Email renderers receive raw HTML from Handlebars templates
   *   <li>Other renderers receive Markdown (converted from HTML via {@link
   *       HtmlToMarkdownAdapter})
   * </ul>
   *
   * @param templateContent The template content (HTML for Email, Markdown for others)
   * @param templateSubject The template subject/title (can be null)
   * @return The channel-specific notification message
   */
  NotificationMessage render(String templateContent, String templateSubject);
}

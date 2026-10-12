package org.openmetadata.service.notifications.channels.teams;

import java.net.URI;
import java.util.Locale;
import java.util.Set;

/** Link helpers shared by the Teams markdown formatter and the Teams card assembler. */
final class TeamsMarkdownLinks {

  private static final Set<String> ALLOWED_SCHEMES = Set.of("http", "https", "mailto");

  private TeamsMarkdownLinks() {}

  static boolean isAllowedLinkUrl(String url) {
    boolean allowed = false;
    if (url != null) {
      try {
        String scheme = URI.create(escapeMdUrl(url)).getScheme();
        allowed = scheme != null && ALLOWED_SCHEMES.contains(scheme.toLowerCase(Locale.ROOT));
      } catch (IllegalArgumentException ex) {
        allowed = false;
      }
    }
    return allowed;
  }

  /**
   * Adaptive Card TextBlocks render inline code verbatim, so a URL wrapped in backticks is never
   * clickable in Teams while Slack linkifies the very same template. Such a code span is emitted as
   * a markdown link instead, so a custom template behaves the same on every channel.
   */
  static boolean isBareUrl(String literal) {
    String trimmed = literal == null ? "" : literal.trim();
    return !trimmed.isEmpty()
        && trimmed.chars().noneMatch(Character::isWhitespace)
        && isAllowedLinkUrl(trimmed);
  }

  static String markdownLink(String label, String url) {
    return "[" + label + "](" + url + ")";
  }

  static String escapeMdLabel(String s) {
    return s == null
        ? ""
        : s.replace("[", "\\[").replace("]", "\\]").replace("(", "\\(").replace(")", "\\)");
  }

  static String escapeMdUrl(String s) {
    return s == null ? "" : s.trim().replace(" ", "%20").replace(")", "%29").replace("(", "%28");
  }
}

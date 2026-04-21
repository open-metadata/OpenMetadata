/*
 *  Copyright 2024 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

package org.openmetadata.service.util;

import java.util.ArrayList;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.owasp.html.HtmlPolicyBuilder;
import org.owasp.html.PolicyFactory;

/**
 * Sanitizes user-supplied HTML/Markdown descriptions to prevent stored XSS attacks. Allows safe
 * markdown-generated HTML elements while stripping dangerous tags, attributes, and event handlers.
 */
public final class DescriptionSanitizer {

  private static final PolicyFactory MARKDOWN_POLICY =
      new HtmlPolicyBuilder()
          // Protocols must be explicitly allowed for URL attributes to work
          .allowUrlProtocols("http", "https", "mailto", "data")
          // Formatting
          .allowElements(
              "p", "br", "hr", "em", "strong", "b", "i", "u", "s", "del", "ins", "sub", "sup",
              "small", "mark")
          // Headings
          .allowElements("h1", "h2", "h3", "h4", "h5", "h6")
          // Lists
          .allowElements("ul", "ol", "li")
          // Block elements
          .allowElements("blockquote", "pre", "code", "div", "span", "section")
          // Tables
          .allowElements(
              "table", "thead", "tbody", "tfoot", "tr", "th", "td", "caption", "colgroup", "col")
          // Links
          .allowElements("a")
          .allowAttributes("href")
          .matching(
              (elementName, attributeName, value) -> {
                if (value.startsWith("http://")
                    || value.startsWith("https://")
                    || value.startsWith("mailto:")
                    || value.startsWith("#")
                    || value.startsWith("/")) {
                  return value;
                }
                return null;
              })
          .onElements("a")
          // Disallow target to prevent reverse-tabnabbing; clients should add rel=noopener
          // noreferrer themselves when opening links in new tabs.
          .allowAttributes("rel")
          .matching(
              (elementName, attributeName, value) -> {
                // Only permit safe rel token combinations
                String lower = value.toLowerCase(java.util.Locale.ROOT).trim();
                if (lower.equals("noopener")
                    || lower.equals("noreferrer")
                    || lower.equals("nofollow")
                    || lower.equals("noopener noreferrer")
                    || lower.equals("nofollow noopener noreferrer")) {
                  return value;
                }
                return null;
              })
          .onElements("a")
          // Images — only http/https or safe raster data URIs (no SVG which can carry XSS)
          .allowElements("img")
          .allowAttributes("src")
          .matching(
              (elementName, attributeName, value) -> {
                if (value.startsWith("http://")
                    || value.startsWith("https://")
                    || value.startsWith("data:image/png;")
                    || value.startsWith("data:image/jpeg;")
                    || value.startsWith("data:image/gif;")
                    || value.startsWith("data:image/webp;")) {
                  return value;
                }
                return null;
              })
          .onElements("img")
          .allowAttributes("alt", "title", "width", "height")
          .onElements("img")
          // Common safe attributes
          .allowAttributes("class", "id", "data-id", "data-highlighted", "data-testid")
          .globally()
          // Entity mention attributes on anchor tags (hashtag/mention nodes in BlockEditor)
          .allowAttributes("data-type", "data-label", "data-fqn", "data-entitytype")
          .onElements("a")
          .allowAttributes("align")
          .onElements("td", "th", "tr", "table")
          .allowAttributes("colspan", "rowspan")
          .onElements("td", "th")
          // Details/summary for collapsible sections
          .allowElements("details", "summary")
          // Definition lists
          .allowElements("dl", "dt", "dd")
          .toFactory();

  private static final Pattern ENTITY_LINK_PATTERN = Pattern.compile("<#E::[^<>]+>");

  private static final String ENTITY_LINK_PLACEHOLDER_PREFIX = "__OM_ENTITY_LINK_";

  private DescriptionSanitizer() {}

  /**
   * Sanitizes a markdown/HTML description string by removing dangerous elements (script, iframe,
   * event handlers like onerror/onclick) while preserving safe markdown-generated HTML.
   *
   * <p>Entity-link tokens ({@code <#E::...>}) are preserved via placeholder replacement before
   * sanitization and restored afterward, since the OWASP sanitizer would otherwise strip them as
   * unknown HTML tags.
   *
   * @param description the raw description from user input
   * @return sanitized description safe for storage and rendering, or null if input is null
   */
  public static String sanitize(String description) {
    if (description == null) {
      return null;
    }
    Matcher matcher = ENTITY_LINK_PATTERN.matcher(description);
    List<String> entityLinks = new ArrayList<>();
    StringBuilder replaced = new StringBuilder();
    while (matcher.find()) {
      entityLinks.add(matcher.group());
      matcher.appendReplacement(
          replaced, ENTITY_LINK_PLACEHOLDER_PREFIX + entityLinks.size() + "__");
    }
    matcher.appendTail(replaced);

    String sanitized = MARKDOWN_POLICY.sanitize(replaced.toString());

    for (int i = 0; i < entityLinks.size(); i++) {
      sanitized =
          sanitized.replace(ENTITY_LINK_PLACEHOLDER_PREFIX + (i + 1) + "__", entityLinks.get(i));
    }
    return sanitized;
  }
}

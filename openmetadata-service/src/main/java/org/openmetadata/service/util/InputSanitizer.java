/*
 *  Copyright 2021 Collate
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
import lombok.experimental.UtilityClass;
import org.owasp.html.HtmlPolicyBuilder;
import org.owasp.html.PolicyFactory;

/**
 * Utility class for sanitizing user input to prevent XSS attacks. This sanitization is applied
 * server-side to ensure security regardless of whether requests come from the UI or direct API
 * calls.
 */
@UtilityClass
public class InputSanitizer {

  private static final Pattern ENTITY_LINK_PATTERN = Pattern.compile("<#E::[^>]+>");
  private static final String ENTITY_LINK_PLACEHOLDER = "__OM_ENTITY_LINK_%d__";

  private static final PolicyFactory CONTENT_POLICY =
      new HtmlPolicyBuilder()
          .allowElements("p", "br", "div", "span")
          .allowAttributes("style", "class")
          .onElements("div", "span", "p", "pre", "code")
          .allowElements("ul", "ol", "li")
          .allowElements("strong", "b", "em", "i", "u", "s", "del", "mark")
          .allowElements("pre", "code")
          .allowElements("blockquote")
          .allowElements("h1", "h2", "h3", "h4", "h5", "h6")
          .allowElements("table", "thead", "tbody", "tr", "td", "th")
          .allowAttributes("class")
          .onElements("table", "thead", "tbody", "tr", "td", "th")
          .allowElements("a")
          .allowAttributes("href", "title", "target")
          .onElements("a")
          .allowElements("img")
          .allowAttributes("src", "alt", "title", "width", "height")
          .onElements("img")
          .allowUrlProtocols("https", "http")
          .requireRelNofollowOnLinks()
          .toFactory();

  /**
   * Sanitizes HTML content to prevent XSS attacks while preserving OpenMetadata entity links.
   * Entity links have the format {@code <#E::entityType::fqn>} and are used for rich content
   * referencing entities.
   *
   * @param content the content to sanitize
   * @return sanitized content with entity links preserved
   */
  public static String sanitize(String content) {
    if (content == null || content.isEmpty()) {
      return content;
    }

    List<String> entityLinks = new ArrayList<>();
    Matcher matcher = ENTITY_LINK_PATTERN.matcher(content);
    StringBuffer protectedContent = new StringBuffer();
    int index = 0;

    while (matcher.find()) {
      entityLinks.add(matcher.group());
      matcher.appendReplacement(protectedContent, String.format(ENTITY_LINK_PLACEHOLDER, index++));
    }
    matcher.appendTail(protectedContent);

    String sanitized = CONTENT_POLICY.sanitize(protectedContent.toString());

    for (int i = 0; i < entityLinks.size(); i++) {
      sanitized = sanitized.replace(String.format(ENTITY_LINK_PLACEHOLDER, i), entityLinks.get(i));
    }

    return sanitized;
  }
}

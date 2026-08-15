/*
 *  Copyright 2026 Collate
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
package org.openmetadata.service.aicontext;

import java.util.regex.Pattern;
import org.openmetadata.service.util.DescriptionSanitizer;
import org.owasp.html.HtmlPolicyBuilder;
import org.owasp.html.PolicyFactory;

/**
 * Strips render-only markup from a rich-text description before it enters an AI context document.
 *
 * <p>Descriptions are stored as the HTML the block editor produces and sanitized for XSS on write
 * by {@link DescriptionSanitizer}, which deliberately keeps what a browser needs: {@code class}
 * attributes, sizing hints, and inline {@code data:} images. A model cannot see an image and cannot
 * use a CSS class, so in a context document those bytes buy nothing — and they are not free. They
 * are charged twice: once against the persona-context character budget, where they crowd out rules
 * that would have rendered, and again on every LLM call that carries the document in its prompt.
 *
 * <p>Observed case that motivated this: one knowledge article held a single inline
 * {@code <img src="data:image/png;base64,…">} architecture diagram worth 320,000 characters — 63%
 * of a 505,000-character persona context. It consumed the whole 400,000-character budget, so the
 * rule that should have rendered 151 table schemas rendered none, and it added roughly 80,000
 * tokens to every prompt built from that document.
 *
 * <p>What survives is the structure a model reads: headings, lists, tables, emphasis, code, and
 * links with a resolvable http(s) target. Elements that are pure layout ({@code div}, {@code span})
 * are unwrapped and their text kept. Entity-mention anchors keep {@code data-fqn} and
 * {@code data-entitytype} because those name something the agent can look up.
 */
public final class PromptText {

  /**
   * Deliberately narrower than {@link DescriptionSanitizer}'s storage policy: {@code data} is not
   * an allowed URL protocol and {@code img} is not an allowed element, so inline binary payloads
   * cannot survive by any route. No presentational attribute is whitelisted, which drops
   * {@code class}, {@code style}, {@code id}, and sizing hints without naming them one by one.
   */
  private static final PolicyFactory PROMPT_POLICY =
      new HtmlPolicyBuilder()
          .allowUrlProtocols("http", "https", "mailto")
          .allowElements(
              "p", "br", "hr", "em", "strong", "b", "i", "u", "s", "del", "ins", "sub", "sup",
              "small", "mark")
          .allowElements("h1", "h2", "h3", "h4", "h5", "h6")
          .allowElements("ul", "ol", "li", "dl", "dt", "dd")
          .allowElements("blockquote", "pre", "code")
          .allowElements("table", "thead", "tbody", "tfoot", "tr", "th", "td", "caption")
          .allowElements("details", "summary")
          .allowElements("a")
          .allowAttributes("href")
          .matching(
              (elementName, attributeName, value) -> {
                if (value.startsWith("http://")
                    || value.startsWith("https://")
                    || value.startsWith("mailto:")) {
                  return value;
                }
                return null;
              })
          .onElements("a")
          // The only attributes kept for their meaning rather than their rendering: they identify
          // an entity the agent can fetch.
          .allowAttributes("data-fqn", "data-entitytype")
          .onElements("a")
          .allowAttributes("colspan", "rowspan")
          .onElements("td", "th")
          .toFactory();

  /**
   * A tag-shaped run. Text with no tag is returned untouched rather than round-tripped through the
   * sanitizer, which would HTML-escape bare {@code <} and {@code &} in plain-text and markdown
   * descriptions (a SQL note reading {@code WHERE a < b} must not become {@code a &lt; b}).
   */
  private static final Pattern HTML_TAG = Pattern.compile("<\\s*/?[a-zA-Z][^>]*>");

  private PromptText() {}

  /**
   * The description with render-only markup removed, or the input unchanged when it carries no
   * HTML. Null and blank inputs are returned as given so callers keep their existing emptiness
   * checks.
   */
  public static String forPrompt(String description) {
    if (description == null || description.isBlank() || !HTML_TAG.matcher(description).find()) {
      return description;
    }
    return DescriptionSanitizer.sanitizeWith(PROMPT_POLICY, description);
  }
}

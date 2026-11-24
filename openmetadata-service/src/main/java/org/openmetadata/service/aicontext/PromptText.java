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

import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Deque;
import java.util.List;
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
   * A run that opens or closes a <em>known</em> HTML element. Text without one is returned untouched
   * rather than round-tripped through the sanitizer, which would HTML-escape bare {@code <} and
   * {@code &} (a SQL note reading {@code WHERE a < b} must not become {@code a &lt; b}).
   *
   * <p>Matching any {@code <letter…>} run is not good enough. Angle brackets are also type notation,
   * and a data catalog is full of it: {@code Map<String, Object>} would be read as an unknown
   * {@code <String, Object>} tag and dropped, leaving {@code Map}, and
   * {@code Array<Struct<id:int,name:string>>} collapses to {@code Array&gt;}. Requiring a real
   * element name — anchored with {@code \b} so {@code <String>} does not match on {@code s} and
   * {@code <Item>} does not match on {@code i} — keeps that notation intact.
   *
   * <p>Being conservative here costs nothing: the policy only removes markup, so text holding no
   * element has nothing for it to remove.
   */
  private static final Pattern HTML_TAG =
      Pattern.compile(
          "(?i)<\\s*+/?+\\s*+(?:a|b|blockquote|br|caption|code|col|colgroup|dd|del|details|div|dl"
              + "|dt|em|h[1-6]|hr|i|img|ins|li|mark|ol|p|pre|s|section|small|span|strong|sub"
              + "|summary|sup|table|tbody|td|tfoot|th|thead|tr|u|ul)\\b[^>]*+>");

  private PromptText() {}

  /**
   * The description with render-only markup and inline {@code data:} images removed, or the input
   * unchanged when it carries neither HTML nor Markdown {@code data:} images. Null and blank inputs
   * are returned as given so callers keep their existing emptiness checks.
   */
  public static String forPrompt(String description) {
    if (description == null || description.isBlank()) {
      return description;
    }
    String text = stripMarkdownDataImages(description);
    if (!hasHtmlTag(text)) {
      return text;
    }
    return DescriptionSanitizer.sanitizeWith(PROMPT_POLICY, text);
  }

  /** Removes inline data images while preserving the original Markdown around them. */
  private static String stripMarkdownDataImages(String text) {
    if (!text.contains("![")) {
      return text;
    }
    DataImageScanner scanner = new DataImageScanner(text);
    scanner.scan();
    return scanner.withoutImages();
  }

  private record ImageRange(int start, int end) {}

  /** Matches escaped and nested brackets without rescanning unclosed labels. */
  private static final class DataImageScanner {
    private static final int TEXT_BRACKET = -1;

    private final String text;
    private final Deque<Integer> brackets = new ArrayDeque<>();
    private final List<ImageRange> images = new ArrayList<>();
    private int uriEnd = -1;
    private int tailStart = -1;
    private int tailEnd = -1;

    private DataImageScanner(String text) {
      this.text = text;
    }

    private void scan() {
      for (int index = 0; index < text.length(); index++) {
        switch (text.charAt(index)) {
          case '\\' -> index = skipEscapedCharacter(index);
          case '\r', '\n' -> brackets.clear();
          case '[' -> brackets.push(TEXT_BRACKET);
          case ']' -> index = closeBracket(index);
          case '!' -> {
            if (hasCharacterAt(index + 1, '[')) {
              brackets.push(index);
              index++;
            }
          }
          default -> {}
        }
      }
    }

    private int skipEscapedCharacter(int index) {
      if (index + 1 < text.length() && isMarkdownEscape(text.charAt(index + 1))) {
        return index + 1;
      }
      return index;
    }

    private int closeBracket(int index) {
      if (brackets.isEmpty()) {
        return index;
      }
      int imageStart = brackets.pop();
      if (imageStart == TEXT_BRACKET || !hasCharacterAt(index + 1, '(')) {
        return index;
      }
      int imageEnd = dataDestinationEnd(index + 2);
      if (imageEnd < 0) {
        return index;
      }
      // An outer image covers any image already found in its alt text.
      while (!images.isEmpty() && images.getLast().start() > imageStart) {
        images.removeLast();
      }
      images.add(new ImageRange(imageStart, imageEnd));
      return imageEnd - 1;
    }

    private int dataDestinationEnd(int start) {
      int uriStart = skipWhitespace(start);
      boolean hasAngleBrackets = hasCharacterAt(uriStart, '<');
      if (hasAngleBrackets) {
        uriStart++;
      }
      if (!text.regionMatches(true, uriStart, "data:", 0, 5)) {
        return -1;
      }
      int payloadStart = uriStart + 5;
      int end = endOfUri(payloadStart);
      if (end == payloadStart || hasAngleBrackets != hasCharacterAt(end, '>')) {
        return -1;
      }
      return endOfImage(hasAngleBrackets ? end + 1 : end);
    }

    private int endOfImage(int start) {
      // Failed candidates sharing a URI run also share the whitespace and title after it.
      if (start != tailStart) {
        tailStart = start;
        int close = skipTitle(start);
        tailEnd = hasCharacterAt(close, ')') ? close + 1 : -1;
      }
      return tailEnd;
    }

    private int endOfUri(int start) {
      // Several failed candidates may end in the same uninterrupted URI run.
      // Scan each run at most once, even when it contains another image opener.
      if (start >= uriEnd) {
        uriEnd = start;
        while (uriEnd < text.length() && !isUriTerminator(text.charAt(uriEnd))) {
          uriEnd++;
        }
      }
      return uriEnd;
    }

    private int skipTitle(int index) {
      int start = skipWhitespace(index);
      if (start == index || (!hasCharacterAt(start, '"') && !hasCharacterAt(start, '\''))) {
        return start;
      }
      int titleEnd = text.indexOf(text.charAt(start), start + 1);
      return titleEnd < 0 ? -1 : skipWhitespace(titleEnd + 1);
    }

    private int skipWhitespace(int index) {
      while (index < text.length() && Character.isWhitespace(text.charAt(index))) {
        index++;
      }
      return index;
    }

    private boolean hasCharacterAt(int index, char expected) {
      return index >= 0 && index < text.length() && text.charAt(index) == expected;
    }

    private String withoutImages() {
      if (images.isEmpty()) {
        return text;
      }
      StringBuilder result = new StringBuilder();
      int from = 0;
      for (ImageRange image : images) {
        result.append(text, from, image.start());
        from = image.end();
      }
      return result.append(text, from, text.length()).toString();
    }

    private static boolean isMarkdownEscape(char character) {
      return character == '\\' || character == '!' || character == '[' || character == ']';
    }

    private static boolean isUriTerminator(char character) {
      return character == '>' || character == ')' || Character.isWhitespace(character);
    }
  }

  private static boolean hasHtmlTag(String description) {
    // A tag cannot close beyond the final delimiter.
    return HTML_TAG.matcher(description).region(0, description.lastIndexOf('>') + 1).find();
  }
}

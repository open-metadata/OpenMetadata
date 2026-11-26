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

import java.util.Arrays;
import java.util.BitSet;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.apache.commons.text.StringEscapeUtils;
import org.jsoup.Jsoup;
import org.jsoup.nodes.Element;
import org.jsoup.nodes.Range;
import org.jsoup.parser.Parser;
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

  /**
   * An image the decode exposes: a tag the editor stored as encoded text, or a Markdown body's
   * {@code ![alt](data:...)} diagram. Each attempt stops at the next {@code <} or {@code [}, so many
   * unclosed openings cost one pass, not one pass each.
   */
  private static final Pattern DECODED_IMAGE =
      Pattern.compile(
          "(?i)<img\\b(?:[^<>\"']|\"[^\"<]*+\"|'[^'<]*+')*+>"
              + "|!\\[[^\\]\\[\\n]*+\\]\\(\\s*+data:[^()!\\[\\]]*+\\)");

  private static final Pattern ENCODED_IMAGE_START =
      Pattern.compile("(?i)&(?:lt|#0*60|#x0*3c);img\\b|!\\[");
  private static final Pattern HTML_ENTITY =
      Pattern.compile("&(?:[a-zA-Z][a-zA-Z0-9]*+|#(?:[0-9]++|[xX][0-9a-fA-F]++));");

  private PromptText() {}

  /**
   * The description with render-only markup removed, or the input unchanged when it carries no
   * HTML. Null and blank inputs are returned as given so callers keep their existing emptiness
   * checks.
   */
  public static String forPrompt(String description) {
    if (description == null || description.isBlank() || !hasHtmlTag(description)) {
      return description;
    }
    return DescriptionSanitizer.sanitizeWith(PROMPT_POLICY, description);
  }

  /**
   * The text cleaned like {@link #forPrompt} and decoded once, so it reads as written ({@code x >=
   * 1}, {@code 'a'}, {@code a & b}) as the content read did before images were stripped. Images the
   * decode exposes are cut by pattern, not by a second clean and decode, so text stored
   * double-encoded stays encoded and no markup is rebuilt from it.
   */
  public static String forContentRead(String richText) {
    return stripDecodedImages(StringEscapeUtils.unescapeHtml4(forPrompt(richText)));
  }

  /** Keeps the usual rich-text output when the article contains visible text. */
  public static String forArticleRead(String richText) {
    String html = forPrompt(richText);
    String rendered = stripDecodedImages(StringEscapeUtils.unescapeHtml4(html));
    // Inspect the encoded markup so literal examples such as &lt;div&gt; count as text.
    String plain =
        html != null && hasHtmlTag(html)
            ? stripDecodedImages(Jsoup.parseBodyFragment(html).body().text())
            : rendered;
    boolean readable =
        plain != null
            && plain
                .codePoints()
                .anyMatch(c -> !Character.isWhitespace(c) && !Character.isSpaceChar(c));
    return readable ? rendered : "";
  }

  /** Image spans in the source can cross word-based index chunk boundaries. */
  public static BitSet inlineImagePositions(String source, int start) {
    BitSet positions = new BitSet();
    Matcher images = DECODED_IMAGE.matcher(source).region(start, source.length());
    while (images.find()) {
      positions.set(images.start(), images.end());
    }
    if (source.indexOf('&', start) >= 0
        && ENCODED_IMAGE_START.matcher(source).region(start, source.length()).find()) {
      markEncodedImages(source, start, positions);
    }
    if (source.indexOf("data-is-image", start) >= 0) {
      markImageAttachments(source.substring(start), start, positions);
    }
    return positions;
  }

  private static void markEncodedImages(String source, int start, BitSet positions) {
    StringBuilder decoded = new StringBuilder(source.length() - start);
    int[] originalOffsets = new int[source.length() - start + 1];
    Matcher entities = HTML_ENTITY.matcher(source).region(start, source.length());
    int cursor = start;
    while (entities.find()) {
      appendSource(decoded, originalOffsets, source, cursor, entities.start());
      int first = decoded.length();
      decoded.append(StringEscapeUtils.unescapeHtml4(entities.group()));
      Arrays.fill(originalOffsets, first, decoded.length(), entities.start());
      cursor = entities.end();
    }
    appendSource(decoded, originalOffsets, source, cursor, source.length());
    originalOffsets[decoded.length()] = source.length();
    Matcher images = DECODED_IMAGE.matcher(decoded);
    while (images.find()) {
      positions.set(originalOffsets[images.start()], originalOffsets[images.end()]);
    }
  }

  private static void appendSource(
      StringBuilder decoded, int[] originalOffsets, String source, int start, int end) {
    for (int index = start; index < end; index++) {
      originalOffsets[decoded.length()] = index;
      decoded.append(source.charAt(index));
    }
  }

  private static void markImageAttachments(String html, int offset, BitSet positions) {
    Parser parser = Parser.htmlParser().setTrackPosition(true);
    for (Element image :
        parser.parseInput(html, "").select("div[data-type=file-attachment][data-is-image=true]")) {
      Range tag = image.sourceRange();
      if (tag.isTracked()) {
        positions.set(offset + tag.startPos(), offset + tag.endPos());
      }
    }
  }

  private static String stripDecodedImages(String decoded) {
    return decoded == null ? null : DECODED_IMAGE.matcher(decoded).replaceAll("");
  }

  private static boolean hasHtmlTag(String description) {
    // A tag cannot close beyond the final delimiter.
    return HTML_TAG.matcher(description).region(0, description.lastIndexOf('>') + 1).find();
  }
}

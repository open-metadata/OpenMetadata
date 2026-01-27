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

package org.openmetadata.service.notifications.template.handlebars.helpers;

import com.github.jknack.handlebars.Handlebars;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.text.StringEscapeUtils;
import org.openmetadata.service.notifications.template.handlebars.HandlebarsHelper;
import org.openmetadata.service.notifications.template.handlebars.HandlebarsHelperMetadata;
import org.openmetadata.service.notifications.template.handlebars.HandlebarsHelperUsage;

/**
 * Handlebars helper that processes mention tags in message text.
 *
 * <p>Converts OpenMetadata mention format to clean HTML links.
 *
 * <p>Input format: {@code <#E::type::name|[@DisplayName](url)>}
 *
 * <p>Output format: {@code <a href="url">@DisplayName</a>}
 *
 * <p>Usage in templates:
 *
 * <ul>
 *   <li>{{{processMentions entity.message}}} - Process mentions and render as HTML
 * </ul>
 *
 * <p>Example:
 *
 * <ul>
 *   <li>Input: "Hello <#E::team::Legal Admin|[@Legal Admin](http://localhost:8585/settings/members/teams/Legal%20Admin)>"
 *   <li>Output: "Hello <a href="http://localhost:8585/settings/members/teams/Legal%20Admin">@Legal Admin</a>"
 * </ul>
 */
@Slf4j
public class ProcessMentionsHelper implements HandlebarsHelper {

  // Pattern to match mention tag format: <#E.type.name|[@DisplayName](url)>
  // Supports both . and :: as separators
  private static final Pattern MENTION_TAG_PATTERN =
      Pattern.compile("<#E[.:][^|]+\\|\\[@([^\\]]+)\\]\\(([^)]+)\\)>");

  // Pattern to match consecutive/nested anchor tags (case 1)
  // Example: <a href="url"></a><a href="same-url">@Name</a>
  private static final Pattern CONSECUTIVE_ANCHORS_PATTERN =
      Pattern.compile("<a[^>]*href=\"([^\"]+)\"[^>]*></a>\\s*<a[^>]*href=\"\\1\"[^>]*>([^<]+)</a>");

  // Pattern to match outer anchor wrapper with data-type="mention"
  // Example: <a data-type="mention" ... >CONTENT</a>
  private static final Pattern MENTION_WRAPPER_PATTERN =
      Pattern.compile("<a[^>]*data-type=\"mention\"[^>]*>(.*?)</a>");

  @Override
  public String getName() {
    return "processMentions";
  }

  @Override
  public void register(Handlebars handlebars) {
    handlebars.registerHelper(
        getName(),
        (context, options) -> {
          if (context == null) {
            return "";
          }

          String text = context.toString();
          if (text.isEmpty()) {
            return "";
          }

          try {
            return processMentions(text);
          } catch (Exception e) {
            LOG.error("Error processing mentions in text: {}", text, e);
            return text;
          }
        });
  }

  /**
   * Processes mention tags in the given text and converts them to clean HTML links.
   *
   * <p>Handles two mention formats from the UI:
   * <ol>
   *   <li>Nested/consecutive anchors: {@code <a href="url"></a><a href="url">@Name</a>}
   *   <li>Raw mention tags: {@code <#E.type.name|[@Name](url)>}
   * </ol>
   *
   * <p>All other HTML content (including regular links) is preserved as-is.
   *
   * @param text The text containing mention tags (may contain HTML entities)
   * @return Text with mentions converted to clean HTML links
   */
  private String processMentions(String text) {
    // Decode HTML entities first
    String result = StringEscapeUtils.unescapeHtml4(text);

    // Step 1: Remove data-type="mention" wrapper anchors
    // Example: <a data-type="mention" ...>CONTENT</a> -> CONTENT
    Matcher wrapperMatcher = MENTION_WRAPPER_PATTERN.matcher(result);
    StringBuilder unwrapped = new StringBuilder();
    while (wrapperMatcher.find()) {
      String content = wrapperMatcher.group(1);
      wrapperMatcher.appendReplacement(unwrapped, Matcher.quoteReplacement(content));
    }
    wrapperMatcher.appendTail(unwrapped);
    result = unwrapped.toString();

    // Step 2: Merge consecutive duplicate anchors (case 1)
    // Example: <a href="url"></a><a href="url">@Name</a> -> <a href="url">@Name</a>
    Matcher consecutiveMatcher = CONSECUTIVE_ANCHORS_PATTERN.matcher(result);
    StringBuilder merged = new StringBuilder();
    while (consecutiveMatcher.find()) {
      String url = consecutiveMatcher.group(1);
      String displayName = consecutiveMatcher.group(2);
      String replacement = String.format("<a href=\"%s\">%s</a>", url, displayName);
      consecutiveMatcher.appendReplacement(merged, Matcher.quoteReplacement(replacement));
    }
    consecutiveMatcher.appendTail(merged);
    result = merged.toString();

    // Step 3: Convert mention tags to clean HTML links (case 2)
    // Example: <#E.team.Legal Admin|[@Legal Admin](url)> -> <a href="url">@Legal Admin</a>
    Matcher mentionMatcher = MENTION_TAG_PATTERN.matcher(result);
    StringBuilder final_result = new StringBuilder();
    while (mentionMatcher.find()) {
      String displayName = mentionMatcher.group(1);
      String url = mentionMatcher.group(2);
      String replacement = String.format("<a href=\"%s\">@%s</a>", url, displayName);
      mentionMatcher.appendReplacement(final_result, Matcher.quoteReplacement(replacement));
    }
    mentionMatcher.appendTail(final_result);

    return final_result.toString();
  }

  @Override
  public HandlebarsHelperMetadata getMetadata() {
    return new HandlebarsHelperMetadata()
        .withName("processMentions")
        .withDescription("Convert @mentions to clickable links")
        .withCursorOffset(19)
        .withUsages(
            List.of(
                new HandlebarsHelperUsage()
                    .withSyntax("{{{processMentions }}}")
                    .withExample("{{{processMentions message}}}")));
  }
}

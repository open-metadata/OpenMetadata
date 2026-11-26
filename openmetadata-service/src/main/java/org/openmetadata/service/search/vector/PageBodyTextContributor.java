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
package org.openmetadata.service.search.vector;

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;

import java.util.ArrayList;
import java.util.List;
import java.util.function.Predicate;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.entity.data.Page;
import org.openmetadata.schema.entity.data.PageType;
import org.openmetadata.schema.entity.data.QuickLink;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.jdbi3.KnowledgePageRepository;
import org.openmetadata.service.search.vector.VectorDocBuilder.BodyTextExtractor;
import org.openmetadata.service.search.vector.utils.TextChunkManager;

/**
 * Body text contributor for {@link Page}. The default description-only extractor would miss the
 * page title (lives in {@code displayName}) and, for QuickLink pages, the link URL. This
 * contributor concatenates the populated page fields so the vector represents the title, body,
 * and (for quick links) destination URL.
 */
@Slf4j
public final class PageBodyTextContributor implements VectorBodyTextContributor {

  public static final PageBodyTextContributor INSTANCE = new PageBodyTextContributor();
  private static final String DESCRIPTION = "description";
  private static final String CONTEXT_SEPARATOR = " | ";
  private static final Pattern CHUNK_FOOTER =
      Pattern.compile(" \\| chunk ([1-9][0-9]{0,9})/([1-9][0-9]{0,9})\\z");

  private PageBodyTextContributor() {}

  @Override
  public String entityType() {
    return KnowledgePageRepository.KNOWLEDGE_PAGE_ENTITY;
  }

  @Override
  public BodyTextExtractor extractor() {
    return PageBodyTextContributor::extractBodyText;
  }

  /**
   * Tests the article body within each hit. Match the chunk suffix against the current page so
   * pipes in the metadata or prose can't be mistaken for the start of the chunk.
   */
  public static List<String> filterArticlePassages(
      Page page, List<String> passages, Predicate<String> includeBody) {
    String description = page.getDescription();
    List<String> matching = List.of();
    if (!passages.isEmpty() && !nullOrEmpty(description) && !description.isBlank()) {
      List<String> titleAndLabel = titleParts(page);
      titleAndLabel.add(DESCRIPTION + ":");
      List<String> labelChunks = TextChunkManager.chunk(String.join("; ", titleAndLabel));
      List<String> pageChunks = TextChunkManager.chunk(extractBodyText(page));
      matching =
          passages.stream()
              .filter(passage -> matchesBody(passage, pageChunks, labelChunks, includeBody))
              .toList();
    }
    return matching;
  }

  private static boolean matchesBody(
      String passage,
      List<String> pageChunks,
      List<String> labelChunks,
      Predicate<String> includeBody) {
    boolean included = false;
    Matcher footer = CHUNK_FOOTER.matcher(passage);
    if (footer.find() && Long.parseLong(footer.group(2)) == pageChunks.size()) {
      long ordinal = Long.parseLong(footer.group(1));
      if (ordinal >= labelChunks.size() && ordinal <= pageChunks.size()) {
        String chunk = pageChunks.get((int) ordinal - 1);
        String suffix = CONTEXT_SEPARATOR + chunk;
        if (passage.regionMatches(footer.start() - suffix.length(), suffix, 0, suffix.length())) {
          int labels = ordinal == labelChunks.size() ? labelChunks.getLast().length() : 0;
          included = includeBody.test(chunk.substring(labels).stripLeading());
        }
      }
    }
    return included;
  }

  static String extractBodyText(EntityInterface<?> entity) {
    if (!(entity instanceof Page page)) {
      return null;
    }
    List<String> parts = titleParts(page);
    appendIfPresent(parts, DESCRIPTION, page.getDescription());
    if (page.getPageType() == PageType.QUICK_LINK) {
      appendIfPresent(parts, "url", extractQuickLinkUrl(page));
    }
    return parts.isEmpty() ? "" : String.join("; ", parts);
  }

  private static List<String> titleParts(Page page) {
    List<String> parts = new ArrayList<>();
    appendIfPresent(parts, "title", titleOf(page));
    return parts;
  }

  private static String titleOf(Page page) {
    String displayName = page.getDisplayName();
    return displayName != null && !displayName.isBlank() ? displayName : page.getName();
  }

  private static String extractQuickLinkUrl(Page page) {
    Object pagePayload = page.getPage();
    if (pagePayload == null) {
      return null;
    }
    try {
      QuickLink quickLink = JsonUtils.convertValue(pagePayload, QuickLink.class);
      return quickLink == null || quickLink.getUrl() == null ? null : quickLink.getUrl().toString();
    } catch (Exception e) {
      LOG.debug("Failed to extract QuickLink URL for page [{}]", page.getFullyQualifiedName(), e);
      return null;
    }
  }

  private static void appendIfPresent(List<String> parts, String label, String value) {
    if (value == null || value.isBlank()) {
      return;
    }
    parts.add(label + ": " + value.strip());
  }
}

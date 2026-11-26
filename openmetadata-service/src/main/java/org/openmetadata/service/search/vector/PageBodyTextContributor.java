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
import java.util.BitSet;
import java.util.List;
import java.util.Objects;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Stream;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.entity.data.Page;
import org.openmetadata.schema.entity.data.PageType;
import org.openmetadata.schema.entity.data.QuickLink;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.aicontext.PromptText;
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
      Pattern.compile(" \\| chunk (\\p{Nd}{1,10})/\\p{Nd}{1,10}\\z");

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
   * Renders hits with readable article text. Match the chunk suffix against the current page so
   * pipes in the metadata or prose can't be mistaken for the start of the chunk.
   * ADR:2026-11-26-mcp-article-passages-match-indexed-chunks
   */
  public static List<String> readableArticlePassages(Page page, List<String> passages) {
    return matchedArticlePassages(page, passages)
        .map(ArticlePassage::render)
        .filter(Objects::nonNull)
        .toList();
  }

  /** The first readable body in search order, suitable for a budgeted context excerpt. */
  public static String firstReadableArticleBody(Page page, List<String> passages) {
    return matchedArticlePassages(page, passages)
        .map(passage -> PromptText.forBudgetedArticleRead(passage.body()))
        .filter(body -> !body.isEmpty())
        .findFirst()
        .orElse(null);
  }

  private static Stream<ArticlePassage> matchedArticlePassages(Page page, List<String> passages) {
    String description = page.getDescription();
    Stream<ArticlePassage> matching = Stream.empty();
    if (!nullOrEmpty(passages) && !nullOrEmpty(description) && !description.isBlank()) {
      ArticleChunks chunks = articleChunks(page);
      matching =
          passages.stream()
              .map(passage -> matchArticlePassage(passage, chunks))
              .filter(Objects::nonNull);
    }
    return matching;
  }

  private record ArticlePassage(String header, String body, String footer) {
    String render() {
      String readable = PromptText.forArticleRead(body);
      return readable.isEmpty() ? null : PromptText.forContentRead(header) + readable + footer;
    }
  }

  private record ArticleChunks(List<String> indexed, List<String> imageFree, List<String> labels) {}

  private static ArticleChunks articleChunks(Page page) {
    String source = extractBodyText(page);
    List<String> indexed = TextChunkManager.chunk(source);
    int descriptionStart = source.length() - page.getDescription().strip().length();
    BitSet images = PromptText.inlineImagePositions(source, descriptionStart);
    List<String> imageFree = images.isEmpty() ? indexed : TextChunkManager.chunk(source, images);
    List<String> titleAndLabel = titleParts(page);
    titleAndLabel.add(DESCRIPTION + ":");
    List<String> labels = TextChunkManager.chunk(String.join("; ", titleAndLabel));
    return new ArticleChunks(indexed, imageFree, labels);
  }

  private static ArticlePassage matchArticlePassage(String passage, ArticleChunks chunks) {
    ArticlePassage match = null;
    Matcher footer = CHUNK_FOOTER.matcher(passage);
    if (footer.find()) {
      long ordinal =
          footer
              .group(1)
              .codePoints()
              .asLongStream()
              .reduce(0, (value, digit) -> value * 10 + Character.digit((int) digit, 10));
      if (ordinal >= chunks.labels().size() && ordinal <= chunks.indexed().size()) {
        int index = (int) ordinal - 1;
        String chunk = chunks.indexed().get(index);
        String suffix = CONTEXT_SEPARATOR + chunk;
        if (passage.regionMatches(footer.start() - suffix.length(), suffix, 0, suffix.length())) {
          String label = ordinal == chunks.labels().size() ? chunks.labels().getLast() + " " : "";
          String imageFree = chunks.imageFree().get(index);
          String body = imageFree.substring(Math.min(label.length(), imageFree.length()));
          String header = passage.substring(0, footer.start() - chunk.length()) + label;
          match = new ArticlePassage(header, body, passage.substring(footer.start()));
        }
      }
    }
    return match;
  }

  static String extractBodyText(EntityInterface<?> entity) {
    String body = null;
    if (entity instanceof Page page) {
      List<String> parts = titleParts(page);
      appendIfPresent(parts, DESCRIPTION, page.getDescription());
      if (page.getPageType() == PageType.QUICK_LINK) {
        appendIfPresent(parts, "url", extractQuickLinkUrl(page));
      }
      body = String.join("; ", parts);
    }
    return body;
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

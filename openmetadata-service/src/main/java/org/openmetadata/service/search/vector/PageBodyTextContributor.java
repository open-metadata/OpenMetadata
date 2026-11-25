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

import java.util.ArrayList;
import java.util.List;
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

  private static final Pattern CHUNK_FOOTER =
      Pattern.compile(" \\| chunk ([1-9][0-9]*)/[1-9][0-9]*\\z");

  private PageBodyTextContributor() {}

  /** Extract the article text from an indexed context, or null when its metadata no longer matches. */
  public static String descriptionPassage(Page page, String context) {
    String header = VectorDocBuilder.buildMetaLightText(page, INSTANCE.entityType());
    if (context == null || !context.startsWith(header)) {
      return null;
    }
    Matcher footer = CHUNK_FOOTER.matcher(context);
    if (!footer.find() || footer.start() < header.length()) {
      return null;
    }
    String body = context.substring(header.length(), footer.start());
    List<String> labels = new ArrayList<>();
    appendIfPresent(labels, "title", titleOf(page));
    labels.add("description:");
    List<String> labelChunks = TextChunkManager.chunk(String.join("; ", labels));
    int ordinal = Integer.parseInt(footer.group(1));
    if (ordinal > labelChunks.size()) {
      return body;
    }
    String prefix = labelChunks.getLast();
    return ordinal == labelChunks.size() && body.startsWith(prefix)
        ? body.substring(prefix.length()).stripLeading()
        : null;
  }

  @Override
  public String entityType() {
    return KnowledgePageRepository.KNOWLEDGE_PAGE_ENTITY;
  }

  @Override
  public BodyTextExtractor extractor() {
    return PageBodyTextContributor::extractBodyText;
  }

  static String extractBodyText(EntityInterface<?> entity) {
    if (!(entity instanceof Page page)) {
      return null;
    }
    List<String> parts = new ArrayList<>();
    appendIfPresent(parts, "title", titleOf(page));
    appendIfPresent(parts, "description", page.getDescription());
    if (page.getPageType() == PageType.QUICK_LINK) {
      appendIfPresent(parts, "url", extractQuickLinkUrl(page));
    }
    return parts.isEmpty() ? "" : String.join("; ", parts);
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

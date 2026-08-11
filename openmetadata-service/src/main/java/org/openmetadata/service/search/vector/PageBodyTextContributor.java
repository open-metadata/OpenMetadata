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
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.entity.data.Page;
import org.openmetadata.schema.entity.data.PageType;
import org.openmetadata.schema.entity.data.QuickLink;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.jdbi3.KnowledgePageRepository;
import org.openmetadata.service.search.vector.VectorDocBuilder.BodyTextExtractor;

/**
 * Body text contributor for {@link Page}. The default description-only extractor would miss the
 * page title (lives in {@code displayName}) and, for QuickLink pages, the link URL. This
 * contributor concatenates the populated page fields so the vector represents the title, body,
 * and (for quick links) destination URL.
 */
@Slf4j
public final class PageBodyTextContributor implements VectorBodyTextContributor {

  public static final PageBodyTextContributor INSTANCE = new PageBodyTextContributor();

  private PageBodyTextContributor() {}

  @Override
  public String entityType() {
    return KnowledgePageRepository.KNOWLEDGE_PAGE_ENTITY;
  }

  @Override
  public BodyTextExtractor extractor() {
    return PageBodyTextContributor::extractBodyText;
  }

  static String extractBodyText(EntityInterface entity) {
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

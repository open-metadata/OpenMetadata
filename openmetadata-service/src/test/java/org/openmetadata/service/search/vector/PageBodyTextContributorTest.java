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

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.net.URI;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.entity.data.Page;
import org.openmetadata.schema.entity.data.PageType;
import org.openmetadata.schema.entity.data.QuickLink;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.service.jdbi3.KnowledgePageRepository;

class PageBodyTextContributorTest {

  @Test
  void entityType_matchesKnowledgePageConstant() {
    assertEquals(
        KnowledgePageRepository.KNOWLEDGE_PAGE_ENTITY,
        PageBodyTextContributor.INSTANCE.entityType());
  }

  @Test
  void extract_articleIncludesTitleAndDescription() {
    Page page =
        basePage()
            .withPageType(PageType.ARTICLE)
            .withDisplayName("Onboarding Guide")
            .withDescription("Welcome to the platform...");

    String body = PageBodyTextContributor.extractBodyText(page);

    assertEquals("title: Onboarding Guide; description: Welcome to the platform...", body);
  }

  @Test
  void extract_quickLinkIncludesUrl() {
    Map<String, Object> quickLinkMap = new HashMap<>();
    quickLinkMap.put("url", "https://docs.example.com/onboarding");
    Page page =
        basePage()
            .withPageType(PageType.QUICK_LINK)
            .withDisplayName("Onboarding Docs")
            .withDescription("Quick link to docs")
            .withPage(quickLinkMap);

    String body = PageBodyTextContributor.extractBodyText(page);

    assertTrue(body.contains("title: Onboarding Docs"));
    assertTrue(body.contains("description: Quick link to docs"));
    assertTrue(body.contains("url: https://docs.example.com/onboarding"));
  }

  @Test
  void extract_quickLinkWithTypedQuickLinkObjectAlsoWorks() {
    QuickLink quickLink = new QuickLink().withUrl(URI.create("https://example.com/x"));
    Page page =
        basePage().withPageType(PageType.QUICK_LINK).withDisplayName("Example").withPage(quickLink);

    String body = PageBodyTextContributor.extractBodyText(page);

    assertTrue(body.contains("url: https://example.com/x"));
  }

  @Test
  void extract_articleDoesNotIncludeUrlEvenIfPagePayloadPresent() {
    Map<String, Object> articleMap = new HashMap<>();
    articleMap.put("publicationDate", "2025-01-01T00:00:00Z");
    Page page =
        basePage()
            .withPageType(PageType.ARTICLE)
            .withDisplayName("Article Title")
            .withDescription("Body")
            .withPage(articleMap);

    String body = PageBodyTextContributor.extractBodyText(page);

    assertFalse(body.contains("url"));
    assertFalse(body.contains("publicationDate"));
  }

  @Test
  void extract_quickLinkWithNullPagePayloadReturnsTitleAndDescriptionOnly() {
    Page page =
        basePage()
            .withPageType(PageType.QUICK_LINK)
            .withDisplayName("Title")
            .withDescription("Desc");

    String body = PageBodyTextContributor.extractBodyText(page);

    assertEquals("title: Title; description: Desc", body);
  }

  @Test
  void extract_skipsBlankFields() {
    Page page = basePage().withDisplayName("   ").withDescription("");

    String body = PageBodyTextContributor.extractBodyText(page);

    assertEquals("title: test-page", body);
  }

  @Test
  void extract_fallsBackToNameWhenDisplayNameIsBlank() {
    Page page = basePage().withName("my-page").withDisplayName(null).withDescription("Body");

    String body = PageBodyTextContributor.extractBodyText(page);

    assertEquals("title: my-page; description: Body", body);
  }

  @Test
  void extract_returnsNullForNonPageEntity() {
    Table table = new Table().withId(UUID.randomUUID()).withName("orders");

    String body = PageBodyTextContributor.extractBodyText(table);

    assertNull(body);
  }

  @Test
  void register_installsExtractorForPageEntityType() {
    PageBodyTextContributor.INSTANCE.register();
    Page page =
        basePage().withPageType(PageType.ARTICLE).withDisplayName("Hello").withDescription("World");

    String body =
        VectorDocBuilder.buildBodyText(page, KnowledgePageRepository.KNOWLEDGE_PAGE_ENTITY);

    assertEquals("title: Hello; description: World", body);
  }

  private Page basePage() {
    return new Page()
        .withId(UUID.randomUUID())
        .withName("test-page")
        .withFullyQualifiedName("test-page");
  }
}

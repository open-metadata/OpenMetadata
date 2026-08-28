package org.openmetadata.service.search.indexes;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;

import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.mockito.MockedStatic;
import org.mockito.Mockito;
import org.openmetadata.schema.entity.data.Dashboard;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.service.Entity;
import org.openmetadata.service.search.SearchRepository;

class TaggableIndexTest {

  private static MockedStatic<Entity> entityStaticMock;

  @BeforeAll
  static void setUp() {
    SearchRepository mockSearchRepo =
        Mockito.mock(SearchRepository.class, Mockito.RETURNS_DEEP_STUBS);
    entityStaticMock = Mockito.mockStatic(Entity.class);
    entityStaticMock.when(Entity::getSearchRepository).thenReturn(mockSearchRepo);
  }

  @AfterAll
  static void tearDown() {
    entityStaticMock.close();
  }

  @Test
  void testApplyTagFieldsSetsAllFourTagFields() {
    TagLabel tag1 =
        new TagLabel().withTagFQN("PII.Sensitive").withSource(TagLabel.TagSource.CLASSIFICATION);
    TagLabel tag2 =
        new TagLabel().withTagFQN("Glossary.Term1").withSource(TagLabel.TagSource.GLOSSARY);
    TagLabel tierTag =
        new TagLabel().withTagFQN("Tier.Tier1").withSource(TagLabel.TagSource.CLASSIFICATION);
    List<TagLabel> allTags = List.of(tag1, tag2, tierTag);

    entityStaticMock
        .when(() -> Entity.getEntityTags(anyString(), any(Dashboard.class)))
        .thenReturn(allTags);

    Dashboard dashboard =
        new Dashboard()
            .withId(UUID.randomUUID())
            .withName("test-dashboard")
            .withFullyQualifiedName("svc.test-dashboard");

    DashboardIndex index = new DashboardIndex(dashboard);
    Map<String, Object> doc = new HashMap<>();

    index.applyTagFields(doc);

    assertNotNull(doc.get("tags"));
    assertNotNull(doc.get("tier"));
    assertNotNull(doc.get("classificationTags"));
    assertNotNull(doc.get("glossaryTags"));
  }

  /**
   * Locks in the doc-shape separation that both the live-indexing path
   * ({@code SearchRepository.updateEntityIndex}) and the SearchIndexApp reindex path
   * ({@code BulkSink.addEntity}) produce — they converge on this same {@code applyTagFields}.
   *
   * <p>Tier is lifted out of {@code tags[]} onto the {@code tier} field; classification +
   * glossary tags stay in {@code tags[]}. Consumers (UI, DQ filters, RBAC) must filter via the
   * dedicated fields ({@code tier.tagFQN}, {@code certification.tagLabel.tagFQN}) — treating
   * {@code tags[]} as an all-encompassing bag was the wrong contract.
   */
  @Test
  @SuppressWarnings("unchecked")
  void tierIsLiftedOutOfTagsArrayOntoDedicatedField() {
    TagLabel pii =
        new TagLabel().withTagFQN("PII.Sensitive").withSource(TagLabel.TagSource.CLASSIFICATION);
    TagLabel glossary =
        new TagLabel()
            .withTagFQN("BusinessGlossary.Revenue")
            .withSource(TagLabel.TagSource.GLOSSARY);
    TagLabel tier =
        new TagLabel().withTagFQN("Tier.Tier1").withSource(TagLabel.TagSource.CLASSIFICATION);

    entityStaticMock
        .when(() -> Entity.getEntityTags(anyString(), any(Dashboard.class)))
        .thenReturn(new java.util.ArrayList<>(List.of(pii, glossary, tier)));

    Dashboard dashboard =
        new Dashboard()
            .withId(UUID.randomUUID())
            .withName("tier-separated")
            .withFullyQualifiedName("svc.tier-separated");

    DashboardIndex index = new DashboardIndex(dashboard);
    Map<String, Object> doc = new HashMap<>();

    index.applyTagFields(doc);

    List<TagLabel> tags = (List<TagLabel>) doc.get("tags");
    assertEquals(
        2,
        tags.size(),
        "Tier must NOT be in tags[]; only classification and glossary tags belong there");
    assertTrue(
        tags.stream().noneMatch(t -> t.getTagFQN().startsWith("Tier.")),
        "no Tier.* TagLabel may leak into tags[]; consumers must filter via tier.tagFQN");

    TagLabel tierField = (TagLabel) doc.get("tier");
    assertNotNull(tierField, "tier field must carry the lifted Tier TagLabel");
    assertEquals("Tier.Tier1", tierField.getTagFQN());

    List<String> classificationTags = (List<String>) doc.get("classificationTags");
    assertTrue(
        classificationTags.contains("PII.Sensitive"),
        "non-Tier classification FQNs go on classificationTags");

    List<String> glossaryTags = (List<String>) doc.get("glossaryTags");
    assertTrue(
        glossaryTags.contains("BusinessGlossary.Revenue"), "glossary FQNs go on glossaryTags");
  }

  @Test
  void testApplyTagFieldsWithEmptyTags() {
    entityStaticMock
        .when(() -> Entity.getEntityTags(anyString(), any(Dashboard.class)))
        .thenReturn(Collections.emptyList());

    Dashboard dashboard =
        new Dashboard()
            .withId(UUID.randomUUID())
            .withName("empty-tags")
            .withFullyQualifiedName("svc.empty-tags");

    DashboardIndex index = new DashboardIndex(dashboard);
    Map<String, Object> doc = new HashMap<>();

    index.applyTagFields(doc);

    assertTrue(((List<?>) doc.get("tags")).isEmpty());
    assertNull(doc.get("tier"));
  }

  @Test
  void testApplyTagFieldsWithEntityTagsOnly() {
    TagLabel entityTag =
        new TagLabel().withTagFQN("PII.Sensitive").withSource(TagLabel.TagSource.CLASSIFICATION);

    entityStaticMock
        .when(() -> Entity.getEntityTags(anyString(), any(Dashboard.class)))
        .thenReturn(List.of(entityTag));

    Dashboard dashboard =
        new Dashboard()
            .withId(UUID.randomUUID())
            .withName("entity-tags-only")
            .withFullyQualifiedName("svc.entity-tags-only");

    DashboardIndex index = new DashboardIndex(dashboard);
    Map<String, Object> doc = new HashMap<>();

    index.applyTagFields(doc);

    @SuppressWarnings("unchecked")
    List<TagLabel> tags = (List<TagLabel>) doc.get("tags");
    assertEquals(1, tags.size());
    assertEquals("PII.Sensitive", tags.get(0).getTagFQN());
  }
}

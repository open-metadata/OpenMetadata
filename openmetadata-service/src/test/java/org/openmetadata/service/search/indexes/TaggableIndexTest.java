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

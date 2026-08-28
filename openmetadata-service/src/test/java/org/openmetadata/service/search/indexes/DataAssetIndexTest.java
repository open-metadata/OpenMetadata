package org.openmetadata.service.search.indexes;

import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.mockito.MockedStatic;
import org.mockito.Mockito;
import org.openmetadata.schema.entity.data.Dashboard;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.search.SearchRepository;

class DataAssetIndexTest {

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

  private void mockEntityStatics() {
    entityStaticMock
        .when(() -> Entity.getEntityTags(anyString(), any()))
        .thenReturn(Collections.emptyList());

    CollectionDAO dao = mock(CollectionDAO.class);
    CollectionDAO.EntityRelationshipDAO relDao = mock(CollectionDAO.EntityRelationshipDAO.class);
    when(dao.relationshipDAO()).thenReturn(relDao);
    when(relDao.findFrom(any(UUID.class), anyString(), anyInt()))
        .thenReturn(Collections.emptyList());
    entityStaticMock.when(Entity::getCollectionDAO).thenReturn(dao);
  }

  @Test
  void testBuildSearchIndexDoc_appliesAllThreeGroups() {
    UUID serviceId = UUID.randomUUID();
    EntityReference serviceRef =
        new EntityReference()
            .withId(serviceId)
            .withType("dashboardService")
            .withName("looker")
            .withDisplayName("Looker");

    Dashboard dashboard =
        new Dashboard()
            .withId(UUID.randomUUID())
            .withName("combined-test")
            .withFullyQualifiedName("looker.combined-test")
            .withService(serviceRef)
            .withServiceType(
                org.openmetadata.schema.api.data.CreateDashboardDataModel.DashboardServiceType
                    .Looker);

    mockEntityStatics();

    DashboardIndex index = new DashboardIndex(dashboard);
    Map<String, Object> result = index.buildSearchIndexDoc();

    // Tags applied
    assertTrue(result.containsKey("tags"));
    assertTrue(result.containsKey("classificationTags"));
    assertTrue(result.containsKey("glossaryTags"));

    // Service applied
    assertTrue(result.containsKey("service"));
    assertTrue(result.containsKey("serviceType"));

    // Lineage applied
    assertTrue(result.containsKey("upstreamLineage"));
  }

  @Test
  void testBuildSearchIndexDoc_mergesChildTags() {
    TagLabel childTag =
        new TagLabel().withTagFQN("PII.Email").withSource(TagLabel.TagSource.CLASSIFICATION);

    Dashboard dashboard =
        new Dashboard()
            .withId(UUID.randomUUID())
            .withName("child-test")
            .withFullyQualifiedName("svc.child-test")
            .withServiceType(
                org.openmetadata.schema.api.data.CreateDashboardDataModel.DashboardServiceType
                    .Looker);

    entityStaticMock
        .when(() -> Entity.getEntityTags(anyString(), any()))
        .thenReturn(List.of(childTag));

    CollectionDAO dao = mock(CollectionDAO.class);
    CollectionDAO.EntityRelationshipDAO relDao = mock(CollectionDAO.EntityRelationshipDAO.class);
    when(dao.relationshipDAO()).thenReturn(relDao);
    when(relDao.findFrom(any(UUID.class), anyString(), anyInt()))
        .thenReturn(Collections.emptyList());
    entityStaticMock.when(Entity::getCollectionDAO).thenReturn(dao);

    DashboardIndex index = new DashboardIndex(dashboard);
    Map<String, Object> result = index.buildSearchIndexDoc();

    @SuppressWarnings("unchecked")
    List<TagLabel> tags = (List<TagLabel>) result.get("tags");
    assertNotNull(tags);
    assertTrue(tags.stream().anyMatch(t -> "PII.Email".equals(t.getTagFQN())));
  }

  @Test
  void testBuildSearchIndexDoc_noArgHasAllExpectedKeys() {
    Dashboard dashboard =
        new Dashboard()
            .withId(UUID.randomUUID())
            .withName("no-arg-test")
            .withFullyQualifiedName("svc.no-arg-test");

    mockEntityStatics();

    DashboardIndex index = new DashboardIndex(dashboard);
    Map<String, Object> result = index.buildSearchIndexDoc();

    assertTrue(result.containsKey("tags"));
    assertTrue(result.containsKey("upstreamLineage"));
  }
}

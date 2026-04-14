package org.openmetadata.service.search.indexes;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.HashMap;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.mockito.MockedStatic;
import org.mockito.Mockito;
import org.openmetadata.schema.entity.data.Dashboard;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.service.Entity;
import org.openmetadata.service.search.SearchRepository;

class ServiceBackedIndexTest {

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
  void testApplyServiceFieldsSetsServiceWithDisplayName() {
    UUID serviceId = UUID.randomUUID();
    EntityReference serviceRef =
        new EntityReference()
            .withId(serviceId)
            .withType("dashboardService")
            .withName("looker")
            .withDisplayName("Looker Production");

    Dashboard dashboard =
        new Dashboard()
            .withId(UUID.randomUUID())
            .withName("test-dash")
            .withFullyQualifiedName("looker.test-dash")
            .withService(serviceRef);

    DashboardIndex index = new DashboardIndex(dashboard);
    Map<String, Object> doc = new HashMap<>();

    index.applyServiceFields(doc);

    assertNotNull(doc.get("service"));
    EntityReference result = (EntityReference) doc.get("service");
    assertEquals("Looker Production", result.getDisplayName());
    assertEquals("looker", result.getName());
  }

  @Test
  void testApplyServiceFieldsWithNullService() {
    Dashboard dashboard =
        new Dashboard()
            .withId(UUID.randomUUID())
            .withName("no-service")
            .withFullyQualifiedName("no-service");

    DashboardIndex index = new DashboardIndex(dashboard);
    Map<String, Object> doc = new HashMap<>();

    index.applyServiceFields(doc);

    assertFalse(doc.containsKey("service"));
  }

  @Test
  void testApplyServiceFieldsSetsServiceType() {
    Dashboard dashboard =
        new Dashboard()
            .withId(UUID.randomUUID())
            .withName("typed-dash")
            .withFullyQualifiedName("svc.typed-dash")
            .withServiceType(
                org.openmetadata.schema.api.data.CreateDashboardDataModel.DashboardServiceType
                    .Looker);

    DashboardIndex index = new DashboardIndex(dashboard);
    Map<String, Object> doc = new HashMap<>();

    index.applyServiceFields(doc);

    assertNotNull(doc.get("serviceType"));
    assertEquals(
        org.openmetadata.schema.api.data.CreateDashboardDataModel.DashboardServiceType.Looker,
        doc.get("serviceType"));
  }

  @Test
  void testApplyServiceFieldsWithNullServiceType() {
    EntityReference serviceRef =
        new EntityReference()
            .withId(UUID.randomUUID())
            .withType("dashboardService")
            .withName("svc");

    Dashboard dashboard =
        new Dashboard()
            .withId(UUID.randomUUID())
            .withName("no-type")
            .withFullyQualifiedName("svc.no-type")
            .withService(serviceRef);

    // Use a concrete impl that returns null serviceType
    ServiceBackedIndex index =
        new ServiceBackedIndex() {
          @Override
          public Object getEntity() {
            return dashboard;
          }

          @Override
          public String getEntityTypeName() {
            return Entity.DASHBOARD;
          }

          @Override
          public Map<String, Object> buildSearchIndexDocInternal(Map<String, Object> esDoc) {
            return esDoc;
          }
        };

    Map<String, Object> doc = new HashMap<>();
    index.applyServiceFields(doc);

    assertTrue(doc.containsKey("service"));
    assertFalse(doc.containsKey("serviceType"));
  }

  @Test
  void testApplyServiceFieldsWithDisplayNameFallsBackToName() {
    EntityReference serviceRef =
        new EntityReference()
            .withId(UUID.randomUUID())
            .withType("dashboardService")
            .withName("looker");
    // displayName is null

    Dashboard dashboard =
        new Dashboard()
            .withId(UUID.randomUUID())
            .withName("fallback-test")
            .withFullyQualifiedName("looker.fallback-test")
            .withService(serviceRef);

    DashboardIndex index = new DashboardIndex(dashboard);
    Map<String, Object> doc = new HashMap<>();

    index.applyServiceFields(doc);

    EntityReference result = (EntityReference) doc.get("service");
    // When displayName is null, getEntityWithDisplayName falls back to name
    assertEquals("looker", result.getDisplayName());
  }
}

package org.openmetadata.service.migration.utils.v210;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Answers.RETURNS_DEEP_STUBS;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import java.util.Arrays;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.jdbi.v3.core.Handle;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.entity.data.Chart;
import org.openmetadata.schema.entity.services.DashboardService;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.search.SearchRepository;
import org.openmetadata.service.util.FullyQualifiedName;

class SupersetChartFqnCollisionFixTest {

  private static final String GET_SUPERSET_SERVICES =
      "SELECT id FROM dashboard_service_entity WHERE serviceType = 'Superset'";

  @Test
  void fixSupersetChartFqnCollisionRenamesNumericChartAndReindexes() {
    Handle handle = mock(Handle.class, RETURNS_DEEP_STUBS);
    CollectionDAO collectionDAO = mock(CollectionDAO.class);
    CollectionDAO.EntityRelationshipDAO relationshipDAO =
        mock(CollectionDAO.EntityRelationshipDAO.class);
    CollectionDAO.DashboardServiceDAO dashboardServiceDAO =
        mock(CollectionDAO.DashboardServiceDAO.class);
    CollectionDAO.ChartDAO chartDAO = mock(CollectionDAO.ChartDAO.class);
    SearchRepository searchRepository = mock(SearchRepository.class);
    Entity.setSearchRepository(searchRepository);

    when(collectionDAO.relationshipDAO()).thenReturn(relationshipDAO);
    when(collectionDAO.dashboardServiceDAO()).thenReturn(dashboardServiceDAO);
    when(collectionDAO.chartDAO()).thenReturn(chartDAO);

    UUID serviceId = UUID.randomUUID();
    UUID chartId = UUID.randomUUID();

    stubSupersetServiceRows(handle, serviceId);
    when(relationshipDAO.findTo(
            serviceId, Entity.DASHBOARD_SERVICE, Relationship.CONTAINS.ordinal(), Entity.CHART))
        .thenReturn(List.of(relationship(chartId)));

    String serviceFqn = "superset";
    DashboardService service =
        new DashboardService()
            .withId(serviceId)
            .withName("superset")
            .withFullyQualifiedName(serviceFqn);
    Chart chart =
        new Chart().withId(chartId).withName("1").withFullyQualifiedName(serviceFqn + ".1");

    when(dashboardServiceDAO.findEntityById(serviceId)).thenReturn(service);
    when(chartDAO.findEntityById(chartId)).thenReturn(chart);

    SupersetChartFqnCollisionFix.fixSupersetChartFqnCollision(handle, collectionDAO);

    String expectedFqn = FullyQualifiedName.add(serviceFqn, "chart_1");
    assertEquals("chart_1", chart.getName());
    assertEquals(expectedFqn, chart.getFullyQualifiedName());
    verify(chartDAO).update(chart);
    verify(searchRepository).updateEntityIndex(chart);
  }

  @Test
  void fixSupersetChartFqnCollisionSkipsAlreadyRenamedChart() {
    Handle handle = mock(Handle.class, RETURNS_DEEP_STUBS);
    CollectionDAO collectionDAO = mock(CollectionDAO.class);
    CollectionDAO.EntityRelationshipDAO relationshipDAO =
        mock(CollectionDAO.EntityRelationshipDAO.class);
    CollectionDAO.DashboardServiceDAO dashboardServiceDAO =
        mock(CollectionDAO.DashboardServiceDAO.class);
    CollectionDAO.ChartDAO chartDAO = mock(CollectionDAO.ChartDAO.class);

    when(collectionDAO.relationshipDAO()).thenReturn(relationshipDAO);
    when(collectionDAO.dashboardServiceDAO()).thenReturn(dashboardServiceDAO);
    when(collectionDAO.chartDAO()).thenReturn(chartDAO);

    UUID serviceId = UUID.randomUUID();
    UUID chartId = UUID.randomUUID();

    stubSupersetServiceRows(handle, serviceId);
    when(relationshipDAO.findTo(
            serviceId, Entity.DASHBOARD_SERVICE, Relationship.CONTAINS.ordinal(), Entity.CHART))
        .thenReturn(List.of(relationship(chartId)));

    String serviceFqn = "superset";
    DashboardService service =
        new DashboardService()
            .withId(serviceId)
            .withName("superset")
            .withFullyQualifiedName(serviceFqn);
    Chart chart =
        new Chart()
            .withId(chartId)
            .withName("chart_1")
            .withFullyQualifiedName(serviceFqn + ".chart_1");

    when(dashboardServiceDAO.findEntityById(serviceId)).thenReturn(service);
    when(chartDAO.findEntityById(chartId)).thenReturn(chart);

    SupersetChartFqnCollisionFix.fixSupersetChartFqnCollision(handle, collectionDAO);

    verify(chartDAO, never()).update(chart);
  }

  @Test
  void fixSupersetChartFqnCollisionSkipsWhenNoSupersetServicesExist() {
    Handle handle = mock(Handle.class, RETURNS_DEEP_STUBS);
    CollectionDAO collectionDAO = mock(CollectionDAO.class);

    stubSupersetServiceRows(handle);

    SupersetChartFqnCollisionFix.fixSupersetChartFqnCollision(handle, collectionDAO);

    verifyNoInteractions(collectionDAO);
  }

  private static void stubSupersetServiceRows(Handle handle, UUID... ids) {
    List<Map<String, Object>> rows =
        Arrays.stream(ids)
            .map(
                id -> {
                  Map<String, Object> row = new HashMap<>();
                  row.put("id", id.toString());
                  return row;
                })
            .toList();
    when(handle.createQuery(GET_SUPERSET_SERVICES).mapToMap().list()).thenReturn(rows);
  }

  private static CollectionDAO.EntityRelationshipRecord relationship(UUID id) {
    return CollectionDAO.EntityRelationshipRecord.builder()
        .id(id)
        .type(Entity.CHART)
        .json("{}")
        .build();
  }
}

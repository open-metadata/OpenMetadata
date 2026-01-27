package org.openmetadata.sdk.entities;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mock;
import org.mockito.MockitoAnnotations;
import org.openmetadata.schema.api.data.CreateDashboard;
import org.openmetadata.schema.entity.data.Dashboard;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.services.dataassets.DashboardService;

/**
 * Mock tests for Dashboard entity operations.
 */
public class DashboardMockTest {

  @Mock private OpenMetadataClient mockClient;
  @Mock private DashboardService mockDashboardService;

  @BeforeEach
  void setUp() {
    MockitoAnnotations.openMocks(this);
    when(mockClient.dashboards()).thenReturn(mockDashboardService);
    org.openmetadata.sdk.entities.Dashboard.setDefaultClient(mockClient);
  }

  @Test
  void testCreateDashboard() {
    // Arrange
    CreateDashboard createRequest = new CreateDashboard();
    createRequest.setName("sales_dashboard");
    createRequest.setService("superset");
    createRequest.setDisplayName("Sales Dashboard");
    createRequest.setDescription("Monthly sales metrics dashboard");

    Dashboard expectedDashboard = new Dashboard();
    expectedDashboard.setId(UUID.randomUUID());
    expectedDashboard.setName("sales_dashboard");
    expectedDashboard.setFullyQualifiedName("superset.sales_dashboard");
    expectedDashboard.setDisplayName("Sales Dashboard");

    when(mockDashboardService.create(any(CreateDashboard.class))).thenReturn(expectedDashboard);

    // Act
    Dashboard result = org.openmetadata.sdk.entities.Dashboard.create(createRequest);

    // Assert
    assertNotNull(result);
    assertEquals("sales_dashboard", result.getName());
    assertEquals("Sales Dashboard", result.getDisplayName());
    assertEquals("superset.sales_dashboard", result.getFullyQualifiedName());
    verify(mockDashboardService).create(any(CreateDashboard.class));
  }

  @Test
  void testRetrieveDashboard() {
    // Arrange
    String dashboardId = UUID.randomUUID().toString();
    Dashboard expectedDashboard = new Dashboard();
    expectedDashboard.setId(UUID.fromString(dashboardId));
    expectedDashboard.setName("analytics_dashboard");
    expectedDashboard.setSourceUrl("https://superset.example.com/dashboard/123");

    when(mockDashboardService.get(dashboardId)).thenReturn(expectedDashboard);

    // Act
    Dashboard result = org.openmetadata.sdk.entities.Dashboard.retrieve(dashboardId);

    // Assert
    assertNotNull(result);
    assertEquals(dashboardId, result.getId().toString());
    assertEquals("analytics_dashboard", result.getName());
    assertEquals("https://superset.example.com/dashboard/123", result.getSourceUrl());
    verify(mockDashboardService).get(dashboardId);
  }

  @Test
  void testRetrieveDashboardWithCharts() {
    // Arrange
    String dashboardId = UUID.randomUUID().toString();
    String fields = "charts,tags,owner";
    Dashboard expectedDashboard = new Dashboard();
    expectedDashboard.setId(UUID.fromString(dashboardId));
    expectedDashboard.setName("kpi_dashboard");

    // Mock charts field
    EntityReference chart1 = new EntityReference();
    chart1.setName("revenue_chart");
    chart1.setType("chart");
    EntityReference chart2 = new EntityReference();
    chart2.setName("user_growth_chart");
    chart2.setType("chart");
    expectedDashboard.setCharts(List.of(chart1, chart2));

    when(mockDashboardService.get(dashboardId, fields)).thenReturn(expectedDashboard);

    // Act
    Dashboard result = org.openmetadata.sdk.entities.Dashboard.retrieve(dashboardId, fields);

    // Assert
    assertNotNull(result);
    assertNotNull(result.getCharts());
    assertEquals(2, result.getCharts().size());
    assertEquals("revenue_chart", result.getCharts().get(0).getName());
    assertEquals("user_growth_chart", result.getCharts().get(1).getName());
    verify(mockDashboardService).get(dashboardId, fields);
  }

  @Test
  void testRetrieveDashboardByName() {
    // Arrange
    String fqn = "tableau.finance.quarterly_report";
    Dashboard expectedDashboard = new Dashboard();
    expectedDashboard.setName("quarterly_report");
    expectedDashboard.setFullyQualifiedName(fqn);

    when(mockDashboardService.getByName(fqn)).thenReturn(expectedDashboard);

    // Act
    Dashboard result = org.openmetadata.sdk.entities.Dashboard.retrieveByName(fqn);

    // Assert
    assertNotNull(result);
    assertEquals(fqn, result.getFullyQualifiedName());
    assertEquals("quarterly_report", result.getName());
    verify(mockDashboardService).getByName(fqn);
  }

  @Test
  void testUpdateDashboard() {
    // Arrange
    Dashboard dashboardToUpdate = new Dashboard();
    dashboardToUpdate.setId(UUID.randomUUID());
    dashboardToUpdate.setName("metrics_dashboard");
    dashboardToUpdate.setDescription("Updated dashboard with new KPIs");

    // Add tags
    TagLabel tag = new TagLabel();
    tag.setTagFQN("PII.Sensitive");
    dashboardToUpdate.setTags(List.of(tag));

    Dashboard expectedDashboard = new Dashboard();
    expectedDashboard.setId(dashboardToUpdate.getId());
    expectedDashboard.setName(dashboardToUpdate.getName());
    expectedDashboard.setDescription(dashboardToUpdate.getDescription());
    expectedDashboard.setTags(dashboardToUpdate.getTags());

    when(mockDashboardService.update(dashboardToUpdate.getId().toString(), dashboardToUpdate))
        .thenReturn(expectedDashboard);

    // Act
    Dashboard result =
        org.openmetadata.sdk.entities.Dashboard.update(
            dashboardToUpdate.getId().toString(), dashboardToUpdate);

    // Assert
    assertNotNull(result);
    assertEquals("Updated dashboard with new KPIs", result.getDescription());
    assertNotNull(result.getTags());
    assertEquals(1, result.getTags().size());
    assertEquals("PII.Sensitive", result.getTags().get(0).getTagFQN());
    verify(mockDashboardService).update(dashboardToUpdate.getId().toString(), dashboardToUpdate);
  }

  @Test
  void testDeleteDashboard() {
    // Arrange
    String dashboardId = UUID.randomUUID().toString();
    doNothing().when(mockDashboardService).delete(eq(dashboardId), any());

    // Act
    org.openmetadata.sdk.entities.Dashboard.delete(dashboardId);

    // Assert
    verify(mockDashboardService).delete(eq(dashboardId), any());
  }

  @Test
  void testAsyncOperations() throws Exception {
    // Arrange
    String dashboardId = UUID.randomUUID().toString();
    Dashboard expectedDashboard = new Dashboard();
    expectedDashboard.setId(UUID.fromString(dashboardId));
    expectedDashboard.setName("async_dashboard");

    when(mockDashboardService.get(dashboardId)).thenReturn(expectedDashboard);

    // Act
    var future = org.openmetadata.sdk.entities.Dashboard.retrieveAsync(dashboardId);
    Dashboard result = future.get();

    // Assert
    assertNotNull(result);
    assertEquals("async_dashboard", result.getName());
    verify(mockDashboardService).get(dashboardId);
  }
}

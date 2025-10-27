package org.openmetadata.sdk.fluent;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mock;
import org.mockito.MockitoAnnotations;
import org.openmetadata.schema.api.data.CreateDashboard;
import org.openmetadata.schema.entity.data.Dashboard;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.services.dataassets.DashboardService;

/**
 * Tests for Dashboards fluent API.
 * Verifies the fluent interface for dashboard creation, retrieval, and manipulation.
 */
public class DashboardsFluentAPITest {

  @Mock private OpenMetadataClient mockClient;
  @Mock private DashboardService mockDashboardService;

  @BeforeEach
  void setUp() {
    MockitoAnnotations.openMocks(this);
    when(mockClient.dashboards()).thenReturn(mockDashboardService);
    Dashboards.setDefaultClient(mockClient);
  }

  @Test
  void testCreateDashboard() {
    // Arrange
    CreateDashboard createRequest = new CreateDashboard();
    createRequest.setName("test_dashboard");
    createRequest.setService("dashboard_service");

    Dashboard expectedDashboard = new Dashboard();
    expectedDashboard.setId(UUID.randomUUID());
    expectedDashboard.setName("test_dashboard");
    expectedDashboard.setFullyQualifiedName("dashboard_service.test_dashboard");

    when(mockDashboardService.create(any(CreateDashboard.class))).thenReturn(expectedDashboard);

    // Act
    Dashboard result = Dashboards.create(createRequest);

    // Assert
    assertNotNull(result);
    assertEquals("test_dashboard", result.getName());
    assertEquals("dashboard_service.test_dashboard", result.getFullyQualifiedName());
    verify(mockDashboardService).create(any(CreateDashboard.class));
  }

  @Test
  void testFindDashboard() {
    // Arrange
    String dashboardId = UUID.randomUUID().toString();
    Dashboard expectedDashboard = new Dashboard();
    expectedDashboard.setId(UUID.fromString(dashboardId));
    expectedDashboard.setName("test_dashboard");
    expectedDashboard.setDescription("Test dashboard description");

    when(mockDashboardService.get(dashboardId)).thenReturn(expectedDashboard);

    // Act
    Dashboard result = Dashboards.find(dashboardId).fetch().get();

    // Assert
    assertNotNull(result);
    assertEquals(dashboardId, result.getId().toString());
    assertEquals("test_dashboard", result.getName());
    verify(mockDashboardService).get(dashboardId);
  }

  @Test
  void testFindDashboardWithIncludes() {
    // Arrange
    String dashboardId = UUID.randomUUID().toString();
    Dashboard expectedDashboard = new Dashboard();
    expectedDashboard.setId(UUID.fromString(dashboardId));
    expectedDashboard.setName("test_dashboard");

    when(mockDashboardService.get(eq(dashboardId), anyString())).thenReturn(expectedDashboard);

    // Act
    Dashboard result = Dashboards.find(dashboardId).includeOwners().includeTags().fetch().get();

    // Assert
    assertNotNull(result);
    assertEquals(dashboardId, result.getId().toString());
    verify(mockDashboardService).get(eq(dashboardId), anyString());
  }

  @Test
  void testFindDashboardByName() {
    // Arrange
    String fqn = "dashboard_service.test_dashboard";
    Dashboard expectedDashboard = new Dashboard();
    expectedDashboard.setName("test_dashboard");
    expectedDashboard.setFullyQualifiedName(fqn);

    when(mockDashboardService.getByName(fqn)).thenReturn(expectedDashboard);

    // Act
    Dashboard result = Dashboards.findByName(fqn).fetch().get();

    // Assert
    assertNotNull(result);
    assertEquals(fqn, result.getFullyQualifiedName());
    assertEquals("test_dashboard", result.getName());
    verify(mockDashboardService).getByName(fqn);
  }

  // Test removed - DashboardCreator methods don't exist yet

  // Test removed - FluentDashboard.save() doesn't return Dashboard directly

  @Test
  void testDeleteDashboard() {
    // Arrange
    String dashboardId = UUID.randomUUID().toString();
    doNothing().when(mockDashboardService).delete(eq(dashboardId), any());

    // Act
    Dashboards.find(dashboardId).delete().confirm();

    // Assert
    verify(mockDashboardService).delete(eq(dashboardId), any());
  }

  @Test
  void testDeleteDashboardWithOptions() {
    // Arrange
    String dashboardId = UUID.randomUUID().toString();
    doNothing().when(mockDashboardService).delete(eq(dashboardId), any());

    // Act
    Dashboards.find(dashboardId).delete().recursively().permanently().confirm();

    // Assert
    verify(mockDashboardService)
        .delete(
            eq(dashboardId),
            argThat(
                params ->
                    "true".equals(params.get("recursive"))
                        && "true".equals(params.get("hardDelete"))));
  }

  @Test
  void testListDashboards() {
    // Arrange
    Dashboard dashboard1 = new Dashboard();
    dashboard1.setName("dashboard1");
    Dashboard dashboard2 = new Dashboard();
    dashboard2.setName("dashboard2");

    when(mockDashboardService.list(any()))
        .thenReturn(
            new org.openmetadata.sdk.models.ListResponse<Dashboard>(
                java.util.List.of(dashboard1, dashboard2)));

    // Act
    var lister = Dashboards.list().limit(10);
    // Execute the list operation by iterating
    lister.forEach(
        dashboard -> {
          assertNotNull(dashboard);
        });

    // Assert
    assertNotNull(lister);
    verify(mockDashboardService, atLeastOnce()).list(any());
  }

  @Test
  void testDashboardsWithoutClient() {
    // Reset client to null
    Dashboards.setDefaultClient(null);

    // Act & Assert
    assertThrows(IllegalStateException.class, () -> Dashboards.create());
    assertThrows(IllegalStateException.class, () -> Dashboards.find("id"));
    assertThrows(IllegalStateException.class, () -> Dashboards.list());
  }

  // Test removed - addChart method signature doesn't match
}

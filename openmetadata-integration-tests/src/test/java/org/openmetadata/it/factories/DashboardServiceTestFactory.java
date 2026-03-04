package org.openmetadata.it.factories;

import java.net.URI;
import java.util.UUID;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.schema.api.data.CreateDashboardDataModel.DashboardServiceType;
import org.openmetadata.schema.api.services.CreateDashboardService;
import org.openmetadata.schema.entity.services.DashboardService;
import org.openmetadata.schema.services.connections.dashboard.LookerConnection;
import org.openmetadata.schema.services.connections.dashboard.MetabaseConnection;
import org.openmetadata.schema.type.DashboardConnection;

/**
 * Factory for creating DashboardService entities in integration tests.
 *
 * <p>Provides namespace-isolated entity creation with consistent patterns.
 */
public class DashboardServiceTestFactory {

  /**
   * Create a Metabase dashboard service with default settings. Each call creates a unique service
   * to avoid conflicts in parallel test execution.
   */
  public static DashboardService createMetabase(TestNamespace ns) {
    String uniqueId = UUID.randomUUID().toString().substring(0, 8);
    String name = ns.prefix("metabaseService_" + uniqueId);

    MetabaseConnection metabaseConn =
        new MetabaseConnection()
            .withHostPort(URI.create("http://localhost:3000"))
            .withUsername("admin");

    DashboardConnection conn = new DashboardConnection().withConfig(metabaseConn);

    CreateDashboardService request =
        new CreateDashboardService()
            .withName(name)
            .withServiceType(DashboardServiceType.Metabase)
            .withConnection(conn)
            .withDescription("Test Metabase service");

    return SdkClients.adminClient().dashboardServices().create(request);
  }

  /**
   * Create a Looker dashboard service with default settings. Each call creates a unique service to
   * avoid conflicts in parallel test execution.
   */
  public static DashboardService createLooker(TestNamespace ns) {
    String uniqueId = UUID.randomUUID().toString().substring(0, 8);
    String name = ns.prefix("lookerService_" + uniqueId);

    LookerConnection lookerConn =
        new LookerConnection()
            .withHostPort(URI.create("http://localhost:9999"))
            .withClientId("test-client");

    DashboardConnection conn = new DashboardConnection().withConfig(lookerConn);

    CreateDashboardService request =
        new CreateDashboardService()
            .withName(name)
            .withServiceType(DashboardServiceType.Looker)
            .withConnection(conn)
            .withDescription("Test Looker service");

    return SdkClients.adminClient().dashboardServices().create(request);
  }

  /** Get dashboard service by ID. */
  public static DashboardService getById(String id) {
    return SdkClients.adminClient().dashboardServices().get(id);
  }
}

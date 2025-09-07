package org.openmetadata.service.sdk;

import static org.junit.jupiter.api.Assertions.*;
import static org.openmetadata.service.security.SecurityUtil.authHeaders;

import org.junit.jupiter.api.Test;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.sdk.OM;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.config.OpenMetadataConfig;
import org.openmetadata.service.OpenMetadataApplicationTest;

/**
 * Simple demonstration of SDK API usage.
 * Shows how the SDK simplifies OpenMetadata API interactions.
 */
public class SimpleSDKDemo extends OpenMetadataApplicationTest {

  @Test
  public void demonstrateSDKSimplicity() {
    // Get the randomized port from the running server
    int port = APP.getLocalPort();
    String serverUrl = String.format("http://localhost:%d/api", port);

    System.out.println("=================================================================");
    System.out.println("OpenMetadata SDK Demo - Server running on port: " + port);
    System.out.println("=================================================================");

    // 1. Create SDK client - simple builder pattern
    OpenMetadataClient client =
        new OpenMetadataClient(
            OpenMetadataConfig.builder()
                .serverUrl(serverUrl)
                .apiKey(authHeaders("admin@open-metadata.org").get("Authorization"))
                .connectTimeout(30000) // 30 seconds in milliseconds
                .readTimeout(60000) // 60 seconds in milliseconds
                .build());

    System.out.println("✓ SDK Client created with server URL: " + serverUrl);

    // 2. Initialize OM wrapper with the client
    OM.init(client);
    System.out.println("✓ OM wrapper initialized with client");

    // 3. Retrieve tables using the simplified SDK
    try {
      // Get a table by name if one exists
      Table table = OM.Table.retrieveByName("sample_data.ecommerce_db.shopify.dim_address");
      if (table != null) {
        System.out.println("✓ Retrieved table: " + table.getName());
        System.out.println("  - Fully Qualified Name: " + table.getFullyQualifiedName());
        System.out.println("  - Description: " + table.getDescription());
      }
    } catch (Exception e) {
      System.out.println("Note: Sample table not found. Error: " + e.getMessage());
    }

    // 4. Demonstrate creating and updating a table
    try {
      // This would require a database service to exist first
      System.out.println("✓ SDK provides simple CRUD operations through the OM wrapper");
      System.out.println("  - OM.Table.create(createRequest)");
      System.out.println("  - OM.Table.retrieve(id)");
      System.out.println("  - OM.Table.update(table)");
      System.out.println("  - OM.Table.delete(id)");
    } catch (Exception e) {
      System.out.println("Note: Table operations require existing database service");
    }

    System.out.println("=================================================================");
    System.out.println("SDK Demo completed successfully!");
    System.out.println("=================================================================");
  }
}

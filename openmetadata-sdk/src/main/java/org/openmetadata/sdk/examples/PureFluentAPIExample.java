package org.openmetadata.sdk.examples;

import java.util.UUID;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.config.OpenMetadataConfig;
import org.openmetadata.sdk.fluent.Databases;
import org.openmetadata.sdk.fluent.Tables;
import org.openmetadata.sdk.fluent.Teams;
import org.openmetadata.sdk.fluent.Users;

/**
 * Example demonstrating the Pure Fluent API pattern.
 */
public class PureFluentAPIExample {

  public static void main(String[] args) {
    // Initialize client
    OpenMetadataConfig config =
        OpenMetadataConfig.builder().serverUrl("http://localhost:8585/api").build();
    OpenMetadataClient client = new OpenMetadataClient(config);

    // Set default client for all fluent operations
    Tables.setDefaultClient(client);
    Databases.setDefaultClient(client);
    Users.setDefaultClient(client);
    Teams.setDefaultClient(client);

    // ==================== Creation Examples ====================

    // Create a table with pure fluent API
    // Note: For Tables, use the generic create method with a CreateTable object
    var createRequest = new org.openmetadata.schema.api.data.CreateTable();
    createRequest.setName("customers");
    createRequest.setDatabaseSchema("mysql.sales.public");
    createRequest.setDescription("Customer data");
    Table table = Tables.create(createRequest);

    // ==================== Retrieval Examples ====================

    // Find and fetch with specific includes
    var foundTable =
        Tables.find(table.getId().toString()).includeOwner().includeTags().includeTags().fetch();

    // Find by name
    var tableByName = Tables.findByName("mysql.sales.public.customers").includeAll().fetch();

    // ==================== Update Examples ====================

    // Update using entity-centric operations
    foundTable.withDescription("Updated customer data").withDisplayName("Customers").save();

    // ==================== Delete Examples ====================

    // Delete with options
    Tables.find(table.getId().toString()).delete().recursively().permanently().confirm();

    // ==================== Listing Examples ====================

    // List with filters and pagination
    Tables.list().limit(50).forEach(t -> System.out.println(t.get().getName()));

    // ==================== Advanced Examples ====================

    // Create database
    var database =
        Databases.create()
            .name("sales")
            .in("mysql_service")
            .withDescription("Sales database")
            .execute();

    // Create user
    var user =
        Users.create()
            .name("john.doe")
            .withEmail("john.doe@example.com")
            .inTeams(UUID.randomUUID())
            .execute();

    // Create team
    var team =
        Teams.create()
            .name("data-team")
            .withDescription("Data engineering team")
            .withUsers(UUID.randomUUID())
            .execute();

    // Work with fluent entity
    var fluentTable = Tables.find("table-id").fetch();

    // Chain multiple operations
    fluentTable.withDescription("New description").withDisplayName("New Display Name").save();

    // Delete from entity
    fluentTable.delete().confirm();
  }
}

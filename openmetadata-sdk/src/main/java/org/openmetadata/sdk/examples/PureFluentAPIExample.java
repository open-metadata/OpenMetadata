package org.openmetadata.sdk.examples;

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
  private static final String SERVER_URL = "http://localhost:8585/api"; // base API URL
  private static final String TOKEN =
      "eyJraWQiOiJHYjM4OWEtOWY3Ni1nZGpzLWE5MmotMDI0MmJrOTQzNTYiLCJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJvcGVuLW1ldGFkYXRhLm9yZyIsInN1YiI6ImFkbWluIiwicm9sZXMiOlsiQWRtaW4iXSwiZW1haWwiOiJhZG1pbkBvcGVuLW1ldGFkYXRhLm9yZyIsImlzQm90IjpmYWxzZSwidG9rZW5UeXBlIjoiUEVSU09OQUxfQUNDRVNTIiwiaWF0IjoxNzU4NzI0OTAxLCJleHAiOjE3NTkzMjk3MDF9.RCvzlKDxNyiQZUrwQy2VO12RotYdH4p-tldZOGZQ1vaCiTsVF4HHRINClp7aoM-bVCfBythmAgEy4xf8aoFmYAKnsIPsOmTTjs_V8eWvbXVWY6SDIUS1NGrECn04U8_ROnyfIc6fi7zS7FhzfWPb8lbkAZr72-8vuVhNij8J38pnHs24671skFyvElkC9ASrhkv3WaSOyd5r-8z1lZGHzg-JLphrbBrnS9TvcxoEM14fwxRaldEQfRKd07tpRnh9ekFrFgqTwZO9h8ZAF4dszbICYuNllDw8h3szEc_IvW-32DQYQOffEa7TTry2VgnZOQ5EGkMrFqYkX4BjJEgRgg";

  public static void main(String[] args) {

    // Initialize client
    OpenMetadataConfig cfg =
        OpenMetadataConfig.builder().serverUrl(SERVER_URL).accessToken(TOKEN).build();
    OpenMetadataClient client = new OpenMetadataClient(cfg);

    // Set default client for all fluent operations
    Tables.setDefaultClient(client);
    Databases.setDefaultClient(client);
    Users.setDefaultClient(client);
    Teams.setDefaultClient(client);

    // ==================== Creation Examples ====================

    // Create a table with pure fluent API
    // Note: For Tables, use the generic create method with a CreateTable object
    var createRequest = new org.openmetadata.schema.api.data.CreateTable();
    createRequest.setName("customers_test8");
    createRequest.setDatabaseSchema("sample_data.ecommerce_db.shopify");
    createRequest.setDescription("Customer data");

    // Add columns (ensure VARCHAR includes dataLength)
    java.util.List<org.openmetadata.schema.type.Column> columns = new java.util.ArrayList<>();

    org.openmetadata.schema.type.Column idCol = new org.openmetadata.schema.type.Column();
    idCol.setName("id");
    idCol.setDataType(org.openmetadata.schema.type.ColumnDataType.BIGINT);
    columns.add(idCol);

    org.openmetadata.schema.type.Column emailCol = new org.openmetadata.schema.type.Column();
    emailCol.setName("email");
    emailCol.setDataType(org.openmetadata.schema.type.ColumnDataType.VARCHAR);
    emailCol.setDataLength(255);
    columns.add(emailCol);

    org.openmetadata.schema.type.Column createdAtCol = new org.openmetadata.schema.type.Column();
    createdAtCol.setName("created_at");
    createdAtCol.setDataType(org.openmetadata.schema.type.ColumnDataType.TIMESTAMP);
    columns.add(createdAtCol);

    createRequest.setColumns(columns);

    Table table = Tables.create(createRequest);

    // ==================== Retrieval Examples ====================

    // Find and fetch with specific includes
    var foundTable =
        Tables.find(table.getId().toString()).includeOwners().includeTags().includeTags().fetch();

    // Find by name
    var tableByName =
        Tables.findByName("sample_data.ecommerce_db.shopify.customers").includeAll().fetch();

    // ==================== Update Examples ====================

    // Update using entity-centric operations
    foundTable.withDescription("Updated customer data").withDisplayName("Customers").save();

    // ==================== Delete Examples ====================

    // Delete with options
    Tables.find(table.getId().toString()).delete().recursively().permanently().confirm();

    // ==================== Listing Examples ====================

    // List with filters and pagination
    // Tables.list().limit(50).forEach(t -> System.out.println(t.get().getName()));

    // ==================== Advanced Examples ====================

    // Create database
    var database =
        Databases.create()
            .name("sales2")
            .in("sample_data")
            .withDescription("Sales database")
            .execute();

    // Create user
    var user = Users.create().name("john.doe1").withEmail("john.doe1@example.com").execute();

    // Create team
    var team =
        Teams.create()
            .name("data-team")
            .withDescription("Data engineering team")
            .withUsers(user.getId())
            .execute();

    // Work with fluent entity
    //    var fluentTable = Tables.find(table.getId().toString()).fetch();

    // Chain multiple operations
    //    fluentTable.withDescription("New description").withDisplayName("New Display Name").save();

    // Delete from entity
    //    fluentTable.delete().confirm();
  }
}

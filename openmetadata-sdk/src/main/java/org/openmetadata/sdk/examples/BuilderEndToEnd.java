package org.openmetadata.sdk.examples;

import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.config.OpenMetadataConfig;

public class BuilderEndToEnd {
  private static final String SERVER_URL = "http://localhost:8585/api"; // base API URL
  private static final String TOKEN =
      "eyJraWQiOiJHYjM4OWEtOWY3Ni1nZGpzLWE5MmotMDI0MmJrOTQzNTYiLCJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJvcGVuLW1ldGFkYXRhLm9yZyIsInN1YiI6ImluZ2VzdGlvbi1ib3QiLCJyb2xlcyI6WyJJbmdlc3Rpb25Cb3RSb2xlIl0sImVtYWlsIjoiaW5nZXN0aW9uLWJvdEBvcGVuLW1ldGFkYXRhLm9yZyIsImlzQm90Ijp0cnVlLCJ0b2tlblR5cGUiOiJCT1QiLCJpYXQiOjE3NTY3MTIxNjMsImV4cCI6bnVsbH0.1l7dMJKPAH-Jj6BSnWsZ9VLvR49GdSk_O5X2hZDvs_fJ1lofTqdZ1g952Q1CtnFtLqvR-1-i0Dulje2M9dBaaqo5LN89PDJFR_GOtRgNSIGBPTnQLdkaUIrO2Lk0TaOJCe5jxrhMkdIEw-YHoFm_g_7hdlCWrunxNyv7TVPCHb9iuizUFcGkTMt7P_vaDe5oWHjNqHU4OofOs27DHVjBtgKcB7Mvm_hX-K0j1_7ll6fqlOoQPGxP82o3EIc_IXDyGV_Y2OkpCilDyT25EW1oGLTNfa5QwbsVZdennXKi--BxYTiJIvOdWwkIJFt72re_CB8DkzplIqH9I2lwoM0knw"; // bearer token or API key

  public static void main(String[] args) {
    OpenMetadataConfig cfg =
        OpenMetadataConfig.builder().serverUrl(SERVER_URL).accessToken(TOKEN).build();
    OpenMetadataClient client = new OpenMetadataClient(cfg);

    /* org.openmetadata.sdk.fluent.Glossaries.setDefaultClient(client);

    org.openmetadata.schema.api.services.CreateDatabaseService svcReq =
        new DatabaseServiceBuilder(client)
            .name("mysql_prod_demo2")
            .connection(
                org.openmetadata.sdk.fluent.DatabaseServices.mysqlConnection()
                    .hostPort("localhost:3306")
                    .username("om_user")
                    .password("om_pass")
                    .database("prod")
                    .build())
            .description("Production MySQL")
            .build();

    DatabaseService service = client.databaseServices().create(svcReq);

    String serviceFqn =
        service.getFullyQualifiedName() != null ? service.getFullyQualifiedName() : service.getName();

    // 2) Create Database via builder (under service)
    org.openmetadata.schema.api.data.CreateDatabase dbReq =
        new DatabaseBuilder(client)
            .name("sales")
            .description("Sales database")
            .serviceFQN(serviceFqn)
            .build();

    Database database = client.databases().create(dbReq);

    String databaseFqn =
        database.getFullyQualifiedName() != null ? database.getFullyQualifiedName() : database.getName();

    // 3) Create Schema via builder (under database)
    org.openmetadata.schema.api.data.CreateDatabaseSchema schemaReq =
        new DatabaseSchemaBuilder(client)
            .name("public")
            .description("Default schema")
            .databaseFQN(databaseFqn)
            .build();

    DatabaseSchema schema = client.databaseSchemas().create(schemaReq);

    String schemaFqn =
        schema.getFullyQualifiedName() != null ? schema.getFullyQualifiedName() : schema.getName();

    // 4) Create Table via builder (under schema)
    org.openmetadata.schema.api.data.CreateTable tableReq =
        new TableBuilder(client)
            .name("customers")
            .description("Customer master table")
            .schemaFQN(schemaFqn)
            .addColumn("id", "BIGINT")
            .column(org.openmetadata.sdk.fluent.builders.ColumnBuilder.varchar("email", 255))
            .tags("PII.Sensitive", "Tier.Tier1")
            .build();

    Table table = client.tables().create(tableReq);

    // 5) Update table description + tags in fluent way
    Table updated =
        new org.openmetadata.sdk.fluent.wrappers.FluentTable(
                client.tables().getByName(table.getFullyQualifiedName()), client)
            .withDescription("Updated description: includes PII columns")
            .addTags("PersonalData.Personal")
            .save();

    System.out.printf("Created/Updated table id=%s, version=%s%n", updated.getId(), updated.getVersion()); */

    // 6) Export/Import Glossary via CSV using fluent API
    String glossaryName = "Business Glossary"; // FQN with space as shown in UI
    try {
      String csv = org.openmetadata.sdk.fluent.Glossaries.exportCsv(glossaryName).toCsv();
      System.out.printf("Exported glossary '%s' CSV length=%d%n", glossaryName, csv.length());

      String dryRun =
          org.openmetadata.sdk.fluent.Glossaries.importCsv(glossaryName)
              .withData(csv)
              .dryRun()
              .execute();
      System.out.println("Glossary dry-run response: " + dryRun);

      String applied =
          org.openmetadata.sdk.fluent.Glossaries.importCsv(glossaryName).withData(csv).execute();
      System.out.println("Glossary import applied: " + applied);

      // Async export example (fluent)
      // Async export with fluent WebSocket support
      java.util.concurrent.CompletableFuture<String> job =
          org.openmetadata.sdk.fluent.Glossaries.exportCsv(glossaryName)
              .async()
              .withWebSocket() // prefer WS; falls back to polling automatically
              .waitForCompletion(30) // wait up to 30s for completion
              .onComplete(
                  result -> {
                    // When waiting, this callback receives the CSV content (or status string)
                    System.out.println(
                        "Async export completed. CSV preview:\n"
                            + result.substring(0, Math.min(result.length(), 200))
                            + (result.length() > 200 ? "..." : ""));
                  })
              .onError(err -> System.out.println("Async export error: " + err.getMessage()))
              .executeAsync();

      // Joining returns the CSV content (or status) when waiting for completion
      String asyncResult = job.join();
      System.out.println("Async export result : " + (asyncResult != null ? asyncResult : ""));
    } catch (Exception e) {
      System.out.println("Glossary export/import skipped or failed: " + e.getMessage());
    }
  }
}

package org.openmetadata.sdk;

import org.openmetadata.sdk.client.OpenMetadataClient;

/**
 * OM (OpenMetadata) - Main entry point for the SDK with pure fluent API.
 *
 * This class provides a convenient wrapper around the pure fluent API classes.
 *
 * Usage:
 * <pre>
 * // Initialize
 * OpenMetadataClient client = new OpenMetadataClient(config);
 * OM.init(client);
 *
 * // Use fluent API through OM
 * Table table = OM.Table.find(id).fetch();
 * Database db = OM.Database.find(id).includeOwners().fetch();
 * </pre>
 */
public class OM {
  private static OpenMetadataClient client;

  public static void init(OpenMetadataClient client) {
    OM.client = client;
    // Initialize all pure fluent API classes
    org.openmetadata.sdk.fluent.Tables.setDefaultClient(client);
    org.openmetadata.sdk.fluent.Databases.setDefaultClient(client);
    org.openmetadata.sdk.fluent.DatabaseSchemas.setDefaultClient(client);
    org.openmetadata.sdk.fluent.Users.setDefaultClient(client);
    org.openmetadata.sdk.fluent.Teams.setDefaultClient(client);
    org.openmetadata.sdk.fluent.Dashboards.setDefaultClient(client);
    org.openmetadata.sdk.fluent.Charts.setDefaultClient(client);
    org.openmetadata.sdk.fluent.DashboardDataModels.setDefaultClient(client);
    org.openmetadata.sdk.fluent.Pipelines.setDefaultClient(client);
    org.openmetadata.sdk.fluent.Topics.setDefaultClient(client);
    org.openmetadata.sdk.fluent.Containers.setDefaultClient(client);
    org.openmetadata.sdk.fluent.MlModels.setDefaultClient(client);
    org.openmetadata.sdk.fluent.Queries.setDefaultClient(client);
    org.openmetadata.sdk.fluent.SearchIndexes.setDefaultClient(client);
    org.openmetadata.sdk.fluent.StoredProcedures.setDefaultClient(client);
    org.openmetadata.sdk.fluent.Glossaries.setDefaultClient(client);
    org.openmetadata.sdk.fluent.GlossaryTerms.setDefaultClient(client);
    org.openmetadata.sdk.fluent.Classifications.setDefaultClient(client);
    org.openmetadata.sdk.fluent.Tags.setDefaultClient(client);
    org.openmetadata.sdk.fluent.DataProducts.setDefaultClient(client);
    org.openmetadata.sdk.fluent.Domains.setDefaultClient(client);
    org.openmetadata.sdk.fluent.Metrics.setDefaultClient(client);
    org.openmetadata.sdk.fluent.TestCases.setDefaultClient(client);

    // Initialize new fluent API classes
    org.openmetadata.sdk.api.Search.setDefaultClient(client);
    org.openmetadata.sdk.api.Lineage.setDefaultClient(client);
    org.openmetadata.sdk.api.Bulk.setDefaultClient(client);

    // Initialize old entity classes that still exist
    org.openmetadata.sdk.entities.DatabaseService.setDefaultClient(client);
    org.openmetadata.sdk.entities.TestCase.setDefaultClient(client);
    org.openmetadata.sdk.entities.SearchIndex.setDefaultClient(client);
  }

  // Wrapper classes that delegate to pure fluent API

  public static class Table {
    public static org.openmetadata.sdk.fluent.Tables.TableFinder find(String id) {
      return org.openmetadata.sdk.fluent.Tables.find(id);
    }

    public static org.openmetadata.sdk.fluent.Tables.TableFinder findByName(String fqn) {
      return org.openmetadata.sdk.fluent.Tables.findByName(fqn);
    }

    public static org.openmetadata.schema.entity.data.Table create(
        org.openmetadata.schema.api.data.CreateTable request) {
      return org.openmetadata.sdk.fluent.Tables.create(request);
    }
  }

  public static class Database {
    public static org.openmetadata.sdk.fluent.Databases.DatabaseFinder find(String id) {
      return org.openmetadata.sdk.fluent.Databases.find(id);
    }

    public static org.openmetadata.sdk.fluent.Databases.DatabaseFinder findByName(String fqn) {
      return org.openmetadata.sdk.fluent.Databases.findByName(fqn);
    }

    public static org.openmetadata.schema.entity.data.Database create(
        org.openmetadata.schema.api.data.CreateDatabase request) {
      return org.openmetadata.sdk.fluent.Databases.create(request);
    }
  }

  public static class DatabaseService {
    // DatabaseService still uses old entity pattern
    public static org.openmetadata.schema.entity.services.DatabaseService create(
        org.openmetadata.schema.api.services.CreateDatabaseService request) {
      return org.openmetadata.sdk.entities.DatabaseService.create(request);
    }

    public static org.openmetadata.sdk.fluent.Databases.DatabaseFinder find(String id) {
      return org.openmetadata.sdk.fluent.Databases.find(id);
    }
  }

  public static class User {
    public static org.openmetadata.sdk.fluent.Users.UserFinder find(String id) {
      return org.openmetadata.sdk.fluent.Users.find(id);
    }

    public static org.openmetadata.sdk.fluent.Users.UserFinder findByName(String fqn) {
      return org.openmetadata.sdk.fluent.Users.findByName(fqn);
    }

    public static org.openmetadata.schema.entity.teams.User create(
        org.openmetadata.schema.api.teams.CreateUser request) {
      return org.openmetadata.sdk.fluent.Users.create(request);
    }
  }

  public static class Team {
    public static org.openmetadata.sdk.fluent.Teams.TeamFinder find(String id) {
      return org.openmetadata.sdk.fluent.Teams.find(id);
    }

    public static org.openmetadata.sdk.fluent.Teams.TeamFinder findByName(String fqn) {
      return org.openmetadata.sdk.fluent.Teams.findByName(fqn);
    }

    public static org.openmetadata.schema.entity.teams.Team create(
        org.openmetadata.schema.api.teams.CreateTeam request) {
      return org.openmetadata.sdk.fluent.Teams.create(request);
    }
  }

  public static class Dashboard {
    public static org.openmetadata.sdk.fluent.Dashboards.DashboardFinder find(String id) {
      return org.openmetadata.sdk.fluent.Dashboards.find(id);
    }

    public static org.openmetadata.sdk.fluent.Dashboards.DashboardFinder findByName(String fqn) {
      return org.openmetadata.sdk.fluent.Dashboards.findByName(fqn);
    }

    public static org.openmetadata.schema.entity.data.Dashboard create(
        org.openmetadata.schema.api.data.CreateDashboard request) {
      return org.openmetadata.sdk.fluent.Dashboards.create(request);
    }
  }

  // Add more wrapper classes as needed for other entities
}

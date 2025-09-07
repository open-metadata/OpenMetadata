package org.openmetadata.sdk;

import org.openmetadata.sdk.client.OpenMetadataClient;

/**
 * Central entry point for OpenMetadata SDK operations.
 * Provides a clean API for all entity operations.
 *
 * <pre>
 * // Initialize once
 * OM.init(client);
 *
 * // Create
 * Table table = OM.Table.create(createTableRequest);
 *
 * // Retrieve
 * Table table = OM.Table.retrieve(id);
 *
 * // Update
 * Table updated = OM.Table.update(table);
 *
 * // Delete
 * OM.Table.delete(id);
 * </pre>
 */
public class OM {
  private static OpenMetadataClient client;

  public static void init(OpenMetadataClient client) {
    OM.client = client;
    // Initialize only the core entity classes that support setDefaultClient
    org.openmetadata.sdk.entities.Table.setDefaultClient(client);
    org.openmetadata.sdk.entities.Database.setDefaultClient(client);
    org.openmetadata.sdk.entities.DatabaseSchema.setDefaultClient(client);
    org.openmetadata.sdk.entities.User.setDefaultClient(client);
    org.openmetadata.sdk.entities.Team.setDefaultClient(client);
    org.openmetadata.sdk.entities.Dashboard.setDefaultClient(client);
    org.openmetadata.sdk.entities.Chart.setDefaultClient(client);
    org.openmetadata.sdk.entities.DashboardDataModel.setDefaultClient(client);
    org.openmetadata.sdk.entities.Pipeline.setDefaultClient(client);
    org.openmetadata.sdk.entities.Topic.setDefaultClient(client);
    org.openmetadata.sdk.entities.Container.setDefaultClient(client);
    org.openmetadata.sdk.entities.MlModel.setDefaultClient(client);
    org.openmetadata.sdk.entities.Query.setDefaultClient(client);

    // Initialize service classes
    org.openmetadata.sdk.entities.DatabaseService.setDefaultClient(client);
    org.openmetadata.sdk.entities.DashboardService.setDefaultClient(client);
    org.openmetadata.sdk.entities.MessagingService.setDefaultClient(client);
    org.openmetadata.sdk.entities.MlModelService.setDefaultClient(client);
    org.openmetadata.sdk.entities.PipelineService.setDefaultClient(client);
    org.openmetadata.sdk.entities.StorageService.setDefaultClient(client);

    // Initialize classification and glossary classes
    org.openmetadata.sdk.entities.Classification.setDefaultClient(client);
    org.openmetadata.sdk.entities.Tag.setDefaultClient(client);
    org.openmetadata.sdk.entities.Glossary.setDefaultClient(client);
    org.openmetadata.sdk.entities.GlossaryTerm.setDefaultClient(client);
  }

  // Core Data Assets
  public static class Table {
    public static org.openmetadata.schema.entity.data.Table create(
        org.openmetadata.schema.api.data.CreateTable request) {
      return org.openmetadata.sdk.entities.Table.create(request);
    }

    public static org.openmetadata.schema.entity.data.Table retrieve(String id) {
      return org.openmetadata.sdk.entities.Table.retrieve(id);
    }

    public static org.openmetadata.schema.entity.data.Table retrieve(String id, String fields) {
      return org.openmetadata.sdk.entities.Table.retrieve(id, fields);
    }

    public static org.openmetadata.schema.entity.data.Table retrieveByName(
        String fullyQualifiedName) {
      return org.openmetadata.sdk.entities.Table.retrieveByName(fullyQualifiedName);
    }

    public static org.openmetadata.schema.entity.data.Table update(
        org.openmetadata.schema.entity.data.Table table) {
      return org.openmetadata.sdk.entities.Table.update(table);
    }

    public static void delete(String id) {
      org.openmetadata.sdk.entities.Table.delete(id);
    }
  }

  public static class Database {
    public static org.openmetadata.schema.entity.data.Database create(
        org.openmetadata.schema.api.data.CreateDatabase request) {
      return org.openmetadata.sdk.entities.Database.create(request);
    }

    public static org.openmetadata.schema.entity.data.Database retrieve(String id) {
      return org.openmetadata.sdk.entities.Database.retrieve(id);
    }

    public static org.openmetadata.schema.entity.data.Database retrieve(String id, String fields) {
      return org.openmetadata.sdk.entities.Database.retrieve(id, fields);
    }

    public static org.openmetadata.schema.entity.data.Database retrieveByName(
        String fullyQualifiedName) {
      return org.openmetadata.sdk.entities.Database.retrieveByName(fullyQualifiedName);
    }

    public static org.openmetadata.schema.entity.data.Database update(
        org.openmetadata.schema.entity.data.Database database) {
      return org.openmetadata.sdk.entities.Database.update(database);
    }

    public static void delete(String id) {
      org.openmetadata.sdk.entities.Database.delete(id);
    }
  }

  public static class DatabaseSchema {
    public static org.openmetadata.schema.entity.data.DatabaseSchema create(
        org.openmetadata.schema.api.data.CreateDatabaseSchema request) {
      return org.openmetadata.sdk.entities.DatabaseSchema.create(request);
    }

    public static org.openmetadata.schema.entity.data.DatabaseSchema retrieve(String id) {
      return org.openmetadata.sdk.entities.DatabaseSchema.retrieve(id);
    }

    public static org.openmetadata.schema.entity.data.DatabaseSchema retrieve(
        String id, String fields) {
      return org.openmetadata.sdk.entities.DatabaseSchema.retrieve(id, fields);
    }

    public static org.openmetadata.schema.entity.data.DatabaseSchema retrieveByName(String fqn) {
      return org.openmetadata.sdk.entities.DatabaseSchema.retrieveByName(fqn);
    }

    public static org.openmetadata.schema.entity.data.DatabaseSchema update(
        org.openmetadata.schema.entity.data.DatabaseSchema schema) {
      if (schema.getId() == null) {
        throw new IllegalArgumentException("DatabaseSchema must have an ID for update");
      }
      return org.openmetadata.sdk.entities.DatabaseSchema.update(schema.getId().toString(), schema);
    }

    public static void delete(String id) {
      org.openmetadata.sdk.entities.DatabaseSchema.delete(id);
    }
  }

  // Teams & Users
  public static class User {
    public static org.openmetadata.schema.entity.teams.User create(
        org.openmetadata.schema.api.teams.CreateUser request) {
      return org.openmetadata.sdk.entities.User.create(request);
    }

    public static org.openmetadata.schema.entity.teams.User retrieve(String id) {
      return org.openmetadata.sdk.entities.User.retrieve(id);
    }

    public static org.openmetadata.schema.entity.teams.User retrieve(String id, String fields) {
      return org.openmetadata.sdk.entities.User.retrieve(id, fields);
    }

    public static org.openmetadata.schema.entity.teams.User retrieveByName(String name) {
      return org.openmetadata.sdk.entities.User.retrieveByName(name);
    }

    public static org.openmetadata.schema.entity.teams.User update(
        org.openmetadata.schema.entity.teams.User user) {
      if (user.getId() == null) {
        throw new IllegalArgumentException("User must have an ID for update");
      }
      return org.openmetadata.sdk.entities.User.update(user.getId().toString(), user);
    }

    public static void delete(String id) {
      org.openmetadata.sdk.entities.User.delete(id);
    }
  }

  public static class Team {
    public static org.openmetadata.schema.entity.teams.Team create(
        org.openmetadata.schema.api.teams.CreateTeam request) {
      return org.openmetadata.sdk.entities.Team.create(request);
    }

    public static org.openmetadata.schema.entity.teams.Team retrieve(String id) {
      return org.openmetadata.sdk.entities.Team.retrieve(id);
    }

    public static org.openmetadata.schema.entity.teams.Team retrieve(String id, String fields) {
      return org.openmetadata.sdk.entities.Team.retrieve(id, fields);
    }

    public static org.openmetadata.schema.entity.teams.Team retrieveByName(String name) {
      return org.openmetadata.sdk.entities.Team.retrieveByName(name);
    }

    public static org.openmetadata.schema.entity.teams.Team update(
        org.openmetadata.schema.entity.teams.Team team) {
      if (team.getId() == null) {
        throw new IllegalArgumentException("Team must have an ID for update");
      }
      return org.openmetadata.sdk.entities.Team.update(team.getId().toString(), team);
    }

    public static void delete(String id) {
      org.openmetadata.sdk.entities.Team.delete(id);
    }
  }

  // Analytics Assets
  public static class Dashboard {
    public static org.openmetadata.schema.entity.data.Dashboard create(
        org.openmetadata.schema.api.data.CreateDashboard request) {
      return org.openmetadata.sdk.entities.Dashboard.create(request);
    }

    public static org.openmetadata.schema.entity.data.Dashboard retrieve(String id) {
      return org.openmetadata.sdk.entities.Dashboard.retrieve(id);
    }

    public static org.openmetadata.schema.entity.data.Dashboard retrieve(String id, String fields) {
      return org.openmetadata.sdk.entities.Dashboard.retrieve(id, fields);
    }

    public static org.openmetadata.schema.entity.data.Dashboard retrieveByName(String fqn) {
      return org.openmetadata.sdk.entities.Dashboard.retrieveByName(fqn);
    }

    public static org.openmetadata.schema.entity.data.Dashboard update(
        org.openmetadata.schema.entity.data.Dashboard dashboard) {
      if (dashboard.getId() == null) {
        throw new IllegalArgumentException("Dashboard must have an ID for update");
      }
      return org.openmetadata.sdk.entities.Dashboard.update(
          dashboard.getId().toString(), dashboard);
    }

    public static void delete(String id) {
      org.openmetadata.sdk.entities.Dashboard.delete(id);
    }
  }

  public static class Chart {
    public static org.openmetadata.schema.entity.data.Chart create(
        org.openmetadata.schema.api.data.CreateChart request) {
      return org.openmetadata.sdk.entities.Chart.create(request);
    }

    public static org.openmetadata.schema.entity.data.Chart retrieve(String id) {
      return org.openmetadata.sdk.entities.Chart.retrieve(id);
    }

    public static org.openmetadata.schema.entity.data.Chart retrieve(String id, String fields) {
      return org.openmetadata.sdk.entities.Chart.retrieve(id, fields);
    }

    public static org.openmetadata.schema.entity.data.Chart retrieveByName(
        String fullyQualifiedName) {
      return org.openmetadata.sdk.entities.Chart.retrieveByName(fullyQualifiedName);
    }

    public static org.openmetadata.schema.entity.data.Chart update(
        org.openmetadata.schema.entity.data.Chart chart) {
      return org.openmetadata.sdk.entities.Chart.update(chart);
    }

    public static void delete(String id) {
      org.openmetadata.sdk.entities.Chart.delete(id);
    }
  }

  public static class DashboardDataModel {
    public static org.openmetadata.schema.entity.data.DashboardDataModel create(
        org.openmetadata.schema.api.data.CreateDashboardDataModel request) {
      return org.openmetadata.sdk.entities.DashboardDataModel.create(request);
    }

    public static org.openmetadata.schema.entity.data.DashboardDataModel retrieve(String id) {
      return org.openmetadata.sdk.entities.DashboardDataModel.retrieve(id);
    }

    public static org.openmetadata.schema.entity.data.DashboardDataModel retrieve(
        String id, String fields) {
      return org.openmetadata.sdk.entities.DashboardDataModel.retrieve(id, fields);
    }

    public static org.openmetadata.schema.entity.data.DashboardDataModel retrieveByName(
        String fullyQualifiedName) {
      return org.openmetadata.sdk.entities.DashboardDataModel.retrieveByName(fullyQualifiedName);
    }

    public static org.openmetadata.schema.entity.data.DashboardDataModel update(
        org.openmetadata.schema.entity.data.DashboardDataModel dataModel) {
      return org.openmetadata.sdk.entities.DashboardDataModel.update(dataModel);
    }

    public static void delete(String id) {
      org.openmetadata.sdk.entities.DashboardDataModel.delete(id);
    }
  }

  // Data Processing
  public static class Pipeline {
    public static org.openmetadata.schema.entity.data.Pipeline create(
        org.openmetadata.schema.api.data.CreatePipeline request) {
      return org.openmetadata.sdk.entities.Pipeline.create(request);
    }

    public static org.openmetadata.schema.entity.data.Pipeline retrieve(String id) {
      return org.openmetadata.sdk.entities.Pipeline.retrieve(id);
    }

    public static org.openmetadata.schema.entity.data.Pipeline retrieve(String id, String fields) {
      return org.openmetadata.sdk.entities.Pipeline.retrieve(id, fields);
    }

    public static org.openmetadata.schema.entity.data.Pipeline retrieveByName(String fqn) {
      return org.openmetadata.sdk.entities.Pipeline.retrieveByName(fqn);
    }

    public static org.openmetadata.schema.entity.data.Pipeline update(
        org.openmetadata.schema.entity.data.Pipeline pipeline) {
      if (pipeline.getId() == null) {
        throw new IllegalArgumentException("Pipeline must have an ID for update");
      }
      return org.openmetadata.sdk.entities.Pipeline.update(pipeline.getId().toString(), pipeline);
    }

    public static void delete(String id) {
      org.openmetadata.sdk.entities.Pipeline.delete(id);
    }
  }

  // Messaging
  public static class Topic {
    public static org.openmetadata.schema.entity.data.Topic create(
        org.openmetadata.schema.api.data.CreateTopic request) {
      return org.openmetadata.sdk.entities.Topic.create(request);
    }

    public static org.openmetadata.schema.entity.data.Topic retrieve(String id) {
      return org.openmetadata.sdk.entities.Topic.retrieve(id);
    }

    public static org.openmetadata.schema.entity.data.Topic retrieve(String id, String fields) {
      return org.openmetadata.sdk.entities.Topic.retrieve(id, fields);
    }

    public static org.openmetadata.schema.entity.data.Topic retrieveByName(String fqn) {
      return org.openmetadata.sdk.entities.Topic.retrieveByName(fqn);
    }

    public static org.openmetadata.schema.entity.data.Topic update(
        org.openmetadata.schema.entity.data.Topic topic) {
      if (topic.getId() == null) {
        throw new IllegalArgumentException("Topic must have an ID for update");
      }
      return org.openmetadata.sdk.entities.Topic.update(topic.getId().toString(), topic);
    }

    public static void delete(String id) {
      org.openmetadata.sdk.entities.Topic.delete(id);
    }
  }

  // Storage
  public static class Container {
    public static org.openmetadata.schema.entity.data.Container create(
        org.openmetadata.schema.api.data.CreateContainer request) {
      return org.openmetadata.sdk.entities.Container.create(request);
    }

    public static org.openmetadata.schema.entity.data.Container retrieve(String id) {
      return org.openmetadata.sdk.entities.Container.retrieve(id);
    }

    public static org.openmetadata.schema.entity.data.Container retrieve(String id, String fields) {
      return org.openmetadata.sdk.entities.Container.retrieve(id, fields);
    }

    public static org.openmetadata.schema.entity.data.Container retrieveByName(String fqn) {
      return org.openmetadata.sdk.entities.Container.retrieveByName(fqn);
    }

    public static org.openmetadata.schema.entity.data.Container update(
        org.openmetadata.schema.entity.data.Container container) {
      if (container.getId() == null) {
        throw new IllegalArgumentException("Container must have an ID for update");
      }
      return org.openmetadata.sdk.entities.Container.update(
          container.getId().toString(), container);
    }

    public static void delete(String id) {
      org.openmetadata.sdk.entities.Container.delete(id);
    }
  }

  // ML
  public static class MlModel {
    public static org.openmetadata.schema.entity.data.MlModel create(
        org.openmetadata.schema.api.data.CreateMlModel request) {
      return org.openmetadata.sdk.entities.MlModel.create(request);
    }

    public static org.openmetadata.schema.entity.data.MlModel retrieve(String id) {
      return org.openmetadata.sdk.entities.MlModel.retrieve(id);
    }

    public static org.openmetadata.schema.entity.data.MlModel retrieve(String id, String fields) {
      return org.openmetadata.sdk.entities.MlModel.retrieve(id, fields);
    }

    public static org.openmetadata.schema.entity.data.MlModel retrieveByName(String fqn) {
      return org.openmetadata.sdk.entities.MlModel.retrieveByName(fqn);
    }

    public static org.openmetadata.schema.entity.data.MlModel update(
        org.openmetadata.schema.entity.data.MlModel model) {
      if (model.getId() == null) {
        throw new IllegalArgumentException("MlModel must have an ID for update");
      }
      return org.openmetadata.sdk.entities.MlModel.update(model.getId().toString(), model);
    }

    public static void delete(String id) {
      org.openmetadata.sdk.entities.MlModel.delete(id);
    }
  }

  // Query
  public static class Query {
    public static org.openmetadata.schema.entity.data.Query create(
        org.openmetadata.schema.api.data.CreateQuery request) {
      return org.openmetadata.sdk.entities.Query.create(request);
    }

    public static org.openmetadata.schema.entity.data.Query retrieve(String id) {
      return org.openmetadata.sdk.entities.Query.retrieve(id);
    }

    public static org.openmetadata.schema.entity.data.Query retrieve(String id, String fields) {
      return org.openmetadata.sdk.entities.Query.retrieve(id, fields);
    }

    public static org.openmetadata.schema.entity.data.Query retrieveByName(String name) {
      return org.openmetadata.sdk.entities.Query.retrieveByName(name);
    }

    public static org.openmetadata.schema.entity.data.Query update(
        org.openmetadata.schema.entity.data.Query query) {
      if (query.getId() == null) {
        throw new IllegalArgumentException("Query must have an ID for update");
      }
      return org.openmetadata.sdk.entities.Query.update(query.getId().toString(), query);
    }

    public static void delete(String id) {
      org.openmetadata.sdk.entities.Query.delete(id);
    }
  }

  // Services - Core service types needed for entity creation
  public static class DatabaseService {
    public static org.openmetadata.schema.entity.services.DatabaseService create(
        org.openmetadata.schema.api.services.CreateDatabaseService request) {
      return org.openmetadata.sdk.entities.DatabaseService.create(request);
    }

    public static org.openmetadata.schema.entity.services.DatabaseService retrieve(String id) {
      return org.openmetadata.sdk.entities.DatabaseService.retrieve(id);
    }

    public static org.openmetadata.schema.entity.services.DatabaseService retrieveByName(
        String name) {
      return org.openmetadata.sdk.entities.DatabaseService.retrieveByName(name);
    }

    public static org.openmetadata.schema.entity.services.DatabaseService update(
        org.openmetadata.schema.entity.services.DatabaseService service) {
      return org.openmetadata.sdk.entities.DatabaseService.update(service);
    }

    public static void delete(String id) {
      org.openmetadata.sdk.entities.DatabaseService.delete(id);
    }
  }

  public static class DashboardService {
    public static org.openmetadata.schema.entity.services.DashboardService create(
        org.openmetadata.schema.api.services.CreateDashboardService request) {
      return org.openmetadata.sdk.entities.DashboardService.create(request);
    }

    public static org.openmetadata.schema.entity.services.DashboardService retrieve(String id) {
      return org.openmetadata.sdk.entities.DashboardService.retrieve(id);
    }

    public static org.openmetadata.schema.entity.services.DashboardService retrieveByName(
        String name) {
      return org.openmetadata.sdk.entities.DashboardService.retrieveByName(name);
    }

    public static org.openmetadata.schema.entity.services.DashboardService update(
        org.openmetadata.schema.entity.services.DashboardService service) {
      return org.openmetadata.sdk.entities.DashboardService.update(service);
    }

    public static void delete(String id) {
      org.openmetadata.sdk.entities.DashboardService.delete(id);
    }
  }

  public static class MessagingService {
    public static org.openmetadata.schema.entity.services.MessagingService create(
        org.openmetadata.schema.api.services.CreateMessagingService request) {
      return org.openmetadata.sdk.entities.MessagingService.create(request);
    }

    public static org.openmetadata.schema.entity.services.MessagingService retrieve(String id) {
      return org.openmetadata.sdk.entities.MessagingService.retrieve(id);
    }

    public static org.openmetadata.schema.entity.services.MessagingService retrieveByName(
        String name) {
      return org.openmetadata.sdk.entities.MessagingService.retrieveByName(name);
    }

    public static org.openmetadata.schema.entity.services.MessagingService update(
        org.openmetadata.schema.entity.services.MessagingService service) {
      return org.openmetadata.sdk.entities.MessagingService.update(service);
    }

    public static void delete(String id) {
      org.openmetadata.sdk.entities.MessagingService.delete(id);
    }
  }

  public static class MlModelService {
    public static org.openmetadata.schema.entity.services.MlModelService create(
        org.openmetadata.schema.api.services.CreateMlModelService request) {
      return org.openmetadata.sdk.entities.MlModelService.create(request);
    }

    public static org.openmetadata.schema.entity.services.MlModelService retrieve(String id) {
      return org.openmetadata.sdk.entities.MlModelService.retrieve(id);
    }

    public static org.openmetadata.schema.entity.services.MlModelService retrieveByName(
        String name) {
      return org.openmetadata.sdk.entities.MlModelService.retrieveByName(name);
    }

    public static org.openmetadata.schema.entity.services.MlModelService update(
        org.openmetadata.schema.entity.services.MlModelService service) {
      return org.openmetadata.sdk.entities.MlModelService.update(service);
    }

    public static void delete(String id) {
      org.openmetadata.sdk.entities.MlModelService.delete(id);
    }
  }

  public static class PipelineService {
    public static org.openmetadata.schema.entity.services.PipelineService create(
        org.openmetadata.schema.api.services.CreatePipelineService request) {
      return org.openmetadata.sdk.entities.PipelineService.create(request);
    }

    public static org.openmetadata.schema.entity.services.PipelineService retrieve(String id) {
      return org.openmetadata.sdk.entities.PipelineService.retrieve(id);
    }

    public static org.openmetadata.schema.entity.services.PipelineService retrieveByName(
        String name) {
      return org.openmetadata.sdk.entities.PipelineService.retrieveByName(name);
    }

    public static org.openmetadata.schema.entity.services.PipelineService update(
        org.openmetadata.schema.entity.services.PipelineService service) {
      return org.openmetadata.sdk.entities.PipelineService.update(service);
    }

    public static void delete(String id) {
      org.openmetadata.sdk.entities.PipelineService.delete(id);
    }
  }

  public static class StorageService {
    public static org.openmetadata.schema.entity.services.StorageService create(
        org.openmetadata.schema.api.services.CreateStorageService request) {
      return org.openmetadata.sdk.entities.StorageService.create(request);
    }

    public static org.openmetadata.schema.entity.services.StorageService retrieve(String id) {
      return org.openmetadata.sdk.entities.StorageService.retrieve(id);
    }

    public static org.openmetadata.schema.entity.services.StorageService retrieveByName(
        String name) {
      return org.openmetadata.sdk.entities.StorageService.retrieveByName(name);
    }

    public static org.openmetadata.schema.entity.services.StorageService update(
        org.openmetadata.schema.entity.services.StorageService service) {
      return org.openmetadata.sdk.entities.StorageService.update(service);
    }

    public static void delete(String id) {
      org.openmetadata.sdk.entities.StorageService.delete(id);
    }
  }

  // Classification and Tags
  public static class Classification {
    public static org.openmetadata.schema.entity.classification.Classification create(
        org.openmetadata.schema.api.classification.CreateClassification request) {
      return org.openmetadata.sdk.entities.Classification.create(request);
    }

    public static org.openmetadata.schema.entity.classification.Classification retrieve(String id) {
      return org.openmetadata.sdk.entities.Classification.retrieve(id);
    }

    public static org.openmetadata.schema.entity.classification.Classification retrieveByName(
        String name) {
      return org.openmetadata.sdk.entities.Classification.retrieveByName(name);
    }

    public static org.openmetadata.schema.entity.classification.Classification update(
        org.openmetadata.schema.entity.classification.Classification classification) {
      return org.openmetadata.sdk.entities.Classification.update(classification);
    }

    public static void delete(String id) {
      org.openmetadata.sdk.entities.Classification.delete(id);
    }
  }

  public static class Tag {
    public static org.openmetadata.schema.entity.classification.Tag create(
        org.openmetadata.schema.api.classification.CreateTag request) {
      return org.openmetadata.sdk.entities.Tag.create(request);
    }

    public static org.openmetadata.schema.entity.classification.Tag retrieve(String id) {
      return org.openmetadata.sdk.entities.Tag.retrieve(id);
    }

    public static org.openmetadata.schema.entity.classification.Tag retrieveByName(String name) {
      return org.openmetadata.sdk.entities.Tag.retrieveByName(name);
    }

    public static org.openmetadata.schema.entity.classification.Tag update(
        org.openmetadata.schema.entity.classification.Tag tag) {
      return org.openmetadata.sdk.entities.Tag.update(tag);
    }

    public static void delete(String id) {
      org.openmetadata.sdk.entities.Tag.delete(id);
    }
  }

  // Glossary
  public static class Glossary {
    public static org.openmetadata.schema.entity.data.Glossary create(
        org.openmetadata.schema.api.data.CreateGlossary request) {
      return org.openmetadata.sdk.entities.Glossary.create(request);
    }

    public static org.openmetadata.schema.entity.data.Glossary retrieve(String id) {
      return org.openmetadata.sdk.entities.Glossary.retrieve(id);
    }

    public static org.openmetadata.schema.entity.data.Glossary retrieveByName(String name) {
      return org.openmetadata.sdk.entities.Glossary.retrieveByName(name);
    }

    public static org.openmetadata.schema.entity.data.Glossary update(
        org.openmetadata.schema.entity.data.Glossary glossary) {
      return org.openmetadata.sdk.entities.Glossary.update(glossary);
    }

    public static void delete(String id) {
      org.openmetadata.sdk.entities.Glossary.delete(id);
    }
  }

  public static class GlossaryTerm {
    public static org.openmetadata.schema.entity.data.GlossaryTerm create(
        org.openmetadata.schema.api.data.CreateGlossaryTerm request) {
      return org.openmetadata.sdk.entities.GlossaryTerm.create(request);
    }

    public static org.openmetadata.schema.entity.data.GlossaryTerm retrieve(String id) {
      return org.openmetadata.sdk.entities.GlossaryTerm.retrieve(id);
    }

    public static org.openmetadata.schema.entity.data.GlossaryTerm retrieveByName(String name) {
      return org.openmetadata.sdk.entities.GlossaryTerm.retrieveByName(name);
    }

    public static org.openmetadata.schema.entity.data.GlossaryTerm update(
        org.openmetadata.schema.entity.data.GlossaryTerm term) {
      return org.openmetadata.sdk.entities.GlossaryTerm.update(term);
    }

    public static void delete(String id) {
      org.openmetadata.sdk.entities.GlossaryTerm.delete(id);
    }
  }
}

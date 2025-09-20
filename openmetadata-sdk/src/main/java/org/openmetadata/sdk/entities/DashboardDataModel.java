package org.openmetadata.sdk.entities;

import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.CompletableFuture;
import org.openmetadata.schema.api.data.CreateDashboardDataModel;
import org.openmetadata.sdk.client.OpenMetadataClient;

/**
 * SDK wrapper for DashboardDataModel operations.
 * This class provides static methods for DashboardDataModel CRUD operations.
 */
public class DashboardDataModel {
  private static OpenMetadataClient defaultClient;

  public static void setDefaultClient(OpenMetadataClient client) {
    defaultClient = client;
  }

  private static OpenMetadataClient getClient() {
    if (defaultClient == null) {
      throw new IllegalStateException("Default client not set. Call setDefaultClient() first.");
    }
    return defaultClient;
  }

  // Static CRUD methods
  public static org.openmetadata.schema.entity.data.DashboardDataModel create(
      CreateDashboardDataModel request) {
    // Convert CreateDashboardDataModel to DashboardDataModel entity
    org.openmetadata.schema.entity.data.DashboardDataModel dataModel =
        new org.openmetadata.schema.entity.data.DashboardDataModel();
    dataModel.setName(request.getName());
    if (request.getDisplayName() != null) {
      dataModel.setDisplayName(request.getDisplayName());
    }
    if (request.getDescription() != null) {
      dataModel.setDescription(request.getDescription());
    }
    if (request.getOwners() != null) {
      dataModel.setOwners(request.getOwners());
    }
    if (request.getTags() != null) {
      dataModel.setTags(request.getTags());
    }
    if (request.getService() != null) {
      dataModel.setService(
          new org.openmetadata.schema.type.EntityReference()
              .withFullyQualifiedName(request.getService())
              .withType("dashboardService"));
    }
    if (request.getDataModelType() != null) {
      dataModel.setDataModelType(request.getDataModelType());
    }
    return getClient().dashboardDataModels().create(dataModel);
  }

  public static org.openmetadata.schema.entity.data.DashboardDataModel retrieve(String id) {
    return getClient().dashboardDataModels().get(id);
  }

  public static org.openmetadata.schema.entity.data.DashboardDataModel retrieve(
      String id, String fields) {
    return getClient().dashboardDataModels().get(id, fields);
  }

  public static org.openmetadata.schema.entity.data.DashboardDataModel retrieveByName(String name) {
    return getClient().dashboardDataModels().getByName(name);
  }

  public static org.openmetadata.schema.entity.data.DashboardDataModel retrieveByName(
      String name, String fields) {
    return getClient().dashboardDataModels().getByName(name, fields);
  }

  public static org.openmetadata.schema.entity.data.DashboardDataModel update(
      String id, org.openmetadata.schema.entity.data.DashboardDataModel entity) {
    return getClient().dashboardDataModels().update(id, entity);
  }

  public static org.openmetadata.schema.entity.data.DashboardDataModel update(
      org.openmetadata.schema.entity.data.DashboardDataModel entity) {
    if (entity.getId() == null) {
      throw new IllegalArgumentException("DashboardDataModel must have an ID for update");
    }
    return update(entity.getId().toString(), entity);
  }

  public static void delete(String id) {
    delete(id, false, false);
  }

  public static void delete(String id, boolean recursive, boolean hardDelete) {
    Map<String, String> params = new HashMap<>();
    params.put("recursive", String.valueOf(recursive));
    params.put("hardDelete", String.valueOf(hardDelete));
    getClient().dashboardDataModels().delete(id, params);
  }

  // Async operations
  public static CompletableFuture<org.openmetadata.schema.entity.data.DashboardDataModel>
      createAsync(CreateDashboardDataModel request) {
    return CompletableFuture.supplyAsync(() -> create(request));
  }

  public static CompletableFuture<org.openmetadata.schema.entity.data.DashboardDataModel>
      retrieveAsync(String id) {
    return CompletableFuture.supplyAsync(() -> retrieve(id));
  }

  public static CompletableFuture<Void> deleteAsync(
      String id, boolean recursive, boolean hardDelete) {
    return CompletableFuture.runAsync(() -> delete(id, recursive, hardDelete));
  }
}

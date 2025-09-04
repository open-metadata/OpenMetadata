package org.openmetadata.sdk.api;

import java.util.List;
import java.util.Map;
import java.util.concurrent.CompletableFuture;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.exceptions.OpenMetadataException;

/**
 * Static fluent API for bulk operations.
 * Usage: Bulk.importCsv("table", csvData)
 */
public class Bulk {
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

  // Bulk import CSV
  public static String importCsv(String entityType, String csvData) throws OpenMetadataException {
    return getClient().bulk().importCsv(entityType, csvData, false);
  }

  public static String importCsv(String entityType, String csvData, boolean dryRun)
      throws OpenMetadataException {
    return getClient().bulk().importCsv(entityType, csvData, dryRun);
  }

  // Bulk export CSV
  public static String exportCsv(String entityType) throws OpenMetadataException {
    return getClient().bulk().exportCsv(entityType);
  }

  public static String exportCsv(String entityType, String name) throws OpenMetadataException {
    return getClient().bulk().exportCsv(entityType, name);
  }

  // Bulk add assets
  public static String addAssets(String entityType, List<Map<String, Object>> assets)
      throws OpenMetadataException {
    return getClient().bulk().addAssets(entityType, assets);
  }

  // Bulk patch
  public static String patch(String entityType, List<Map<String, Object>> patches)
      throws OpenMetadataException {
    return getClient().bulk().patch(entityType, patches);
  }

  // Bulk delete
  public static String delete(String entityType, List<String> ids) throws OpenMetadataException {
    return getClient().bulk().delete(entityType, ids);
  }

  public static String delete(String entityType, List<String> ids, boolean hardDelete)
      throws OpenMetadataException {
    return getClient().bulk().delete(entityType, ids, hardDelete);
  }

  // Bulk restore
  public static String restore(String entityType, List<String> ids)
      throws OpenMetadataException {
    return getClient().bulk().restore(entityType, ids);
  }

  // Async operations
  public static CompletableFuture<String> importCsvAsync(String entityType, String csvData) {
    return CompletableFuture.supplyAsync(() -> {
      try {
        return importCsv(entityType, csvData);
      } catch (OpenMetadataException e) {
        throw new RuntimeException(e);
      }
    });
  }

  public static CompletableFuture<String> importCsvAsync(
      String entityType, String csvData, boolean dryRun) {
    return CompletableFuture.supplyAsync(() -> {
      try {
        return importCsv(entityType, csvData, dryRun);
      } catch (OpenMetadataException e) {
        throw new RuntimeException(e);
      }
    });
  }

  public static CompletableFuture<String> exportCsvAsync(String entityType) {
    return CompletableFuture.supplyAsync(() -> {
      try {
        return exportCsv(entityType);
      } catch (OpenMetadataException e) {
        throw new RuntimeException(e);
      }
    });
  }

  public static CompletableFuture<String> exportCsvAsync(String entityType, String name) {
    return CompletableFuture.supplyAsync(() -> {
      try {
        return exportCsv(entityType, name);
      } catch (OpenMetadataException e) {
        throw new RuntimeException(e);
      }
    });
  }

  public static CompletableFuture<String> addAssetsAsync(
      String entityType, List<Map<String, Object>> assets) {
    return CompletableFuture.supplyAsync(() -> {
      try {
        return addAssets(entityType, assets);
      } catch (OpenMetadataException e) {
        throw new RuntimeException(e);
      }
    });
  }

  public static CompletableFuture<String> patchAsync(
      String entityType, List<Map<String, Object>> patches) {
    return CompletableFuture.supplyAsync(() -> {
      try {
        return patch(entityType, patches);
      } catch (OpenMetadataException e) {
        throw new RuntimeException(e);
      }
    });
  }

  public static CompletableFuture<String> deleteAsync(String entityType, List<String> ids) {
    return CompletableFuture.supplyAsync(() -> {
      try {
        return delete(entityType, ids);
      } catch (OpenMetadataException e) {
        throw new RuntimeException(e);
      }
    });
  }

  public static CompletableFuture<String> deleteAsync(
      String entityType, List<String> ids, boolean hardDelete) {
    return CompletableFuture.supplyAsync(() -> {
      try {
        return delete(entityType, ids, hardDelete);
      } catch (OpenMetadataException e) {
        throw new RuntimeException(e);
      }
    });
  }

  public static CompletableFuture<String> restoreAsync(String entityType, List<String> ids) {
    return CompletableFuture.supplyAsync(() -> {
      try {
        return restore(entityType, ids);
      } catch (OpenMetadataException e) {
        throw new RuntimeException(e);
      }
    });
  }

  // Builder for bulk operations
  public static BulkBuilder builder() {
    return new BulkBuilder();
  }

  public static class BulkBuilder {
    private String entityType;
    private String csvData;
    private boolean dryRun = false;
    private List<Map<String, Object>> assets;
    private List<Map<String, Object>> patches;
    private List<String> ids;
    private boolean hardDelete = false;
    private OperationType operationType;

    public enum OperationType {
      IMPORT_CSV,
      EXPORT_CSV,
      ADD_ASSETS,
      PATCH,
      DELETE,
      RESTORE
    }

    public BulkBuilder entityType(String entityType) {
      this.entityType = entityType;
      return this;
    }

    public BulkBuilder csvData(String csvData) {
      this.csvData = csvData;
      this.operationType = OperationType.IMPORT_CSV;
      return this;
    }

    public BulkBuilder dryRun(boolean dryRun) {
      this.dryRun = dryRun;
      return this;
    }

    public BulkBuilder assets(List<Map<String, Object>> assets) {
      this.assets = assets;
      this.operationType = OperationType.ADD_ASSETS;
      return this;
    }

    public BulkBuilder patches(List<Map<String, Object>> patches) {
      this.patches = patches;
      this.operationType = OperationType.PATCH;
      return this;
    }

    public BulkBuilder ids(List<String> ids) {
      this.ids = ids;
      return this;
    }

    public BulkBuilder hardDelete(boolean hardDelete) {
      this.hardDelete = hardDelete;
      return this;
    }

    public BulkBuilder forDelete() {
      this.operationType = OperationType.DELETE;
      return this;
    }

    public BulkBuilder forRestore() {
      this.operationType = OperationType.RESTORE;
      return this;
    }

    public BulkBuilder forExport() {
      this.operationType = OperationType.EXPORT_CSV;
      return this;
    }

    public String execute() throws OpenMetadataException {
      if (entityType == null) {
        throw new IllegalStateException("Entity type must be set");
      }

      switch (operationType) {
        case IMPORT_CSV:
          if (csvData == null) {
            throw new IllegalStateException("CSV data must be set for import");
          }
          return Bulk.importCsv(entityType, csvData, dryRun);
        case EXPORT_CSV:
          return Bulk.exportCsv(entityType);
        case ADD_ASSETS:
          if (assets == null) {
            throw new IllegalStateException("Assets must be set for bulk add");
          }
          return Bulk.addAssets(entityType, assets);
        case PATCH:
          if (patches == null) {
            throw new IllegalStateException("Patches must be set for bulk patch");
          }
          return Bulk.patch(entityType, patches);
        case DELETE:
          if (ids == null) {
            throw new IllegalStateException("IDs must be set for bulk delete");
          }
          return Bulk.delete(entityType, ids, hardDelete);
        case RESTORE:
          if (ids == null) {
            throw new IllegalStateException("IDs must be set for bulk restore");
          }
          return Bulk.restore(entityType, ids);
        default:
          throw new IllegalStateException("Operation type must be set");
      }
    }

    public CompletableFuture<String> executeAsync() {
      return CompletableFuture.supplyAsync(() -> {
        try {
          return execute();
        } catch (OpenMetadataException e) {
          throw new RuntimeException(e);
        }
      });
    }
  }
}
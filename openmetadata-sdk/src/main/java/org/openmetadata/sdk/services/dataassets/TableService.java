package org.openmetadata.sdk.services.dataassets;

import java.util.UUID;
import org.openmetadata.schema.api.data.CreateTable;
import org.openmetadata.schema.api.data.CreateTableProfile;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.tests.CustomMetric;
import org.openmetadata.schema.type.DataModel;
import org.openmetadata.schema.type.TableData;
import org.openmetadata.schema.type.TableJoins;
import org.openmetadata.schema.type.TableProfilerConfig;
import org.openmetadata.schema.type.TableQuery;
import org.openmetadata.sdk.exceptions.OpenMetadataException;
import org.openmetadata.sdk.models.TableColumnList;
import org.openmetadata.sdk.network.HttpClient;
import org.openmetadata.sdk.network.HttpMethod;
import org.openmetadata.sdk.network.RequestOptions;
import org.openmetadata.sdk.services.EntityServiceBase;

public class TableService extends EntityServiceBase<Table> {
  public TableService(HttpClient httpClient) {
    super(httpClient, "/v1/tables");
  }

  @Override
  protected Class<Table> getEntityClass() {
    return Table.class;
  }

  // Create table using CreateTable request
  public Table create(CreateTable request) throws OpenMetadataException {
    return httpClient.execute(HttpMethod.POST, basePath, request, Table.class);
  }

  // ===================================================================
  // COLUMNS OPERATIONS
  // ===================================================================

  /**
   * Get columns for a table with pagination and filtering
   *
   * @param id Table UUID
   * @param limit Number of columns to return (1-1000, default 50)
   * @param offset Offset for pagination (default 0)
   * @param fields Optional fields to include
   * @param include Include deleted columns (default: non-deleted)
   * @return TableColumnList with pagination info
   */
  public TableColumnList getColumns(
      UUID id, Integer limit, Integer offset, String fields, String include)
      throws OpenMetadataException {
    return getColumns(id.toString(), limit, offset, fields, include, null);
  }

  public TableColumnList getColumns(
      String id, Integer limit, Integer offset, String fields, String include)
      throws OpenMetadataException {
    return getColumns(id, limit, offset, fields, include, null);
  }

  /**
   * Get columns for a table with pagination, filtering, and sorting
   *
   * @param id Table UUID
   * @param limit Number of columns to return (1-1000, default 50)
   * @param offset Offset for pagination (default 0)
   * @param fields Optional fields to include
   * @param include Include deleted columns (default: non-deleted)
   * @param sortBy Sort columns by field: 'name' (default) or 'ordinalPosition'
   * @return TableColumnList with pagination info
   */
  public TableColumnList getColumns(
      UUID id, Integer limit, Integer offset, String fields, String include, String sortBy)
      throws OpenMetadataException {
    return getColumns(id.toString(), limit, offset, fields, include, sortBy);
  }

  public TableColumnList getColumns(
      String id, Integer limit, Integer offset, String fields, String include, String sortBy)
      throws OpenMetadataException {
    try {
      RequestOptions.Builder builder = RequestOptions.builder();
      if (limit != null) {
        builder.queryParam("limit", limit.toString());
      }
      if (offset != null) {
        builder.queryParam("offset", offset.toString());
      }
      if (fields != null && !fields.isEmpty()) {
        builder.queryParam("fields", fields);
      }
      if (include != null && !include.isEmpty()) {
        builder.queryParam("include", include);
      }
      if (sortBy != null && !sortBy.isEmpty()) {
        builder.queryParam("sortBy", sortBy);
      }
      String json =
          httpClient.executeForString(
              HttpMethod.GET, basePath + "/" + id + "/columns", null, builder.build());
      return objectMapper.readValue(json, TableColumnList.class);
    } catch (Exception e) {
      throw new OpenMetadataException("Failed to get columns: " + e.getMessage(), e);
    }
  }

  /**
   * Get all columns for a table (no pagination)
   *
   * @param id Table UUID
   * @return TableColumnList with all columns
   */
  public TableColumnList getColumns(UUID id) throws OpenMetadataException {
    return getColumns(id, null, null, null, null);
  }

  public TableColumnList getColumns(String id) throws OpenMetadataException {
    return getColumns(id, null, null, null, null);
  }

  /**
   * Get columns with specific fields
   *
   * @param id Table UUID
   * @param fields Fields to include
   * @return TableColumnList
   */
  public TableColumnList getColumns(UUID id, String fields) throws OpenMetadataException {
    return getColumns(id, null, null, fields, null);
  }

  public TableColumnList getColumns(String id, String fields) throws OpenMetadataException {
    return getColumns(id, null, null, fields, null);
  }

  /**
   * Update a column by its fully qualified name
   *
   * @param columnFqn Fully qualified name of the column (e.g., "service.db.schema.table.column")
   * @param updateColumn UpdateColumn request with fields to update
   * @return Updated Column
   */
  public org.openmetadata.schema.type.Column updateColumn(
      String columnFqn, org.openmetadata.schema.api.data.UpdateColumn updateColumn)
      throws OpenMetadataException {
    try {
      // URL encode the FQN
      String encodedFqn = java.net.URLEncoder.encode(columnFqn, "UTF-8");
      RequestOptions options = RequestOptions.builder().queryParam("entityType", "table").build();
      return httpClient.execute(
          HttpMethod.PUT,
          "/v1/columns/name/" + encodedFqn,
          updateColumn,
          org.openmetadata.schema.type.Column.class,
          options);
    } catch (Exception e) {
      throw new OpenMetadataException("Failed to update column: " + e.getMessage(), e);
    }
  }

  // ===================================================================
  // SAMPLE DATA OPERATIONS
  // ===================================================================

  /**
   * Update sample data for a table
   *
   * @param id Table UUID
   * @param sampleData Sample data to set
   * @return Updated table
   */
  public Table updateSampleData(UUID id, TableData sampleData) throws OpenMetadataException {
    return updateSampleData(id.toString(), sampleData);
  }

  public Table updateSampleData(String id, TableData sampleData) throws OpenMetadataException {
    return httpClient.execute(
        HttpMethod.PUT, basePath + "/" + id + "/sampleData", sampleData, Table.class);
  }

  // ===================================================================
  // TABLE PROFILE OPERATIONS
  // ===================================================================

  /**
   * Update table profile data
   *
   * @param id Table UUID
   * @param profile Table profile data
   * @return Updated table
   */
  public Table updateTableProfile(UUID id, CreateTableProfile profile)
      throws OpenMetadataException {
    return updateTableProfile(id.toString(), profile);
  }

  public Table updateTableProfile(String id, CreateTableProfile profile)
      throws OpenMetadataException {
    return httpClient.execute(
        HttpMethod.PUT, basePath + "/" + id + "/tableProfile", profile, Table.class);
  }

  /**
   * Update table profiler configuration
   *
   * @param id Table UUID
   * @param config Profiler configuration
   * @return Updated table
   */
  public Table updateProfilerConfig(UUID id, TableProfilerConfig config)
      throws OpenMetadataException {
    return updateProfilerConfig(id.toString(), config);
  }

  public Table updateProfilerConfig(String id, TableProfilerConfig config)
      throws OpenMetadataException {
    return httpClient.execute(
        HttpMethod.PUT, basePath + "/" + id + "/tableProfilerConfig", config, Table.class);
  }

  // ===================================================================
  // TABLE JOINS OPERATIONS
  // ===================================================================

  /**
   * Update table joins information
   *
   * @param id Table UUID
   * @param joins Table joins data
   * @return Updated table
   */
  public Table updateJoins(UUID id, TableJoins joins) throws OpenMetadataException {
    return updateJoins(id.toString(), joins);
  }

  public Table updateJoins(String id, TableJoins joins) throws OpenMetadataException {
    return httpClient.execute(HttpMethod.PUT, basePath + "/" + id + "/joins", joins, Table.class);
  }

  // ===================================================================
  // DATA MODEL OPERATIONS
  // ===================================================================

  /**
   * Update table data model
   *
   * @param id Table UUID
   * @param dataModel Data model definition
   * @return Updated table
   */
  public Table updateDataModel(UUID id, DataModel dataModel) throws OpenMetadataException {
    return updateDataModel(id.toString(), dataModel);
  }

  public Table updateDataModel(String id, DataModel dataModel) throws OpenMetadataException {
    return httpClient.execute(
        HttpMethod.PUT, basePath + "/" + id + "/dataModel", dataModel, Table.class);
  }

  // ===================================================================
  // QUERIES OPERATIONS
  // ===================================================================

  /**
   * Update table queries
   *
   * @param id Table UUID
   * @param query Table query data
   * @return Updated table
   */
  public Table updateQueries(UUID id, TableQuery query) throws OpenMetadataException {
    return updateQueries(id.toString(), query);
  }

  public Table updateQueries(String id, TableQuery query) throws OpenMetadataException {
    return httpClient.execute(HttpMethod.PUT, basePath + "/" + id + "/queries", query, Table.class);
  }

  // ===================================================================
  // CUSTOM METRIC OPERATIONS
  // ===================================================================

  /**
   * Add or update custom metric for a table
   *
   * @param id Table UUID
   * @param customMetric Custom metric definition
   * @return Updated table
   */
  public Table updateCustomMetric(UUID id, CustomMetric customMetric) throws OpenMetadataException {
    return updateCustomMetric(id.toString(), customMetric);
  }

  public Table updateCustomMetric(String id, CustomMetric customMetric)
      throws OpenMetadataException {
    return httpClient.execute(
        HttpMethod.PUT, basePath + "/" + id + "/customMetric", customMetric, Table.class);
  }

  /**
   * Delete custom metric from a table
   *
   * @param id Table UUID
   * @param metricName Name of the metric to delete
   */
  public void deleteCustomMetric(UUID id, String metricName) throws OpenMetadataException {
    deleteCustomMetric(id.toString(), metricName);
  }

  public void deleteCustomMetric(String id, String metricName) throws OpenMetadataException {
    httpClient.execute(
        HttpMethod.DELETE, basePath + "/" + id + "/customMetric/" + metricName, null, Void.class);
  }

  // ===================================================================
  // PIPELINE OBSERVABILITY OPERATIONS
  // ===================================================================

  public Table addPipelineObservability(
      UUID id, java.util.List<org.openmetadata.schema.type.PipelineObservability> observabilityList)
      throws OpenMetadataException {
    return addPipelineObservability(id.toString(), observabilityList);
  }

  public Table addPipelineObservability(
      String id,
      java.util.List<org.openmetadata.schema.type.PipelineObservability> observabilityList)
      throws OpenMetadataException {
    return httpClient.execute(
        HttpMethod.PUT,
        basePath + "/" + id + "/pipelineObservability",
        observabilityList,
        Table.class);
  }

  public java.util.List<org.openmetadata.schema.type.PipelineObservability>
      getPipelineObservability(UUID id) throws OpenMetadataException {
    return getPipelineObservability(id.toString());
  }

  public java.util.List<org.openmetadata.schema.type.PipelineObservability>
      getPipelineObservability(String id) throws OpenMetadataException {
    try {
      String json =
          httpClient.executeForString(
              HttpMethod.GET, basePath + "/" + id + "/pipelineObservability", null, null);
      return objectMapper.readValue(
          json,
          objectMapper
              .getTypeFactory()
              .constructCollectionType(
                  java.util.List.class, org.openmetadata.schema.type.PipelineObservability.class));
    } catch (Exception e) {
      throw new OpenMetadataException("Failed to get pipeline observability: " + e.getMessage(), e);
    }
  }

  // ===================================================================
  // CSV IMPORT/EXPORT OPERATIONS
  // ===================================================================

  /**
   * Export table columns to CSV format
   *
   * @param tableName Fully qualified name of the table
   * @return CSV string with table columns
   */
  public String exportCsv(String tableName) throws OpenMetadataException {
    try {
      String encodedName = java.net.URLEncoder.encode(tableName, "UTF-8");
      return httpClient.executeForString(
          HttpMethod.GET, basePath + "/name/" + encodedName + "/export", null, null);
    } catch (Exception e) {
      throw new OpenMetadataException("Failed to export CSV: " + e.getMessage(), e);
    }
  }

  /**
   * Export table columns to CSV format asynchronously
   *
   * @param tableName Fully qualified name of the table
   * @return Job ID for async export
   */
  public String exportCsvAsync(String tableName) throws OpenMetadataException {
    try {
      String encodedName = java.net.URLEncoder.encode(tableName, "UTF-8");
      return httpClient.executeForString(
          HttpMethod.GET, basePath + "/name/" + encodedName + "/exportAsync", null, null);
    } catch (Exception e) {
      throw new OpenMetadataException("Failed to export CSV async: " + e.getMessage(), e);
    }
  }

  /**
   * Import CSV to update table columns
   *
   * @param tableName Fully qualified name of the table
   * @param csv CSV data to import
   * @param dryRun If true, validate without actually importing (default: true)
   * @return Import result with status
   */
  public String importCsv(String tableName, String csv, boolean dryRun)
      throws OpenMetadataException {
    try {
      String encodedName = java.net.URLEncoder.encode(tableName, "UTF-8");
      RequestOptions options =
          RequestOptions.builder().queryParam("dryRun", String.valueOf(dryRun)).build();
      return httpClient.executeForString(
          HttpMethod.PUT, basePath + "/name/" + encodedName + "/import", csv, options);
    } catch (Exception e) {
      throw new OpenMetadataException("Failed to import CSV: " + e.getMessage(), e);
    }
  }

  /**
   * Import CSV to update table columns asynchronously
   *
   * @param tableName Fully qualified name of the table
   * @param csv CSV data to import
   * @return Job ID for async import
   */
  public String importCsvAsync(String tableName, String csv) throws OpenMetadataException {
    try {
      String encodedName = java.net.URLEncoder.encode(tableName, "UTF-8");
      return httpClient.executeForString(
          HttpMethod.PUT, basePath + "/name/" + encodedName + "/importAsync", csv, null);
    } catch (Exception e) {
      throw new OpenMetadataException("Failed to import CSV async: " + e.getMessage(), e);
    }
  }
}

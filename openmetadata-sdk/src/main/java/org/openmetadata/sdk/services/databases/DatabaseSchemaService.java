package org.openmetadata.sdk.services.databases;

import java.util.UUID;
import org.openmetadata.schema.api.data.CreateDatabaseSchema;
import org.openmetadata.schema.entity.data.DatabaseSchema;
import org.openmetadata.schema.type.DatabaseSchemaProfilerConfig;
import org.openmetadata.sdk.exceptions.OpenMetadataException;
import org.openmetadata.sdk.network.HttpClient;
import org.openmetadata.sdk.network.HttpMethod;
import org.openmetadata.sdk.services.EntityServiceBase;

public class DatabaseSchemaService extends EntityServiceBase<DatabaseSchema> {
  public DatabaseSchemaService(HttpClient httpClient) {
    super(httpClient, "/v1/databaseSchemas");
  }

  @Override
  protected Class<DatabaseSchema> getEntityClass() {
    return DatabaseSchema.class;
  }

  // Create database schema using CreateDatabaseSchema request
  public DatabaseSchema create(CreateDatabaseSchema request) throws OpenMetadataException {
    return httpClient.execute(HttpMethod.POST, basePath, request, DatabaseSchema.class);
  }

  /**
   * Add or update profiler config for a database schema.
   *
   * @param id Schema ID
   * @param profilerConfig Profiler config to add
   * @return Updated database schema
   * @throws OpenMetadataException if request fails
   */
  public DatabaseSchema addProfilerConfig(UUID id, DatabaseSchemaProfilerConfig profilerConfig)
      throws OpenMetadataException {
    return addProfilerConfig(id.toString(), profilerConfig);
  }

  /**
   * Add or update profiler config for a database schema.
   *
   * @param id Schema ID as string
   * @param profilerConfig Profiler config to add
   * @return Updated database schema
   * @throws OpenMetadataException if request fails
   */
  public DatabaseSchema addProfilerConfig(String id, DatabaseSchemaProfilerConfig profilerConfig)
      throws OpenMetadataException {
    String path = basePath + "/" + id + "/databaseSchemaProfilerConfig";
    return httpClient.execute(HttpMethod.PUT, path, profilerConfig, DatabaseSchema.class);
  }

  /**
   * Get profiler config for a database schema.
   *
   * @param id Schema ID
   * @return Database schema with profiler config
   * @throws OpenMetadataException if request fails
   */
  public DatabaseSchema getProfilerConfig(UUID id) throws OpenMetadataException {
    return getProfilerConfig(id.toString());
  }

  /**
   * Get profiler config for a database schema.
   *
   * @param id Schema ID as string
   * @return Database schema with profiler config
   * @throws OpenMetadataException if request fails
   */
  public DatabaseSchema getProfilerConfig(String id) throws OpenMetadataException {
    String path = basePath + "/" + id + "/databaseSchemaProfilerConfig";
    return httpClient.execute(HttpMethod.GET, path, null, DatabaseSchema.class);
  }
}

package org.openmetada.restclient.api;

import org.openmetada.restclient.ApiClient;
import org.openmetada.restclient.EncodingUtils;

import org.openmetada.restclient.util.ResultList;
import org.openmetadata.catalog.entity.services.StorageService;
import org.openmetadata.catalog.type.EntityHistory;
import org.openmetadata.catalog.api.services.CreateDashboardService;
import org.openmetadata.catalog.api.services.CreateDatabaseService;
import org.openmetadata.catalog.api.services.CreateMessagingService;
import org.openmetadata.catalog.api.services.CreatePipelineService;
import org.openmetadata.catalog.api.services.CreateStorageService;
import org.openmetadata.catalog.entity.services.DashboardService;
import org.openmetadata.catalog.entity.services.DatabaseService;
import org.openmetadata.catalog.entity.services.MessagingService;
import org.openmetadata.catalog.entity.services.PipelineService;
import org.openmetadata.catalog.type.CollectionDescriptor;

import javax.ws.rs.core.Response;

import java.util.HashMap;
import java.util.Map;
import feign.*;

public interface ServicesApi extends ApiClient.Api {

  /**
   * Create a dashboard service
   * Create a new dashboard service.
   * @param body  (optional)
   * @return CreateDashboardService
   */
  @RequestLine("POST /v1/services/dashboardServices")
  @Headers({
      "Content-Type: application/json",
      "Accept: application/json",
  })
  Response createDashboardService(CreateDashboardService body);
  /**
   * Create database service
   * Create a new database service.
   * @param body  (optional)
   * @return CreateDatabaseService
   */
  @RequestLine("POST /v1/services/databaseServices")
  @Headers({
      "Content-Type: application/json",
      "Accept: application/json",
  })
  Response createDatabaseService(CreateDatabaseService body);
  /**
   * Create a messaging service
   * Create a new messaging service.
   * @param body  (optional)
   * @return CreateMessagingService
   */
  @RequestLine("POST /v1/services/messagingServices")
  @Headers({
      "Content-Type: application/json",
      "Accept: application/json",
  })
  Response createMessagingService(CreateMessagingService body);
  /**
   * Create a pipeline service
   * Create a new pipeline service.
   * @param body  (optional)
   * @return CreatePipelineService
   */
  @RequestLine("POST /v1/services/pipelineServices")
  @Headers({
      "Content-Type: application/json",
      "Accept: application/json",
  })
  Response createPipelineService(CreatePipelineService body);
  /**
   * Create storage service
   * Create a new storage service.
   * @param body  (optional)
   * @return StorageService
   */
  @RequestLine("POST /v1/services/storageServices")
  @Headers({
      "Content-Type: application/json",
      "Accept: application/json",
  })
  Response createStorageService(CreateStorageService body);
  /**
   * Update a Dashboard service
   * Update an existing dashboard service identified by &#x60;id&#x60;.
   * @param body  (optional)
   * @return CreateDashboardService
   */
  @RequestLine("PUT /v1/services/dashboardServices")
  @Headers({
      "Content-Type: application/json",
      "Accept: application/json",
  })
  Response createOrUpdateDashboard(CreateDashboardService body);
  /**
   * Update database service
   * Update an existing or create a new database service.
   * @param body  (optional)
   * @return CreateDatabaseService
   */
  @RequestLine("PUT /v1/services/databaseServices")
  @Headers({
      "Content-Type: application/json",
      "Accept: application/json",
  })
  Response createOrUpdateDatabaseService(CreateDatabaseService body);
  /**
   * Update pipeline service
   * Create a new pipeline service or update an existing pipeline service identified by &#x60;id&#x60;.
   * @param body  (optional)
   * @return CreatePipelineService
   */
  @RequestLine("PUT /v1/services/pipelineServices")
  @Headers({
      "Content-Type: application/json",
      "Accept: application/json",
  })
  Response createOrUpdatePipelineService(CreatePipelineService body);
  /**
   * Update storage service
   * Update an existing storage service identified by &#x60;id&#x60;.
   * @param body  (optional)
   * @return StorageService
   */
  @RequestLine("PUT /v1/services/storageServices")
  @Headers({
      "Content-Type: application/json",
      "Accept: application/json",
  })
  Response createOrUpdateStorageService(CreateStorageService body);
  /**
   * Delete a Dashboard service
   * Delete a Dashboard services. If dashboard (and charts) belong to the service, it can&#x27;t be deleted.
   * @param id Id of the dashboard service (required)
   * @param recursive Recursively delete this entity and it&#x27;s children. (Default &#x60;false&#x60;) (optional)
   * @param hardDelete Hard delete the entity. (Default &#x3D; &#x60;false&#x60;) (optional)
   */
  @RequestLine("DELETE /v1/services/dashboardServices/{id}?recursive={recursive}&hardDelete={hardDelete}")
  @Headers({
      "Content-Type: application/json",
      "Accept: */*",
  })
  Response deleteDashboardService(@Param("id") String id, @Param("recursive") Boolean recursive, @Param("hardDelete") Boolean hardDelete);

  /**
   * Delete a Dashboard service
   * Delete a Dashboard services. If dashboard (and charts) belong to the service, it can&#x27;t be deleted.
   * Note, this is equivalent to the other <code>delete11</code> method,
   * but with the query parameters collected into a single Map parameter. This
   * is convenient for services with optional query parameters, especially when
   * used with the {@link DeleteDashobardQueryParams} class that allows for
   * building up this map in a fluent style.
   * @param id Id of the dashboard service (required)
   * @param queryParams Map of query parameters as name-value pairs
   *   <p>The following elements may be specified in the query map:</p>
   *   <ul>
   *   <li>recursive - Recursively delete this entity and it&#x27;s children. (Default &#x60;false&#x60;) (optional)</li>
   *   <li>hardDelete - Hard delete the entity. (Default &#x3D; &#x60;false&#x60;) (optional)</li>
   *   </ul>

   */
  @RequestLine("DELETE /v1/services/dashboardServices/{id}?recursive={recursive}&hardDelete={hardDelete}")
  @Headers({
      "Content-Type: application/json",
  })
  Response deleteDashboardService(@Param("id") String id, @QueryMap(encoded=true) Map<String, Object> queryParams);

  /**
   * A convenience class for generating query parameters for the
   * <code>delete11</code> method in a fluent style.
   */
  class DeleteDashobardQueryParams extends HashMap<String, Object> {
    public DeleteDashobardQueryParams recursive(final Boolean value) {
      put("recursive", EncodingUtils.encode(value));
      return this;
    }
    public DeleteDashobardQueryParams hardDelete(final Boolean value) {
      put("hardDelete", EncodingUtils.encode(value));
      return this;
    }
  }
  /**
   * Delete a database service
   * Delete a database services. If databases (and tables) belong the service, it can&#x27;t be deleted.
   * @param id Id of the database service (required)
   * @param recursive Recursively delete this entity and it&#x27;s children. (Default &#x60;false&#x60;) (optional)
   * @param hardDelete Hard delete the entity. (Default &#x3D; &#x60;false&#x60;) (optional)
   */
  @RequestLine("DELETE /v1/services/databaseServices/{id}?recursive={recursive}&hardDelete={hardDelete}")
  @Headers({
      "Content-Type: application/json",
      "Accept: */*",
  })
  Response deleteDatabaseService(@Param("id") String id, @Param("recursive") Boolean recursive, @Param("hardDelete") Boolean hardDelete);

  /**
   * Delete a database service
   * Delete a database services. If databases (and tables) belong the service, it can&#x27;t be deleted.
   * Note, this is equivalent to the other <code>delete12</code> method,
   * but with the query parameters collected into a single Map parameter. This
   * is convenient for services with optional query parameters, especially when
   * used with the {@link DeleteDatabseQueryParams} class that allows for
   * building up this map in a fluent style.
   * @param id Id of the database service (required)
   * @param queryParams Map of query parameters as name-value pairs
   *   <p>The following elements may be specified in the query map:</p>
   *   <ul>
   *   <li>recursive - Recursively delete this entity and it&#x27;s children. (Default &#x60;false&#x60;) (optional)</li>
   *   <li>hardDelete - Hard delete the entity. (Default &#x3D; &#x60;false&#x60;) (optional)</li>
   *   </ul>

   */
  @RequestLine("DELETE /v1/services/databaseServices/{id}?recursive={recursive}&hardDelete={hardDelete}")
  @Headers({
      "Content-Type: application/json",
  })
  Response deleteDatabaseService(@Param("id") String id, @QueryMap(encoded=true) Map<String, Object> queryParams);

  /**
   * A convenience class for generating query parameters for the
   * <code>delete12</code> method in a fluent style.
   */
  class DeleteDatabseQueryParams extends HashMap<String, Object> {
    public DeleteDatabseQueryParams recursive(final Boolean value) {
      put("recursive", EncodingUtils.encode(value));
      return this;
    }
    public DeleteDatabseQueryParams hardDelete(final Boolean value) {
      put("hardDelete", EncodingUtils.encode(value));
      return this;
    }
  }
  /**
   * Delete a messaging service
   * Delete a messaging service. If topics belong the service, it can&#x27;t be deleted.
   * @param id Id of the messaging service (required)
   * @param recursive Recursively delete this entity and it&#x27;s children. (Default &#x60;false&#x60;) (optional)
   * @param hardDelete Hard delete the entity. (Default &#x3D; &#x60;false&#x60;) (optional)
   */
  @RequestLine("DELETE /v1/services/messagingServices/{id}?recursive={recursive}&hardDelete={hardDelete}")
  @Headers({
      "Content-Type: application/json",
      "Accept: */*",
  })
  Response deleteMessagingService(@Param("id") String id, @Param("recursive") Boolean recursive, @Param("hardDelete") Boolean hardDelete);

  /**
   * Delete a messaging service
   * Delete a messaging service. If topics belong the service, it can&#x27;t be deleted.
   * Note, this is equivalent to the other <code>delete14</code> method,
   * but with the query parameters collected into a single Map parameter. This
   * is convenient for services with optional query parameters, especially when
   * used with the {@link DeleteMessagingQueryParams} class that allows for
   * building up this map in a fluent style.
   * @param id Id of the messaging service (required)
   * @param queryParams Map of query parameters as name-value pairs
   *   <p>The following elements may be specified in the query map:</p>
   *   <ul>
   *   <li>recursive - Recursively delete this entity and it&#x27;s children. (Default &#x60;false&#x60;) (optional)</li>
   *   <li>hardDelete - Hard delete the entity. (Default &#x3D; &#x60;false&#x60;) (optional)</li>
   *   </ul>

   */
  @RequestLine("DELETE /v1/services/messagingServices/{id}?recursive={recursive}&hardDelete={hardDelete}")
  @Headers({
      "Content-Type: application/json",
  })
  Response deleteMessagingService(@Param("id") String id, @QueryMap(encoded=true) Map<String, Object> queryParams);

  /**
   * A convenience class for generating query parameters for the
   * <code>delete14</code> method in a fluent style.
   */
  class DeleteMessagingQueryParams extends HashMap<String, Object> {
    public DeleteMessagingQueryParams recursive(final Boolean value) {
      put("recursive", EncodingUtils.encode(value));
      return this;
    }
    public DeleteMessagingQueryParams hardDelete(final Boolean value) {
      put("hardDelete", EncodingUtils.encode(value));
      return this;
    }
  }
  /**
   * Delete a pipeline service
   * Delete a pipeline services. If pipelines (and tasks) belong to the service, it can&#x27;t be deleted.
   * @param id Id of the pipeline service (required)
   * @param recursive Recursively delete this entity and it&#x27;s children. (Default &#x60;false&#x60;) (optional)
   * @param hardDelete Hard delete the entity. (Default &#x3D; &#x60;false&#x60;) (optional)
   */
  @RequestLine("DELETE /v1/services/pipelineServices/{id}?recursive={recursive}&hardDelete={hardDelete}")
  @Headers({
      "Content-Type: application/json",
      "Accept: */*",
  })
  Response deletePipelineService(@Param("id") String id, @Param("recursive") Boolean recursive, @Param("hardDelete") Boolean hardDelete);

  /**
   * Delete a pipeline service
   * Delete a pipeline services. If pipelines (and tasks) belong to the service, it can&#x27;t be deleted.
   * Note, this is equivalent to the other <code>delete15</code> method,
   * but with the query parameters collected into a single Map parameter. This
   * is convenient for services with optional query parameters, especially when
   * used with the {@link DeletePipelineQueryParams} class that allows for
   * building up this map in a fluent style.
   * @param id Id of the pipeline service (required)
   * @param queryParams Map of query parameters as name-value pairs
   *   <p>The following elements may be specified in the query map:</p>
   *   <ul>
   *   <li>recursive - Recursively delete this entity and it&#x27;s children. (Default &#x60;false&#x60;) (optional)</li>
   *   <li>hardDelete - Hard delete the entity. (Default &#x3D; &#x60;false&#x60;) (optional)</li>
   *   </ul>

   */
  @RequestLine("DELETE /v1/services/pipelineServices/{id}?recursive={recursive}&hardDelete={hardDelete}")
  @Headers({
      "Content-Type: application/json",
  })
  Response deletePipelineService(@Param("id") String id, @QueryMap(encoded=true) Map<String, Object> queryParams);

  /**
   * A convenience class for generating query parameters for the
   * <code>delete15</code> method in a fluent style.
   */
  class DeletePipelineQueryParams extends HashMap<String, Object> {
    public DeletePipelineQueryParams recursive(final Boolean value) {
      put("recursive", EncodingUtils.encode(value));
      return this;
    }
    public DeletePipelineQueryParams hardDelete(final Boolean value) {
      put("hardDelete", EncodingUtils.encode(value));
      return this;
    }
  }
  /**
   * Delete a storage service
   * Delete a storage services. If storages (and tables) belong the service, it can&#x27;t be deleted.
   * @param id Id of the storage service (required)
   * @param recursive Recursively delete this entity and it&#x27;s children. (Default &#x60;false&#x60;) (optional)
   * @param hardDelete Hard delete the entity. (Default &#x3D; &#x60;false&#x60;) (optional)
   */
  @RequestLine("DELETE /v1/services/storageServices/{id}?recursive={recursive}&hardDelete={hardDelete}")
  @Headers({
      "Content-Type: application/json",
      "Accept: */*",
  })
  Response deleteStorageServices(@Param("id") String id, @Param("recursive") Boolean recursive, @Param("hardDelete") Boolean hardDelete);

  /**
   * Delete a storage service
   * Delete a storage services. If storages (and tables) belong the service, it can&#x27;t be deleted.
   * Note, this is equivalent to the other <code>delete16</code> method,
   * but with the query parameters collected into a single Map parameter. This
   * is convenient for services with optional query parameters, especially when
   * used with the {@link DeleteStorageQueryParams} class that allows for
   * building up this map in a fluent style.
   * @param id Id of the storage service (required)
   * @param queryParams Map of query parameters as name-value pairs
   *   <p>The following elements may be specified in the query map:</p>
   *   <ul>
   *   <li>recursive - Recursively delete this entity and it&#x27;s children. (Default &#x60;false&#x60;) (optional)</li>
   *   <li>hardDelete - Hard delete the entity. (Default &#x3D; &#x60;false&#x60;) (optional)</li>
   *   </ul>

   */
  @RequestLine("DELETE /v1/services/storageServices/{id}?recursive={recursive}&hardDelete={hardDelete}")
  @Headers({
      "Content-Type: application/json",
  })
  Response deleteStorageServices(@Param("id") String id, @QueryMap(encoded=true) Map<String, Object> queryParams);

  /**
   * A convenience class for generating query parameters for the
   * <code>delete16</code> method in a fluent style.
   */
  class DeleteStorageQueryParams extends HashMap<String, Object> {
    public DeleteStorageQueryParams recursive(final Boolean value) {
      put("recursive", EncodingUtils.encode(value));
      return this;
    }
    public DeleteStorageQueryParams hardDelete(final Boolean value) {
      put("hardDelete", EncodingUtils.encode(value));
      return this;
    }
  }
  /**
   * Get a dashboard service
   * Get a dashboard service by &#x60;id&#x60;.
   * @param id  (required)
   * @param fields Fields requested in the returned resource (optional)
   * @param include Include all, deleted, or non-deleted entities. (optional)
   * @return DashboardService
   */
  @RequestLine("GET /v1/services/dashboardServices/{id}?fields={fields}&include={include}")
  @Headers({
      "Accept: application/json",
  })
  DashboardService getDashboardServiceByID(@Param("id") String id, @Param("fields") String fields, @Param("include") String include);

  /**
   * Get a dashboard service
   * Get a dashboard service by &#x60;id&#x60;.
   * Note, this is equivalent to the other <code>get18</code> method,
   * but with the query parameters collected into a single Map parameter. This
   * is convenient for services with optional query parameters, especially when
   * used with the {@link GetDashobardQueryParams} class that allows for
   * building up this map in a fluent style.
   * @param id  (required)
   * @param queryParams Map of query parameters as name-value pairs
   *   <p>The following elements may be specified in the query map:</p>
   *   <ul>
   *   <li>fields - Fields requested in the returned resource (optional)</li>
   *   <li>include - Include all, deleted, or non-deleted entities. (optional)</li>
   *   </ul>
   * @return DashboardService

   */
  @RequestLine("GET /v1/services/dashboardServices/{id}?fields={fields}&include={include}")
  @Headers({
      "Content-Type: */*",
      "Accept: application/json",
  })
  DashboardService getDashboardServiceByID(@Param("id") String id, @QueryMap(encoded=true) Map<String, Object> queryParams);

  /**
   * A convenience class for generating query parameters for the
   * <code>get18</code> method in a fluent style.
   */
  class GetDashobardQueryParams extends HashMap<String, Object> {
    public GetDashobardQueryParams fields(final String value) {
      put("fields", EncodingUtils.encode(value));
      return this;
    }
    public GetDashobardQueryParams include(final String value) {
      put("include", EncodingUtils.encode(value));
      return this;
    }
  }
  /**
   * Get a database service
   * Get a database service by &#x60;id&#x60;.
   * @param id  (required)
   * @param fields Fields requested in the returned resource (optional)
   * @param include Include all, deleted, or non-deleted entities. (optional)
   * @return DatabaseService
   */
  @RequestLine("GET /v1/services/databaseServices/{id}?fields={fields}&include={include}")
  @Headers({
      "Accept: application/json",
  })
  DatabaseService getDatabaseServiceByID(@Param("id") String id, @Param("fields") String fields, @Param("include") String include);

  /**
   * Get a database service
   * Get a database service by &#x60;id&#x60;.
   * Note, this is equivalent to the other <code>get19</code> method,
   * but with the query parameters collected into a single Map parameter. This
   * is convenient for services with optional query parameters, especially when
   * used with the {@link GetDatabaseQueryParams} class that allows for
   * building up this map in a fluent style.
   * @param id  (required)
   * @param queryParams Map of query parameters as name-value pairs
   *   <p>The following elements may be specified in the query map:</p>
   *   <ul>
   *   <li>fields - Fields requested in the returned resource (optional)</li>
   *   <li>include - Include all, deleted, or non-deleted entities. (optional)</li>
   *   </ul>
   * @return DatabaseService

   */
  @RequestLine("GET /v1/services/databaseServices/{id}?fields={fields}&include={include}")
  @Headers({
      "Content-Type: */*",
      "Accept: application/json",
  })
  DatabaseService getDatabaseServiceByID(@Param("id") String id, @QueryMap(encoded=true) Map<String, Object> queryParams);

  /**
   * A convenience class for generating query parameters for the
   * <code>get19</code> method in a fluent style.
   */
  class GetDatabaseQueryParams extends HashMap<String, Object> {
    public GetDatabaseQueryParams fields(final String value) {
      put("fields", EncodingUtils.encode(value));
      return this;
    }
    public GetDatabaseQueryParams include(final String value) {
      put("include", EncodingUtils.encode(value));
      return this;
    }
  }
  /**
   * Get a messaging service
   * Get a messaging service by &#x60;id&#x60;.
   * @param id  (required)
   * @param fields Fields requested in the returned resource (optional)
   * @param include Include all, deleted, or non-deleted entities. (optional)
   * @return MessagingService
   */
  @RequestLine("GET /v1/services/messagingServices/{id}?fields={fields}&include={include}")
  @Headers({
      "Accept: application/json",
  })
  MessagingService getMessagingServiceByID(@Param("id") String id, @Param("fields") String fields, @Param("include") String include);

  /**
   * Get a messaging service
   * Get a messaging service by &#x60;id&#x60;.
   * Note, this is equivalent to the other <code>get21</code> method,
   * but with the query parameters collected into a single Map parameter. This
   * is convenient for services with optional query parameters, especially when
   * used with the {@link GetMessagingQueryParams} class that allows for
   * building up this map in a fluent style.
   * @param id  (required)
   * @param queryParams Map of query parameters as name-value pairs
   *   <p>The following elements may be specified in the query map:</p>
   *   <ul>
   *   <li>fields - Fields requested in the returned resource (optional)</li>
   *   <li>include - Include all, deleted, or non-deleted entities. (optional)</li>
   *   </ul>
   * @return MessagingService

   */
  @RequestLine("GET /v1/services/messagingServices/{id}?fields={fields}&include={include}")
  @Headers({
      "Content-Type: */*",
      "Accept: application/json",
  })
  MessagingService getMessagingServiceByID(@Param("id") String id, @QueryMap(encoded=true) Map<String, Object> queryParams);

  /**
   * A convenience class for generating query parameters for the
   * <code>get21</code> method in a fluent style.
   */
  class GetMessagingQueryParams extends HashMap<String, Object> {
    public GetMessagingQueryParams fields(final String value) {
      put("fields", EncodingUtils.encode(value));
      return this;
    }
    public GetMessagingQueryParams include(final String value) {
      put("include", EncodingUtils.encode(value));
      return this;
    }
  }
  /**
   * Get a pipeline service
   * Get a pipeline service by &#x60;id&#x60;.
   * @param id  (required)
   * @param fields Fields requested in the returned resource (optional)
   * @param include Include all, deleted, or non-deleted entities. (optional)
   * @return PipelineService
   */
  @RequestLine("GET /v1/services/pipelineServices/{id}?fields={fields}&include={include}")
  @Headers({
      "Accept: application/json",
  })
  PipelineService getPipelineServiceByID(@Param("id") String id, @Param("fields") String fields, @Param("include") String include);

  /**
   * Get a pipeline service
   * Get a pipeline service by &#x60;id&#x60;.
   * Note, this is equivalent to the other <code>get22</code> method,
   * but with the query parameters collected into a single Map parameter. This
   * is convenient for services with optional query parameters, especially when
   * used with the {@link GetPipelineQueryParams} class that allows for
   * building up this map in a fluent style.
   * @param id  (required)
   * @param queryParams Map of query parameters as name-value pairs
   *   <p>The following elements may be specified in the query map:</p>
   *   <ul>
   *   <li>fields - Fields requested in the returned resource (optional)</li>
   *   <li>include - Include all, deleted, or non-deleted entities. (optional)</li>
   *   </ul>
   * @return PipelineService

   */
  @RequestLine("GET /v1/services/pipelineServices/{id}?fields={fields}&include={include}")
  @Headers({
      "Content-Type: */*",
      "Accept: application/json",
  })
  PipelineService getPipelineServiceByID(@Param("id") String id, @QueryMap(encoded=true) Map<String, Object> queryParams);

  /**
   * A convenience class for generating query parameters for the
   * <code>get22</code> method in a fluent style.
   */
  class GetPipelineQueryParams extends HashMap<String, Object> {
    public GetPipelineQueryParams fields(final String value) {
      put("fields", EncodingUtils.encode(value));
      return this;
    }
    public GetPipelineQueryParams include(final String value) {
      put("include", EncodingUtils.encode(value));
      return this;
    }
  }
  /**
   * Get a storage service
   * Get a storage service by &#x60;id&#x60;.
   * @param id  (required)
   * @param fields Fields requested in the returned resource (optional)
   * @param include Include all, deleted, or non-deleted entities. (optional)
   * @return StorageService
   */
  @RequestLine("GET /v1/services/storageServices/{id}?fields={fields}&include={include}")
  @Headers({
      "Accept: application/json",
  })
  StorageService getStorageServiceByID(@Param("id") String id, @Param("fields") String fields, @Param("include") String include);

  /**
   * Get a storage service
   * Get a storage service by &#x60;id&#x60;.
   * Note, this is equivalent to the other <code>get23</code> method,
   * but with the query parameters collected into a single Map parameter. This
   * is convenient for services with optional query parameters, especially when
   * used with the {@link GetStorageQueryParams} class that allows for
   * building up this map in a fluent style.
   * @param id  (required)
   * @param queryParams Map of query parameters as name-value pairs
   *   <p>The following elements may be specified in the query map:</p>
   *   <ul>
   *   <li>fields - Fields requested in the returned resource (optional)</li>
   *   <li>include - Include all, deleted, or non-deleted entities. (optional)</li>
   *   </ul>
   * @return StorageService

   */
  @RequestLine("GET /v1/services/storageServices/{id}?fields={fields}&include={include}")
  @Headers({
      "Content-Type: */*",
      "Accept: application/json",
  })
  StorageService getStorageServiceByID(@Param("id") String id, @QueryMap(encoded=true) Map<String, Object> queryParams);

  /**
   * A convenience class for generating query parameters for the
   * <code>get23</code> method in a fluent style.
   */
  class GetStorageQueryParams extends HashMap<String, Object> {
    public GetStorageQueryParams fields(final String value) {
      put("fields", EncodingUtils.encode(value));
      return this;
    }
    public GetStorageQueryParams include(final String value) {
      put("include", EncodingUtils.encode(value));
      return this;
    }
  }
  /**
   * Get dashboard service by name
   * Get a dashboard service by the service &#x60;name&#x60;.
   * @param name  (required)
   * @param fields Fields requested in the returned resource (optional)
   * @param include Include all, deleted, or non-deleted entities. (optional)
   * @return DashboardService
   */
  @RequestLine("GET /v1/services/dashboardServices/name/{name}?fields={fields}&include={include}")
  @Headers({
      "Accept: application/json",
  })
  DashboardService getDashboardServiceByFQN(@Param("name") String name, @Param("fields") String fields, @Param("include") String include);

  /**
   * Get dashboard service by name
   * Get a dashboard service by the service &#x60;name&#x60;.
   * Note, this is equivalent to the other <code>getByName13</code> method,
   * but with the query parameters collected into a single Map parameter. This
   * is convenient for services with optional query parameters, especially when
   * used with the {@link GetByNameDashboardQueryParams} class that allows for
   * building up this map in a fluent style.
   * @param name  (required)
   * @param queryParams Map of query parameters as name-value pairs
   *   <p>The following elements may be specified in the query map:</p>
   *   <ul>
   *   <li>fields - Fields requested in the returned resource (optional)</li>
   *   <li>include - Include all, deleted, or non-deleted entities. (optional)</li>
   *   </ul>
   * @return DashboardService

   */
  @RequestLine("GET /v1/services/dashboardServices/name/{name}?fields={fields}&include={include}")
  @Headers({
      "Content-Type: */*",
      "Accept: application/json",
  })
  DashboardService getDashboardServiceByFQN(@Param("name") String name, @QueryMap(encoded=true) Map<String, Object> queryParams);

  /**
   * A convenience class for generating query parameters for the
   * <code>getByName13</code> method in a fluent style.
   */
  class GetByNameDashboardQueryParams extends HashMap<String, Object> {
    public GetByNameDashboardQueryParams fields(final String value) {
      put("fields", EncodingUtils.encode(value));
      return this;
    }
    public GetByNameDashboardQueryParams include(final String value) {
      put("include", EncodingUtils.encode(value));
      return this;
    }
  }
  /**
   * Get database service by name
   * Get a database service by the service &#x60;name&#x60;.
   * @param name  (required)
   * @param fields Fields requested in the returned resource (optional)
   * @param include Include all, deleted, or non-deleted entities. (optional)
   * @return DatabaseService
   */
  @RequestLine("GET /v1/services/databaseServices/name/{name}?fields={fields}&include={include}")
  @Headers({
      "Accept: application/json",
  })
  DatabaseService getDatabaseServiceByFQN(@Param("name") String name, @Param("fields") String fields, @Param("include") String include);

  /**
   * Get database service by name
   * Get a database service by the service &#x60;name&#x60;.
   * Note, this is equivalent to the other <code>getByName14</code> method,
   * but with the query parameters collected into a single Map parameter. This
   * is convenient for services with optional query parameters, especially when
   * used with the {@link GetByNameDatabseQueryParams} class that allows for
   * building up this map in a fluent style.
   * @param name  (required)
   * @param queryParams Map of query parameters as name-value pairs
   *   <p>The following elements may be specified in the query map:</p>
   *   <ul>
   *   <li>fields - Fields requested in the returned resource (optional)</li>
   *   <li>include - Include all, deleted, or non-deleted entities. (optional)</li>
   *   </ul>
   * @return DatabaseService

   */
  @RequestLine("GET /v1/services/databaseServices/name/{name}?fields={fields}&include={include}")
  @Headers({
      "Content-Type: */*",
      "Accept: application/json",
  })
  DatabaseService getDatabaseServiceByFQN(@Param("name") String name, @QueryMap(encoded=true) Map<String, Object> queryParams);

  /**
   * A convenience class for generating query parameters for the
   * <code>getByName14</code> method in a fluent style.
   */
  class GetByNameDatabseQueryParams extends HashMap<String, Object> {
    public GetByNameDatabseQueryParams fields(final String value) {
      put("fields", EncodingUtils.encode(value));
      return this;
    }
    public GetByNameDatabseQueryParams include(final String value) {
      put("include", EncodingUtils.encode(value));
      return this;
    }
  }
  /**
   * Get messaging service by name
   * Get a messaging service by the service &#x60;name&#x60;.
   * @param name  (required)
   * @param fields Fields requested in the returned resource (optional)
   * @param include Include all, deleted, or non-deleted entities. (optional)
   * @return MessagingService
   */
  @RequestLine("GET /v1/services/messagingServices/name/{name}?fields={fields}&include={include}")
  @Headers({
      "Accept: application/json",
  })
  MessagingService getMessagingServiceByFQN(@Param("name") String name, @Param("fields") String fields, @Param("include") String include);

  /**
   * Get messaging service by name
   * Get a messaging service by the service &#x60;name&#x60;.
   * Note, this is equivalent to the other <code>getByName16</code> method,
   * but with the query parameters collected into a single Map parameter. This
   * is convenient for services with optional query parameters, especially when
   * used with the {@link GetByNameMessagingQueryParams} class that allows for
   * building up this map in a fluent style.
   * @param name  (required)
   * @param queryParams Map of query parameters as name-value pairs
   *   <p>The following elements may be specified in the query map:</p>
   *   <ul>
   *   <li>fields - Fields requested in the returned resource (optional)</li>
   *   <li>include - Include all, deleted, or non-deleted entities. (optional)</li>
   *   </ul>
   * @return MessagingService

   */
  @RequestLine("GET /v1/services/messagingServices/name/{name}?fields={fields}&include={include}")
  @Headers({
      "Content-Type: */*",
      "Accept: application/json",
  })
  MessagingService getMessagingServiceByFQN(@Param("name") String name, @QueryMap(encoded=true) Map<String, Object> queryParams);

  /**
   * A convenience class for generating query parameters for the
   * <code>getByName16</code> method in a fluent style.
   */
  class GetByNameMessagingQueryParams extends HashMap<String, Object> {
    public GetByNameMessagingQueryParams fields(final String value) {
      put("fields", EncodingUtils.encode(value));
      return this;
    }
    public GetByNameMessagingQueryParams include(final String value) {
      put("include", EncodingUtils.encode(value));
      return this;
    }
  }
  /**
   * Get pipeline service by name
   * Get a pipeline service by the service &#x60;name&#x60;.
   * @param name  (required)
   * @param fields Fields requested in the returned resource (optional)
   * @param include Include all, deleted, or non-deleted entities. (optional)
   * @return PipelineService
   */
  @RequestLine("GET /v1/services/pipelineServices/name/{name}?fields={fields}&include={include}")
  @Headers({
      "Accept: application/json",
  })
  PipelineService getPipelineServiceByFQN(@Param("name") String name, @Param("fields") String fields, @Param("include") String include);

  /**
   * Get pipeline service by name
   * Get a pipeline service by the service &#x60;name&#x60;.
   * Note, this is equivalent to the other <code>getByName17</code> method,
   * but with the query parameters collected into a single Map parameter. This
   * is convenient for services with optional query parameters, especially when
   * used with the {@link GetByNamePipelineQueryParams} class that allows for
   * building up this map in a fluent style.
   * @param name  (required)
   * @param queryParams Map of query parameters as name-value pairs
   *   <p>The following elements may be specified in the query map:</p>
   *   <ul>
   *   <li>fields - Fields requested in the returned resource (optional)</li>
   *   <li>include - Include all, deleted, or non-deleted entities. (optional)</li>
   *   </ul>
   * @return PipelineService

   */
  @RequestLine("GET /v1/services/pipelineServices/name/{name}?fields={fields}&include={include}")
  @Headers({
      "Content-Type: */*",
      "Accept: application/json",
  })
  PipelineService getPipelineServiceByFQN(@Param("name") String name, @QueryMap(encoded=true) Map<String, Object> queryParams);

  /**
   * A convenience class for generating query parameters for the
   * <code>getByName17</code> method in a fluent style.
   */
  class GetByNamePipelineQueryParams extends HashMap<String, Object> {
    public GetByNamePipelineQueryParams fields(final String value) {
      put("fields", EncodingUtils.encode(value));
      return this;
    }
    public GetByNamePipelineQueryParams include(final String value) {
      put("include", EncodingUtils.encode(value));
      return this;
    }
  }
  /**
   * Get storage service by name
   * Get a storage service by the service &#x60;name&#x60;.
   * @param name  (required)
   * @param fields Fields requested in the returned resource (optional)
   * @param include Include all, deleted, or non-deleted entities. (optional)
   * @return StorageService
   */
  @RequestLine("GET /v1/services/storageServices/name/{name}?fields={fields}&include={include}")
  @Headers({
      "Accept: application/json",
  })
  StorageService getStorageServiceByFQN(@Param("name") String name, @Param("fields") String fields, @Param("include") String include);

  /**
   * Get storage service by name
   * Get a storage service by the service &#x60;name&#x60;.
   * Note, this is equivalent to the other <code>getByName18</code> method,
   * but with the query parameters collected into a single Map parameter. This
   * is convenient for services with optional query parameters, especially when
   * used with the {@link GetByNameStorageQueryParams} class that allows for
   * building up this map in a fluent style.
   * @param name  (required)
   * @param queryParams Map of query parameters as name-value pairs
   *   <p>The following elements may be specified in the query map:</p>
   *   <ul>
   *   <li>fields - Fields requested in the returned resource (optional)</li>
   *   <li>include - Include all, deleted, or non-deleted entities. (optional)</li>
   *   </ul>
   * @return StorageService

   */
  @RequestLine("GET /v1/services/storageServices/name/{name}?fields={fields}&include={include}")
  @Headers({
      "Content-Type: */*",
      "Accept: application/json",
  })
  StorageService getStorageServiceByFQN(@Param("name") String name, @QueryMap(encoded=true) Map<String, Object> queryParams);

  /**
   * A convenience class for generating query parameters for the
   * <code>getByName18</code> method in a fluent style.
   */
  class GetByNameStorageQueryParams extends HashMap<String, Object> {
    public GetByNameStorageQueryParams fields(final String value) {
      put("fields", EncodingUtils.encode(value));
      return this;
    }
    public GetByNameStorageQueryParams include(final String value) {
      put("include", EncodingUtils.encode(value));
      return this;
    }
  }
  /**
   * List service collections
   * Get a list of resources under service collection.
   * @return CollectionInfo
   */
  @RequestLine("GET /v1/services")
  @Headers({
      "Accept: application/json",
  })
  ResultList<CollectionDescriptor> getCollections1();
  /**
   * Get a version of the dashboard service
   * Get a version of the dashboard service by given &#x60;id&#x60;
   * @param id dashboard service Id (required)
   * @param version dashboard service version number in the form &#x60;major&#x60;.&#x60;minor&#x60; (required)
   * @return DashboardService
   */
  @RequestLine("GET /v1/services/dashboardServices/{id}/versions/{version}")
  @Headers({
      "Accept: application/json",
  })
  DashboardService getDashboardVersion(@Param("id") String id, @Param("version") String version);
  /**
   * Get a version of the database service
   * Get a version of the database service by given &#x60;id&#x60;
   * @param id database service Id (required)
   * @param version database service version number in the form &#x60;major&#x60;.&#x60;minor&#x60; (required)
   * @return DatabaseService
   */
  @RequestLine("GET /v1/services/databaseServices/{id}/versions/{version}")
  @Headers({
      "Accept: application/json",
  })
  DatabaseService getDatabaseVersion(@Param("id") String id, @Param("version") String version);
  /**
   * Get a version of the messaging service
   * Get a version of the messaging service by given &#x60;id&#x60;
   * @param id messaging service Id (required)
   * @param version messaging service version number in the form &#x60;major&#x60;.&#x60;minor&#x60; (required)
   * @return MessagingService
   */
  @RequestLine("GET /v1/services/messagingServices/{id}/versions/{version}")
  @Headers({
      "Accept: application/json",
  })
  MessagingService getMessagingVersion(@Param("id") String id, @Param("version") String version);
  /**
   * Get a version of the pipeline service
   * Get a version of the pipeline service by given &#x60;id&#x60;
   * @param id pipeline service Id (required)
   * @param version pipeline service version number in the form &#x60;major&#x60;.&#x60;minor&#x60; (required)
   * @return PipelineService
   */
  @RequestLine("GET /v1/services/pipelineServices/{id}/versions/{version}")
  @Headers({
      "Accept: application/json",
  })
  PipelineService getPipelineVersion(@Param("id") String id, @Param("version") String version);
  /**
   * Get a version of the storage service
   * Get a version of the storage service by given &#x60;id&#x60;
   * @param id storage service Id (required)
   * @param version storage service version number in the form &#x60;major&#x60;.&#x60;minor&#x60; (required)
   * @return StorageService
   */
  @RequestLine("GET /v1/services/storageServices/{id}/versions/{version}")
  @Headers({
      "Accept: application/json",
  })
  StorageService getStorageVersion(@Param("id") String id, @Param("version") String version);
  /**
   * List dashboard services
   * Get a list of dashboard services.
   * @param name  (optional)
   * @param fields Fields requested in the returned resource (optional)
   * @param limit  (optional)
   * @param before Returns list of dashboard services before this cursor (optional)
   * @param after Returns list of dashboard services after this cursor (optional)
   * @param include Include all, deleted, or non-deleted entities. (optional)
   * @return DashboardServiceList
   */
  @RequestLine("GET /v1/services/dashboardServices?name={name}&fields={fields}&limit={limit}&before={before}&after={after}&include={include}")
  @Headers({
      "Accept: application/json",
  })
  ResultList<DashboardService> listDashboardServices(@Param("name") String name, @Param("fields") String fields, @Param("limit") Integer limit, @Param("before") String before, @Param("after") String after, @Param("include") String include);

  /**
   * List dashboard services
   * Get a list of dashboard services.
   * Note, this is equivalent to the other <code>list16</code> method,
   * but with the query parameters collected into a single Map parameter. This
   * is convenient for services with optional query parameters, especially when
   * used with the {@link ListDashboardQueryParams} class that allows for
   * building up this map in a fluent style.
   * @param queryParams Map of query parameters as name-value pairs
   *   <p>The following elements may be specified in the query map:</p>
   *   <ul>
   *   <li>name -  (optional)</li>
   *   <li>fields - Fields requested in the returned resource (optional)</li>
   *   <li>limit -  (optional)</li>
   *   <li>before - Returns list of dashboard services before this cursor (optional)</li>
   *   <li>after - Returns list of dashboard services after this cursor (optional)</li>
   *   <li>include - Include all, deleted, or non-deleted entities. (optional)</li>
   *   </ul>
   * @return DashboardServiceList

   */
  @RequestLine("GET /v1/services/dashboardServices?name={name}&fields={fields}&limit={limit}&before={before}&after={after}&include={include}")
  @Headers({
      "Content-Type: */*",
      "Accept: application/json",
  })
  ResultList<DashboardService> listDashboardServices(@QueryMap(encoded=true) Map<String, Object> queryParams);

  /**
   * A convenience class for generating query parameters for the
   * <code>list16</code> method in a fluent style.
   */
  class ListDashboardQueryParams extends HashMap<String, Object> {
    public ListDashboardQueryParams name(final String value) {
      put("name", EncodingUtils.encode(value));
      return this;
    }
    public ListDashboardQueryParams fields(final String value) {
      put("fields", EncodingUtils.encode(value));
      return this;
    }
    public ListDashboardQueryParams limit(final Integer value) {
      put("limit", EncodingUtils.encode(value));
      return this;
    }
    public ListDashboardQueryParams before(final String value) {
      put("before", EncodingUtils.encode(value));
      return this;
    }
    public ListDashboardQueryParams after(final String value) {
      put("after", EncodingUtils.encode(value));
      return this;
    }
    public ListDashboardQueryParams include(final String value) {
      put("include", EncodingUtils.encode(value));
      return this;
    }
  }
  /**
   * List database services
   * Get a list of database services.
   * @param fields Fields requested in the returned resource (optional)
   * @param limit  (optional)
   * @param before Returns list of database services before this cursor (optional)
   * @param after Returns list of database services after this cursor (optional)
   * @param include Include all, deleted, or non-deleted entities. (optional)
   * @return DatabaseServiceList
   */
  @RequestLine("GET /v1/services/databaseServices?fields={fields}&limit={limit}&before={before}&after={after}&include={include}")
  @Headers({
      "Accept: application/json",
  })
  ResultList<DatabaseService> listDatabaseServices(@Param("fields") String fields, @Param("limit") Integer limit, @Param("before") String before, @Param("after") String after, @Param("include") String include);

  /**
   * List database services
   * Get a list of database services.
   * Note, this is equivalent to the other <code>list17</code> method,
   * but with the query parameters collected into a single Map parameter. This
   * is convenient for services with optional query parameters, especially when
   * used with the {@link ListDatabaseQueryParams} class that allows for
   * building up this map in a fluent style.
   * @param queryParams Map of query parameters as name-value pairs
   *   <p>The following elements may be specified in the query map:</p>
   *   <ul>
   *   <li>fields - Fields requested in the returned resource (optional)</li>
   *   <li>limit -  (optional)</li>
   *   <li>before - Returns list of database services before this cursor (optional)</li>
   *   <li>after - Returns list of database services after this cursor (optional)</li>
   *   <li>include - Include all, deleted, or non-deleted entities. (optional)</li>
   *   </ul>
   * @return DatabaseServiceList

   */
  @RequestLine("GET /v1/services/databaseServices?fields={fields}&limit={limit}&before={before}&after={after}&include={include}")
  @Headers({
      "Content-Type: */*",
      "Accept: application/json",
  })
  ResultList<DatabaseService> listDatabaseServices(@QueryMap(encoded=true) Map<String, Object> queryParams);

  /**
   * A convenience class for generating query parameters for the
   * <code>list17</code> method in a fluent style.
   */
  class ListDatabaseQueryParams extends HashMap<String, Object> {
    public ListDatabaseQueryParams fields(final String value) {
      put("fields", EncodingUtils.encode(value));
      return this;
    }
    public ListDatabaseQueryParams limit(final Integer value) {
      put("limit", EncodingUtils.encode(value));
      return this;
    }
    public ListDatabaseQueryParams before(final String value) {
      put("before", EncodingUtils.encode(value));
      return this;
    }
    public ListDatabaseQueryParams after(final String value) {
      put("after", EncodingUtils.encode(value));
      return this;
    }
    public ListDatabaseQueryParams include(final String value) {
      put("include", EncodingUtils.encode(value));
      return this;
    }
  }
  /**
   * List messaging services
   * Get a list of messaging services. Use cursor-based pagination to limit the number entries in the list using &#x60;limit&#x60; and &#x60;before&#x60; or &#x60;after&#x60; query params.
   * @param fields Fields requested in the returned resource (optional)
   * @param limit Limit number services returned. (1 to 1000000, default 10) (optional)
   * @param before Returns list of services before this cursor (optional)
   * @param after Returns list of services after this cursor (optional)
   * @param include Include all, deleted, or non-deleted entities. (optional)
   * @return MessagingServiceList
   */
  @RequestLine("GET /v1/services/messagingServices?fields={fields}&limit={limit}&before={before}&after={after}&include={include}")
  @Headers({
      "Accept: application/json",
  })
  ResultList<MessagingService> listMessagingServices(@Param("fields") String fields, @Param("limit") Integer limit, @Param("before") String before, @Param("after") String after, @Param("include") String include);

  /**
   * List messaging services
   * Get a list of messaging services. Use cursor-based pagination to limit the number entries in the list using &#x60;limit&#x60; and &#x60;before&#x60; or &#x60;after&#x60; query params.
   * Note, this is equivalent to the other <code>list19</code> method,
   * but with the query parameters collected into a single Map parameter. This
   * is convenient for services with optional query parameters, especially when
   * used with the {@link ListMessagingQueryParams} class that allows for
   * building up this map in a fluent style.
   * @param queryParams Map of query parameters as name-value pairs
   *   <p>The following elements may be specified in the query map:</p>
   *   <ul>
   *   <li>fields - Fields requested in the returned resource (optional)</li>
   *   <li>limit - Limit number services returned. (1 to 1000000, default 10) (optional)</li>
   *   <li>before - Returns list of services before this cursor (optional)</li>
   *   <li>after - Returns list of services after this cursor (optional)</li>
   *   <li>include - Include all, deleted, or non-deleted entities. (optional)</li>
   *   </ul>
   * @return MessagingServiceList

   */
  @RequestLine("GET /v1/services/messagingServices?fields={fields}&limit={limit}&before={before}&after={after}&include={include}")
  @Headers({
      "Content-Type: */*",
      "Accept: application/json",
  })
  ResultList<MessagingService> listMessagingServices(@QueryMap(encoded=true) Map<String, Object> queryParams);

  /**
   * A convenience class for generating query parameters for the
   * <code>list19</code> method in a fluent style.
   */
  class ListMessagingQueryParams extends HashMap<String, Object> {
    public ListMessagingQueryParams fields(final String value) {
      put("fields", EncodingUtils.encode(value));
      return this;
    }
    public ListMessagingQueryParams limit(final Integer value) {
      put("limit", EncodingUtils.encode(value));
      return this;
    }
    public ListMessagingQueryParams before(final String value) {
      put("before", EncodingUtils.encode(value));
      return this;
    }
    public ListMessagingQueryParams after(final String value) {
      put("after", EncodingUtils.encode(value));
      return this;
    }
    public ListMessagingQueryParams include(final String value) {
      put("include", EncodingUtils.encode(value));
      return this;
    }
  }
  /**
   * List pipeline services
   * Get a list of pipeline services. Use cursor-based pagination to limit the number entries in the list using &#x60;limit&#x60; and &#x60;before&#x60; or &#x60;after&#x60; query params.
   * @param fields Fields requested in the returned resource (optional)
   * @param limit Limit number services returned. (1 to 1000000, default 10) (optional)
   * @param before Returns list of services before this cursor (optional)
   * @param after Returns list of services after this cursor (optional)
   * @param include Include all, deleted, or non-deleted entities. (optional)
   * @return PipelineServiceList
   */
  @RequestLine("GET /v1/services/pipelineServices?fields={fields}&limit={limit}&before={before}&after={after}&include={include}")
  @Headers({
      "Accept: application/json",
  })
  ResultList<PipelineService> listPipelineServices(@Param("fields") String fields, @Param("limit") Integer limit, @Param("before") String before, @Param("after") String after, @Param("include") String include);

  /**
   * List pipeline services
   * Get a list of pipeline services. Use cursor-based pagination to limit the number entries in the list using &#x60;limit&#x60; and &#x60;before&#x60; or &#x60;after&#x60; query params.
   * Note, this is equivalent to the other <code>list20</code> method,
   * but with the query parameters collected into a single Map parameter. This
   * is convenient for services with optional query parameters, especially when
   * used with the {@link ListPipelineQueryParams} class that allows for
   * building up this map in a fluent style.
   * @param queryParams Map of query parameters as name-value pairs
   *   <p>The following elements may be specified in the query map:</p>
   *   <ul>
   *   <li>fields - Fields requested in the returned resource (optional)</li>
   *   <li>limit - Limit number services returned. (1 to 1000000, default 10) (optional)</li>
   *   <li>before - Returns list of services before this cursor (optional)</li>
   *   <li>after - Returns list of services after this cursor (optional)</li>
   *   <li>include - Include all, deleted, or non-deleted entities. (optional)</li>
   *   </ul>
   * @return PipelineServiceList

   */
  @RequestLine("GET /v1/services/pipelineServices?fields={fields}&limit={limit}&before={before}&after={after}&include={include}")
  @Headers({
      "Content-Type: */*",
      "Accept: application/json",
  })
  ResultList<PipelineService> listPipelineServices(@QueryMap(encoded=true) Map<String, Object> queryParams);

  /**
   * A convenience class for generating query parameters for the
   * <code>list20</code> method in a fluent style.
   */
  class ListPipelineQueryParams extends HashMap<String, Object> {
    public ListPipelineQueryParams fields(final String value) {
      put("fields", EncodingUtils.encode(value));
      return this;
    }
    public ListPipelineQueryParams limit(final Integer value) {
      put("limit", EncodingUtils.encode(value));
      return this;
    }
    public ListPipelineQueryParams before(final String value) {
      put("before", EncodingUtils.encode(value));
      return this;
    }
    public ListPipelineQueryParams after(final String value) {
      put("after", EncodingUtils.encode(value));
      return this;
    }
    public ListPipelineQueryParams include(final String value) {
      put("include", EncodingUtils.encode(value));
      return this;
    }
  }
  /**
   * List storage services
   * Get a list of storage services. Use cursor-based pagination to limit the number entries in the list using &#x60;limit&#x60; and &#x60;before&#x60; or &#x60;after&#x60; query params.
   * @param fields Fields requested in the returned resource (optional)
   * @param limit Limit number of services returned. (1 to 1000000, default 10) (optional)
   * @param before Returns list of services before this cursor (optional)
   * @param after Returns list of services after this cursor (optional)
   * @param include Include all, deleted, or non-deleted entities. (optional)
   * @return StorageServiceList
   */
  @RequestLine("GET /v1/services/storageServices?fields={fields}&limit={limit}&before={before}&after={after}&include={include}")
  @Headers({
      "Accept: application/json",
  })
  ResultList<StorageService> listStorageServices(@Param("fields") String fields, @Param("limit") Integer limit, @Param("before") String before, @Param("after") String after, @Param("include") String include);

  /**
   * List storage services
   * Get a list of storage services. Use cursor-based pagination to limit the number entries in the list using &#x60;limit&#x60; and &#x60;before&#x60; or &#x60;after&#x60; query params.
   * Note, this is equivalent to the other <code>list21</code> method,
   * but with the query parameters collected into a single Map parameter. This
   * is convenient for services with optional query parameters, especially when
   * used with the {@link ListStorageQueryParams} class that allows for
   * building up this map in a fluent style.
   * @param queryParams Map of query parameters as name-value pairs
   *   <p>The following elements may be specified in the query map:</p>
   *   <ul>
   *   <li>fields - Fields requested in the returned resource (optional)</li>
   *   <li>limit - Limit number of services returned. (1 to 1000000, default 10) (optional)</li>
   *   <li>before - Returns list of services before this cursor (optional)</li>
   *   <li>after - Returns list of services after this cursor (optional)</li>
   *   <li>include - Include all, deleted, or non-deleted entities. (optional)</li>
   *   </ul>
   * @return StorageServiceList

   */
  @RequestLine("GET /v1/services/storageServices?fields={fields}&limit={limit}&before={before}&after={after}&include={include}")
  @Headers({
      "Content-Type: */*",
      "Accept: application/json",
  })
  ResultList<StorageService> listStorageServices(@QueryMap(encoded=true) Map<String, Object> queryParams);

  /**
   * A convenience class for generating query parameters for the
   * <code>list21</code> method in a fluent style.
   */
  class ListStorageQueryParams extends HashMap<String, Object> {
    public ListStorageQueryParams fields(final String value) {
      put("fields", EncodingUtils.encode(value));
      return this;
    }
    public ListStorageQueryParams limit(final Integer value) {
      put("limit", EncodingUtils.encode(value));
      return this;
    }
    public ListStorageQueryParams before(final String value) {
      put("before", EncodingUtils.encode(value));
      return this;
    }
    public ListStorageQueryParams after(final String value) {
      put("after", EncodingUtils.encode(value));
      return this;
    }
    public ListStorageQueryParams include(final String value) {
      put("include", EncodingUtils.encode(value));
      return this;
    }
  }
  /**
   * List dashboard service versions
   * Get a list of all the versions of a dashboard service identified by &#x60;id&#x60;
   * @param id dashboard service Id (required)
   * @return EntityHistory
   */
  @RequestLine("GET /v1/services/dashboardServices/{id}/versions")
  @Headers({
      "Accept: application/json",
  })
  EntityHistory listDashboardVersions(@Param("id") String id);
  /**
   * List database service versions
   * Get a list of all the versions of a database service identified by &#x60;id&#x60;
   * @param id database service Id (required)
   * @return EntityHistory
   */
  @RequestLine("GET /v1/services/databaseServices/{id}/versions")
  @Headers({
      "Accept: application/json",
  })
  EntityHistory listDatabaseVersions(@Param("id") String id);
  /**
   * List messaging service versions
   * Get a list of all the versions of a messaging service identified by &#x60;id&#x60;
   * @param id messaging service Id (required)
   * @return EntityHistory
   */
  @RequestLine("GET /v1/services/messagingServices/{id}/versions")
  @Headers({
      "Accept: application/json",
  })
  EntityHistory listMessagingVersions(@Param("id") String id);
  /**
   * List pipeline service versions
   * Get a list of all the versions of a pipeline service identified by &#x60;id&#x60;
   * @param id pipeline service Id (required)
   * @return EntityHistory
   */
  @RequestLine("GET /v1/services/pipelineServices/{id}/versions")
  @Headers({
      "Accept: application/json",
  })
  EntityHistory listPiplineVersions(@Param("id") String id);
  /**
   * List storage service versions
   * Get a list of all the versions of a storage service identified by &#x60;id&#x60;
   * @param id storage service Id (required)
   * @return EntityHistory
   */
  @RequestLine("GET /v1/services/storageServices/{id}/versions")
  @Headers({
      "Accept: application/json",
  })
  EntityHistory listStorageVersions(@Param("id") String id);
}

package org.openmetada.restclient.api;

import org.openmetada.restclient.ApiClient;

import org.openmetada.restclient.model.*;
import org.openmetada.restclient.util.ResultList;
import org.openmetadata.catalog.type.CollectionDescriptor;
import org.openmetadata.catalog.api.CatalogVersion;
import feign.*;

public interface GeneralApi extends ApiClient.Api {

  /**
   * Get airflow configuration
   * 
   * @return AirflowConfigurationForAPI
   */
  @RequestLine("GET /v1/config/airflow")
  @Headers({
      "Accept: application/json",
  })
  AirflowConfigurationForAPI getAirflowConfig();
  /**
   * Get auth configuration
   * 
   * @return AuthenticationConfiguration
   */
  @RequestLine("GET /v1/config/auth")
  @Headers({
      "Accept: application/json",
  })
  AuthenticationConfiguration getAuthConfig();
  /**
   * Get authorizer configuration
   * 
   * @return AuthorizerConfiguration
   */
  @RequestLine("GET /v1/config/authorizer")
  @Headers({
      "Accept: application/json",
  })
  AuthorizerConfiguration getAuthorizerConfig();
  /**
   * Get version of metadata service
   * Get the build version of OpenMetadata service and build timestamp.
   * @return CatalogVersion
   */
  @RequestLine("GET /v1/version")
  @Headers({
      "Accept: application/json",
  })
  CatalogVersion getCatalogVersion();
  /**
   * List all collections
   * List all the collections supported by OpenMetadata. This list provides all the collections and resource REST endpoints.
   * @return CollectionList
   */
  @RequestLine("GET /v1")
  @Headers({
      "Accept: application/json",
  })
  ResultList<CollectionDescriptor> getCollections();
  /**
   * Get permissions for logged in user
   * 
   * @return Permissions
   */
  @RequestLine("GET /v1/permissions")
  @Headers({
      "Accept: application/json",
  })
  Permissions getPermissions();
  /**
   * Get sandbox mode
   * 
   * @return SandboxConfiguration
   */
  @RequestLine("GET /v1/config/sandbox")
  @Headers({
      "Accept: application/json",
  })
  SandboxConfiguration getSandboxMode();
}

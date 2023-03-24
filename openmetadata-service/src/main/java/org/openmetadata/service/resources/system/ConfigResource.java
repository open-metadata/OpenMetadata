/*
 *  Copyright 2021 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

package org.openmetadata.service.resources.system;

import io.swagger.annotations.Api;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import javax.ws.rs.GET;
import javax.ws.rs.Path;
import javax.ws.rs.Produces;
import javax.ws.rs.core.MediaType;
import org.openmetadata.api.configuration.ApplicationConfiguration;
import org.openmetadata.catalog.security.client.SamlSSOClientConfig;
import org.openmetadata.catalog.type.IdentityProviderConfig;
import org.openmetadata.schema.api.security.AuthenticationConfiguration;
import org.openmetadata.schema.api.security.AuthorizerConfiguration;
import org.openmetadata.service.OpenMetadataApplicationConfig;
import org.openmetadata.service.clients.pipeline.PipelineServiceAPIClientConfig;
import org.openmetadata.service.resources.Collection;
import org.openmetadata.service.security.jwt.JWKSResponse;
import org.openmetadata.service.security.jwt.JWTTokenGenerator;

@Path("/v1/system/config")
@Api(value = "System configuration APIs")
@Produces(MediaType.APPLICATION_JSON)
@Collection(name = "config")
public class ConfigResource {
  private OpenMetadataApplicationConfig openMetadataApplicationConfig;
  private final JWTTokenGenerator jwtTokenGenerator;

  public ConfigResource() {
    this.jwtTokenGenerator = JWTTokenGenerator.getInstance();
  }

  public void initialize(OpenMetadataApplicationConfig config) {
    this.openMetadataApplicationConfig = config;
  }

  @GET
  @Path(("/auth"))
  @Operation(
      operationId = "getAuthConfiguration",
      summary = "Get auth configuration",
      tags = "system",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Auth configuration",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = AuthenticationConfiguration.class)))
      })
  public AuthenticationConfiguration getAuthConfig() {
    AuthenticationConfiguration authenticationConfiguration = new AuthenticationConfiguration();
    if (openMetadataApplicationConfig.getAuthenticationConfiguration() != null) {
      authenticationConfiguration = openMetadataApplicationConfig.getAuthenticationConfiguration();
      // Remove Ldap Configuration
      authenticationConfiguration.setLdapConfiguration(null);

      // Remove Saml Fields
      SamlSSOClientConfig ssoClientConfig = new SamlSSOClientConfig();
      ssoClientConfig.setIdp(
          new IdentityProviderConfig()
              .withAuthorityUrl(authenticationConfiguration.getSamlConfiguration().getIdp().getAuthorityUrl()));
      authenticationConfiguration.setSamlConfiguration(ssoClientConfig);
    }
    return authenticationConfiguration;
  }

  @GET
  @Path(("/authorizer"))
  @Operation(
      operationId = "getAuthorizerConfig",
      summary = "Get authorizer configuration",
      tags = "system",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Authorizer configuration",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = AuthorizerConfiguration.class)))
      })
  public AuthorizerConfiguration getAuthorizerConfig() {
    AuthorizerConfiguration authorizerConfiguration = new AuthorizerConfiguration();
    if (openMetadataApplicationConfig.getAuthorizerConfiguration() != null) {
      authorizerConfiguration = openMetadataApplicationConfig.getAuthorizerConfiguration();
    }
    return authorizerConfiguration;
  }

  @GET
  @Path(("/applicationConfig"))
  @Operation(
      operationId = "getApplicationConfiguration",
      summary = "Get application configuration",
      tags = "system",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Get application configuration",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = ApplicationConfiguration.class)))
      })
  public ApplicationConfiguration getApplicationConfiguration() {
    return openMetadataApplicationConfig.getApplicationConfiguration();
  }

  @GET
  @Path(("/pipeline-service-client"))
  @Operation(
      operationId = "getAirflowConfiguration",
      summary = "Get airflow configuration",
      tags = "system",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Airflow configuration",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = PipelineServiceAPIClientConfig.class)))
      })
  public PipelineServiceAPIClientConfig getPipelineServiceConfig() {
    PipelineServiceAPIClientConfig pipelineServiceClientConfigForAPI = new PipelineServiceAPIClientConfig();
    if (openMetadataApplicationConfig.getPipelineServiceClientConfiguration() != null) {
      pipelineServiceClientConfigForAPI.setApiEndpoint(
          openMetadataApplicationConfig.getPipelineServiceClientConfiguration().getApiEndpoint());
    }
    return pipelineServiceClientConfigForAPI;
  }

  @GET
  @Path(("/jwks"))
  @Operation(
      operationId = "getJWKSResponse",
      summary = "Get JWKS public key",
      tags = "system",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "JWKS public key",
            content = @Content(mediaType = "application/json", schema = @Schema(implementation = JWKSResponse.class)))
      })
  public JWKSResponse getJWKSResponse() {
    return jwtTokenGenerator.getJWKSResponse();
  }
}

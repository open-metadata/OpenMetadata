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

import io.swagger.v3.oas.annotations.Hidden;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;
import java.util.HashMap;
import java.util.Map;
import org.openmetadata.api.configuration.UiThemePreference;
import org.openmetadata.catalog.security.client.SamlSSOClientConfig;
import org.openmetadata.catalog.type.IdentityProviderConfig;
import org.openmetadata.schema.api.configuration.LoginConfiguration;
import org.openmetadata.schema.api.security.AuthenticationConfiguration;
import org.openmetadata.schema.api.security.AuthorizerConfiguration;
import org.openmetadata.schema.settings.SettingsType;
import org.openmetadata.service.OpenMetadataApplicationConfig;
import org.openmetadata.service.clients.pipeline.PipelineServiceAPIClientConfig;
import org.openmetadata.service.resources.Collection;
import org.openmetadata.service.resources.settings.SettingsCache;
import org.openmetadata.service.security.auth.SecurityConfigurationManager;
import org.openmetadata.service.security.jwt.JWKSResponse;
import org.openmetadata.service.security.jwt.JWTTokenGenerator;

@Path("/v1/system/config")
@Tag(name = "System", description = "APIs related to System configuration and settings.")
@Hidden
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
  @Produces(MediaType.APPLICATION_JSON)
  public Map<String, String> getConfig() {
    Map<String, String> config = new HashMap<>();
    config.put("basePath", openMetadataApplicationConfig.getBasePath());
    return config;
  }

  @GET
  @Path(("/auth"))
  @Operation(
      operationId = "getAuthConfiguration",
      summary = "Get auth configuration",
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
    if (SecurityConfigurationManager.getInstance().getCurrentAuthConfig() != null) {
      authenticationConfiguration =
          SecurityConfigurationManager.getInstance().getCurrentAuthConfig();
      // Remove Ldap Configuration
      authenticationConfiguration.setLdapConfiguration(null);

      if (authenticationConfiguration.getSamlConfiguration() != null) {
        // Remove Saml Fields
        SamlSSOClientConfig ssoClientConfig = new SamlSSOClientConfig();
        ssoClientConfig.setIdp(
            new IdentityProviderConfig()
                .withAuthorityUrl(
                    authenticationConfiguration.getSamlConfiguration().getIdp().getAuthorityUrl()));
        authenticationConfiguration.setSamlConfiguration(ssoClientConfig);
      }

      authenticationConfiguration.setOidcConfiguration(null);
    }
    return authenticationConfiguration;
  }

  @GET
  @Path(("/customUiThemePreference"))
  @Operation(
      operationId = "getCustomUiThemePreference",
      summary = "Get Custom Ui Theme Preference",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "UI Theme Configuration as per Preference",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = AuthenticationConfiguration.class)))
      })
  public UiThemePreference getCustomUiThemePreference() {
    return SettingsCache.getSetting(
        SettingsType.CUSTOM_UI_THEME_PREFERENCE, UiThemePreference.class);
  }

  @GET
  @Path(("/authorizer"))
  @Operation(
      operationId = "getAuthorizerConfig",
      summary = "Get authorizer configuration",
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
  @Path(("/loginConfig"))
  @Operation(
      operationId = "getLoginConfiguration",
      summary = "Get Login configuration",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Get Login configuration",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = LoginConfiguration.class)))
      })
  public LoginConfiguration getLoginConfiguration() {
    return SettingsCache.getSetting(SettingsType.LOGIN_CONFIGURATION, LoginConfiguration.class);
  }

  @GET
  @Path(("/pipeline-service-client"))
  @Operation(
      operationId = "getPipelineServiceConfiguration",
      summary = "Get Pipeline Service Client configuration",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Pipeline Service Client configuration",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = PipelineServiceAPIClientConfig.class)))
      })
  public PipelineServiceAPIClientConfig getPipelineServiceConfig() {
    PipelineServiceAPIClientConfig pipelineServiceClientConfigForAPI =
        new PipelineServiceAPIClientConfig();
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
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "JWKS public key",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = JWKSResponse.class)))
      })
  public JWKSResponse getJWKSResponse() {
    return jwtTokenGenerator.getJWKSResponse();
  }
}

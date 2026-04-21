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
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.FormParam;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.Context;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import java.util.HashMap;
import java.util.Map;
import org.openmetadata.api.configuration.UiThemePreference;
import org.openmetadata.catalog.security.client.SamlSSOClientConfig;
import org.openmetadata.catalog.type.IdentityProviderConfig;
import org.openmetadata.schema.api.configuration.LoginConfiguration;
import org.openmetadata.schema.api.security.AuthenticationConfiguration;
import org.openmetadata.schema.api.security.AuthorizerConfiguration;
import org.openmetadata.schema.services.connections.metadata.AuthProvider;
import org.openmetadata.schema.settings.SettingsType;
import org.openmetadata.service.OpenMetadataApplicationConfig;
import org.openmetadata.service.clients.pipeline.PipelineServiceAPIClientConfig;
import org.openmetadata.service.resources.Collection;
import org.openmetadata.service.resources.settings.SettingsCache;
import org.openmetadata.service.security.auth.SecurityConfigurationManager;
import org.openmetadata.service.security.auth.TestLdapHandler;
import org.openmetadata.service.security.auth.TestLoginHandler;
import org.openmetadata.service.security.auth.TestSamlHandler;
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
  @Path(("/rdf"))
  @Produces(MediaType.APPLICATION_JSON)
  public Map<String, Object> getConfig() {
    Map<String, Object> config = new HashMap<>();
    config.put("basePath", openMetadataApplicationConfig.getBasePath());

    // Add RDF configuration
    if (openMetadataApplicationConfig.getRdfConfiguration() != null) {
      config.put("rdfEnabled", openMetadataApplicationConfig.getRdfConfiguration().getEnabled());
    } else {
      config.put("rdfEnabled", false);
    }

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
    AuthenticationConfiguration responseAuthConfig = new AuthenticationConfiguration();
    AuthenticationConfiguration yamlConfig = SecurityConfigurationManager.getCurrentAuthConfig();
    if (SecurityConfigurationManager.getCurrentAuthConfig() != null) {
      responseAuthConfig.setProvider(yamlConfig.getProvider());
      responseAuthConfig.setProviderName(yamlConfig.getProviderName());
      responseAuthConfig.setClientType(yamlConfig.getClientType());
      responseAuthConfig.setEnableSelfSignup(yamlConfig.getEnableSelfSignup());
      responseAuthConfig.setEnableAutoRedirect(yamlConfig.getEnableAutoRedirect());
      responseAuthConfig.setJwtPrincipalClaims(yamlConfig.getJwtPrincipalClaims());
      responseAuthConfig.setJwtPrincipalClaimsMapping(yamlConfig.getJwtPrincipalClaimsMapping());
      responseAuthConfig.setClientId(yamlConfig.getClientId());
      responseAuthConfig.setAuthority(yamlConfig.getAuthority());
      responseAuthConfig.setCallbackUrl(yamlConfig.getCallbackUrl());
      if (responseAuthConfig.getProvider().equals(AuthProvider.SAML)
          && yamlConfig.getSamlConfiguration() != null) {
        // Remove Saml Fields
        SamlSSOClientConfig ssoClientConfig = new SamlSSOClientConfig();
        ssoClientConfig.setIdp(new IdentityProviderConfig());
        responseAuthConfig.setSamlConfiguration(ssoClientConfig);
      } else {
        responseAuthConfig.setSamlConfiguration(null);
      }
      responseAuthConfig.setLdapConfiguration(null);
      responseAuthConfig.setOidcConfiguration(null);
    }
    return responseAuthConfig;
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
    AuthorizerConfiguration responseAuthorizerConfig = new AuthorizerConfiguration();
    AuthorizerConfiguration yamlConfig = openMetadataApplicationConfig.getAuthorizerConfiguration();
    if (yamlConfig != null) {
      responseAuthorizerConfig.setPrincipalDomain(yamlConfig.getPrincipalDomain());
    }
    return responseAuthorizerConfig;
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

  @POST
  @Path("/auth/test-login/initiate")
  @Consumes(MediaType.APPLICATION_FORM_URLENCODED)
  @Operation(
      operationId = "testLoginInitiate",
      summary = "Initiate OIDC Test Login",
      description =
          "Initiates an OIDC Test Login flow by redirecting to the IdP. "
              + "Accepts form-encoded body so secrets stay out of the URL. "
              + "Opens in a popup window via hidden form POST with target=_blank.")
  public Response testLoginInitiate(
      @Context HttpServletRequest request,
      @FormParam("discoveryUri") String discoveryUri,
      @FormParam("clientId") String clientId,
      @FormParam("clientSecret") String clientSecret,
      @FormParam("scope") String scope,
      @FormParam("callbackUrl") String callbackUrl,
      @FormParam("prompt") String prompt,
      @FormParam("maxAge") String maxAge,
      @FormParam("clientAuthenticationMethod") String clientAuthMethod,
      @FormParam("disablePkce") String disablePkce,
      @FormParam("useNonce") String useNonce,
      @FormParam("customParams") String customParams) {
    return TestLoginHandler.handleInitiate(
        request, discoveryUri, clientId, clientSecret, scope, callbackUrl,
        prompt, maxAge, clientAuthMethod, disablePkce, useNonce, customParams);
  }

  @POST
  @Path("/auth/test-login/saml-initiate")
  @Consumes(MediaType.APPLICATION_FORM_URLENCODED)
  @Operation(
      operationId = "samlTestLoginInitiate",
      summary = "Initiate SAML Test Login",
      description =
          "Initiates a SAML Test Login flow by redirecting the browser to the IdP SSO URL "
              + "with a SAML AuthnRequest. Expects form-encoded body with idpEntityId, "
              + "idpSsoLoginUrl, idpX509Certificate, spEntityId, spAcsUrl, nameIdFormat. "
              + "Browser is typically navigated to this endpoint via a hidden form POST "
              + "with target=_blank so the response 302 loads inside the popup.")
  public Response samlTestLoginInitiate(
      @Context HttpServletRequest request,
      @Context HttpServletResponse response,
      @FormParam("idpEntityId") String idpEntityId,
      @FormParam("idpSsoLoginUrl") String idpSsoLoginUrl,
      @FormParam("idpX509Certificate") String idpX509Certificate,
      @FormParam("spEntityId") String spEntityId,
      @FormParam("spAcsUrl") String spAcsUrl,
      @FormParam("nameIdFormat") String nameIdFormat) {
    return TestSamlHandler.handleInitiate(
        request,
        response,
        idpEntityId,
        idpSsoLoginUrl,
        idpX509Certificate,
        spEntityId,
        spAcsUrl,
        nameIdFormat);
  }

  @POST
  @Path("/auth/test-login")
  @Operation(
      operationId = "testLoginLdap",
      summary = "Test Login (LDAP) — saved config",
      description =
          "Tests LDAP authentication using the SAVED LDAP configuration. "
              + "For pre-save LDAP Test Login, use /auth/test-login/ldap-initiate instead.")
  public Response testLoginLdap(Map<String, String> credentials) {
    String email = credentials.get("email");
    String password = credentials.get("password");
    Map<String, Object> result = TestLoginHandler.handleLdapTestLogin(email, password);

    return Response.ok(result).build();
  }

  @POST
  @Path("/auth/test-login/ldap-initiate")
  @Consumes(MediaType.APPLICATION_JSON)
  @Operation(
      operationId = "ldapTestLoginInitiate",
      summary = "Initiate LDAP Test Login (pre-save)",
      description =
          "Tests LDAP authentication using form-provided configuration — does not rely on "
              + "saved state. Accepts { ldapConfiguration, email, password } as JSON body. "
              + "Binds as admin, searches for the user by mailAttributeName, binds as the user "
              + "to verify password, and returns the derived email + domain + admin principal.")
  public Response ldapTestLoginInitiate(LdapTestLoginRequest body) {
    if (body == null || body.getLdapConfiguration() == null) {
      return Response.status(Response.Status.BAD_REQUEST)
          .entity(Map.of("success", false, "error", "ldapConfiguration is required"))
          .build();
    }
    Map<String, Object> result =
        TestLdapHandler.handleLdapTestLogin(
            body.getLdapConfiguration(), body.getEmail(), body.getPassword());
    return Response.ok(result).build();
  }

  public static class LdapTestLoginRequest {
    private org.openmetadata.schema.auth.LdapConfiguration ldapConfiguration;
    private String email;
    private String password;

    public org.openmetadata.schema.auth.LdapConfiguration getLdapConfiguration() {
      return ldapConfiguration;
    }

    public void setLdapConfiguration(
        org.openmetadata.schema.auth.LdapConfiguration ldapConfiguration) {
      this.ldapConfiguration = ldapConfiguration;
    }

    public String getEmail() {
      return email;
    }

    public void setEmail(String email) {
      this.email = email;
    }

    public String getPassword() {
      return password;
    }

    public void setPassword(String password) {
      this.password = password;
    }
  }
}

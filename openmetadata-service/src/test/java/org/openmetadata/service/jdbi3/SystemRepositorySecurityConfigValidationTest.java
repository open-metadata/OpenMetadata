/*
 *  Copyright 2026 Collate.
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
package org.openmetadata.service.jdbi3;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;

import java.util.List;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.MockedStatic;
import org.openmetadata.schema.configuration.SecurityConfiguration;
import org.openmetadata.schema.services.connections.metadata.AuthProvider;
import org.openmetadata.schema.system.FieldError;
import org.openmetadata.schema.system.SecurityValidationResponse;
import org.openmetadata.schema.system.SecurityValidationResponse.Status;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.OpenMetadataApplicationConfig;
import org.openmetadata.service.migration.MigrationValidationClient;
import org.openmetadata.service.util.ValidationErrorBuilder.FieldPaths;
import org.openmetadata.service.util.ValidationHttpUtil;
import org.openmetadata.service.util.ValidationHttpUtil.HttpResponseData;

/**
 * Validates security configurations in the shape deployments store them. On first boot {@code
 * SettingsCache} persists the openmetadata.yaml defaults as they are, so a provider configured
 * through environment variables keeps an empty {@code providerName} and the yaml's placeholder
 * {@code oidcConfiguration}, and an Azure deployment that followed the docs lists Azure's
 * multi-tenant JWKS endpoint. Only the identity provider's HTTP endpoints are stubbed.
 */
class SystemRepositorySecurityConfigValidationTest {
  private static final String AZURE_LOGIN = "https://login.microsoftonline.com/";
  private static final String TENANT_ID = "8f1c2a4b-1d2e-4f3a-9b8c-7d6e5f4a3b2c";
  private static final String CLIENT_ID = "0a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d";
  private static final String AZURE_COMMON_JWKS = AZURE_LOGIN + "common/discovery/keys";
  private static final String OPENMETADATA_JWKS =
      "https://openmetadata.example.com/api/v1/system/config/jwks";
  private static final String JWKS = "{\"keys\":[{\"kty\":\"RSA\",\"kid\":\"signing-key\"}]}";

  /** The Azure public-client setup from the deployment docs, as SettingsCache stores it. */
  private static final String DOCUMENTED_AZURE_PUBLIC_CLIENT =
      """
      {
        "authenticationConfiguration": {
          "clientType": "public",
          "provider": "azure",
          "responseType": "id_token",
          "providerName": "",
          "publicKeyUrls": ["%s", "%s"],
          "tokenValidationAlgorithm": "RS256",
          "authority": "%s%s",
          "clientId": "%s",
          "callbackUrl": "https://openmetadata.example.com/callback",
          "emailClaim": "",
          "jwtPrincipalClaims": ["email", "preferred_username", "sub"],
          "jwtPrincipalClaimsMapping": [],
          "enableSelfSignup": true,
          "oidcConfiguration": {
            "id": "",
            "type": "",
            "secret": "",
            "scope": "openid email profile",
            "discoveryUri": "",
            "useNonce": "true",
            "preferredJwsAlgorithm": "RS256",
            "responseType": "code",
            "disablePkce": true,
            "callbackUrl": "http://localhost:8585/callback",
            "serverUrl": "http://localhost:8585",
            "clientAuthenticationMethod": "client_secret_post",
            "tenant": "",
            "maxClockSkew": "",
            "tokenValidity": 3600,
            "maxAge": "",
            "prompt": "",
            "sessionExpiry": 604800
          }
        },
        "authorizerConfiguration": {
          "className": "org.openmetadata.service.security.DefaultAuthorizer",
          "containerRequestFilter": "org.openmetadata.service.security.JwtFilter",
          "adminPrincipals": ["admin"],
          "principalDomain": "open-metadata.org",
          "allowedEmailRegistrationDomains": ["all"],
          "enforcePrincipalDomain": false,
          "enableSecureSocketConnection": false
        }
      }
      """
          .formatted(AZURE_COMMON_JWKS, OPENMETADATA_JWKS, AZURE_LOGIN, TENANT_ID, CLIENT_ID);

  private MockedStatic<Entity> entityMock;
  private MockedStatic<MigrationValidationClient> migrationMock;
  private MockedStatic<ValidationHttpUtil> httpMock;
  private SystemRepository systemRepository;

  @BeforeEach
  void setUp() {
    entityMock = mockStatic(Entity.class);
    migrationMock = mockStatic(MigrationValidationClient.class);
    httpMock = mockStatic(ValidationHttpUtil.class);

    entityMock.when(Entity::getCollectionDAO).thenReturn(mock(CollectionDAO.class));
    migrationMock
        .when(MigrationValidationClient::getInstance)
        .thenReturn(mock(MigrationValidationClient.class));
    systemRepository = new SystemRepository();

    respond(
        AZURE_LOGIN + TENANT_ID + "/.well-known/openid-configuration",
        200,
        "{\"issuer\":\"%s%s/v2.0\",\"token_endpoint\":\"%s%s/oauth2/v2.0/token\"}"
            .formatted(AZURE_LOGIN, TENANT_ID, AZURE_LOGIN, TENANT_ID));
    // Azure answers an unknown grant type this way once it has found the client.
    httpMock
        .when(
            () ->
                ValidationHttpUtil.postForm(
                    eq(AZURE_LOGIN + TENANT_ID + "/oauth2/v2.0/token"), anyString()))
        .thenReturn(new HttpResponseData(400, "{\"error\":\"unsupported_grant_type\"}"));
    respond(AZURE_COMMON_JWKS, 200, JWKS);
    respond(OPENMETADATA_JWKS, 200, JWKS);
  }

  @AfterEach
  void tearDown() {
    httpMock.close();
    migrationMock.close();
    entityMock.close();
  }

  @Test
  void acceptsTheDocumentedAzurePublicClient() {
    SecurityValidationResponse response = validate(documentedAzurePublicClient());

    assertEquals(List.of(), listOrEmpty(response.getErrors()));
    assertEquals(Status.SUCCESS, response.getStatus());
  }

  @Test
  void stillRequiresAProviderNameForCustomOidc() {
    SecurityConfiguration config = documentedAzurePublicClient();
    config.getAuthenticationConfiguration().setProvider(AuthProvider.CUSTOM_OIDC);

    assertTrue(
        listOrEmpty(validate(config).getErrors())
            .contains(
                fieldError(
                    "authenticationConfiguration.providerName", "Provider name is required")));
  }

  /** A server that cannot reach its own public URL fails the JWKS check whatever the admin edits. */
  @Test
  void doesNotRejectAChangeForAnErrorTheStoredConfigurationAlreadyHas() {
    respond(OPENMETADATA_JWKS, 503, "");
    SecurityConfiguration updated = documentedAzurePublicClient();
    updated.getAuthenticationConfiguration().setEnableSelfSignup(false);

    SecurityValidationResponse response = validateChange(documentedAzurePublicClient(), updated);

    assertEquals(List.of(), listOrEmpty(response.getErrors()));
    assertEquals(Status.SUCCESS, response.getStatus());
  }

  @Test
  void reportsOnlyTheErrorsAChangeIntroduces() {
    respond(OPENMETADATA_JWKS, 503, "");
    SecurityConfiguration updated = documentedAzurePublicClient();
    updated.getAuthenticationConfiguration().setCallbackUrl("");

    SecurityValidationResponse response = validateChange(documentedAzurePublicClient(), updated);

    assertEquals(
        List.of(fieldError(FieldPaths.AUTH_CALLBACK_URL, "Callback URL is required")),
        response.getErrors());
    assertEquals(Status.FAILED, response.getStatus());
  }

  private SecurityValidationResponse validate(SecurityConfiguration config) {
    return systemRepository.validateSecurityConfiguration(
        config, new OpenMetadataApplicationConfig(), "admin");
  }

  private SecurityValidationResponse validateChange(
      SecurityConfiguration stored, SecurityConfiguration updated) {
    return systemRepository.validateSecurityConfigurationChange(
        stored, updated, new OpenMetadataApplicationConfig(), "admin");
  }

  private void respond(String url, int status, String body) {
    httpMock
        .when(() -> ValidationHttpUtil.safeGet(url))
        .thenReturn(new HttpResponseData(status, body));
  }

  private static SecurityConfiguration documentedAzurePublicClient() {
    return JsonUtils.readValue(DOCUMENTED_AZURE_PUBLIC_CLIENT, SecurityConfiguration.class);
  }

  private static FieldError fieldError(String field, String error) {
    return new FieldError().withField(field).withError(error);
  }
}

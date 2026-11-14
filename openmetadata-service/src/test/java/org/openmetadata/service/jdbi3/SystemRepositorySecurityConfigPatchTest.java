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
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;

import jakarta.json.Json;
import jakarta.json.JsonObject;
import jakarta.json.JsonPatch;
import jakarta.ws.rs.BadRequestException;
import java.util.List;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.MockedStatic;
import org.openmetadata.catalog.security.client.SamlSSOClientConfig;
import org.openmetadata.catalog.type.IdentityProviderConfig;
import org.openmetadata.catalog.type.SamlSecurityConfig;
import org.openmetadata.catalog.type.ServiceProviderConfig;
import org.openmetadata.schema.api.security.AuthenticationConfiguration;
import org.openmetadata.schema.api.security.ClientType;
import org.openmetadata.schema.configuration.SecurityConfiguration;
import org.openmetadata.schema.security.client.OidcClientConfig;
import org.openmetadata.schema.services.connections.metadata.AuthProvider;
import org.openmetadata.schema.system.FieldError;
import org.openmetadata.service.Entity;
import org.openmetadata.service.migration.MigrationValidationClient;
import org.openmetadata.service.util.ValidationErrorBuilder.FieldPaths;

/** What a security configuration save checks before anything is stored. */
class SystemRepositorySecurityConfigPatchTest {
  private static final String CLIENT_TYPE = "/authenticationConfiguration/clientType";
  private static final String PROVIDER = "/authenticationConfiguration/provider";
  private static final String OIDC_BLOCK = "/authenticationConfiguration/oidcConfiguration";
  private static final String SAML_ENTITY_ID =
      "/authenticationConfiguration/samlConfiguration/idp/entityId";

  private MockedStatic<Entity> entityMock;
  private MockedStatic<MigrationValidationClient> migrationMock;
  private SystemRepository systemRepository;

  @BeforeEach
  void setUp() {
    entityMock = mockStatic(Entity.class);
    migrationMock = mockStatic(MigrationValidationClient.class);
    entityMock.when(Entity::getCollectionDAO).thenReturn(mock(CollectionDAO.class));
    migrationMock
        .when(MigrationValidationClient::getInstance)
        .thenReturn(mock(MigrationValidationClient.class));
    systemRepository = new SystemRepository();
  }

  @AfterEach
  void tearDown() {
    migrationMock.close();
    entityMock.close();
  }

  @Test
  void aPatchThatSwitchesProviderKeepsTheNewProvidersSettings() {
    JsonPatch patch =
        patch(
            operation("replace", PROVIDER, "custom-oidc"),
            operation("replace", CLIENT_TYPE, "confidential"),
            operation("add", OIDC_BLOCK + "/id", "om-client"));

    JsonPatch filtered = systemRepository.filterInvalidPatchOperations(patch, saml());

    assertEquals(patch.toJsonArray(), filtered.toJsonArray());
  }

  @Test
  void aPatchThatOnlySetsValuesTheProviderIgnoresIsRefused() {
    JsonPatch patch = patch(operation("replace", CLIENT_TYPE, "confidential"));

    BadRequestException refused =
        assertThrows(
            BadRequestException.class,
            () -> systemRepository.filterInvalidPatchOperations(patch, saml()));

    assertTrue(refused.getMessage().contains(CLIENT_TYPE), refused.getMessage());
  }

  @Test
  void ignoredValuesNextToApplicableChangesAreDropped() {
    JsonPatch patch =
        patch(
            operation("replace", CLIENT_TYPE, "confidential"),
            operation("replace", SAML_ENTITY_ID, "https://idp.example.com"));

    JsonPatch filtered = systemRepository.filterInvalidPatchOperations(patch, saml());

    assertEquals(1, filtered.toJsonArray().size());
    assertEquals(SAML_ENTITY_ID, filtered.toJsonArray().getJsonObject(0).getString("path"), "kept");
  }

  @Test
  void removingAnotherProvidersBlockChangesNothingWithoutAnError() {
    JsonPatch patch =
        Json.createPatch(
            Json.createArrayBuilder()
                .add(Json.createObjectBuilder().add("op", "remove").add("path", OIDC_BLOCK))
                .build());

    JsonPatch filtered = systemRepository.filterInvalidPatchOperations(patch, saml());

    assertTrue(filtered.toJsonArray().isEmpty());
  }

  @Test
  void aConfidentialClientMustUseAnAuthenticationMethodTheServerPerforms() {
    SecurityConfiguration unusable =
        confidentialOidc(OidcClientConfig.ClientAuthenticationMethod.CLIENT_SECRET_JWT);
    SecurityConfiguration usable =
        confidentialOidc(OidcClientConfig.ClientAuthenticationMethod.CLIENT_SECRET_POST);

    FieldError error = systemRepository.applicabilityError(unusable);

    assertEquals(FieldPaths.OIDC_CLIENT_AUTHENTICATION_METHOD, error.getField());
    assertNull(systemRepository.applicabilityError(usable));
  }

  @Test
  void samlMetadataSigningNeedsTheServiceProvidersKeys() {
    SecurityConfiguration signing = saml();
    signing
        .getAuthenticationConfiguration()
        .getSamlConfiguration()
        .getSecurity()
        .withSignSpMetadata(true);

    FieldError error = systemRepository.applicabilityError(signing);

    assertEquals(FieldPaths.SAML_SP_CERT, error.getField());
    assertNull(systemRepository.applicabilityError(saml()));
  }

  private static SecurityConfiguration saml() {
    return new SecurityConfiguration()
        .withAuthenticationConfiguration(
            new AuthenticationConfiguration()
                .withProvider(AuthProvider.SAML)
                .withClientType(ClientType.PUBLIC)
                .withSamlConfiguration(
                    new SamlSSOClientConfig()
                        .withIdp(
                            new IdentityProviderConfig()
                                .withEntityId("https://idp.example.com")
                                .withIdpX509Certificate("certificate"))
                        .withSp(new ServiceProviderConfig().withEntityId("openmetadata"))
                        .withSecurity(new SamlSecurityConfig())));
  }

  private static SecurityConfiguration confidentialOidc(
      OidcClientConfig.ClientAuthenticationMethod method) {
    return new SecurityConfiguration()
        .withAuthenticationConfiguration(
            new AuthenticationConfiguration()
                .withProvider(AuthProvider.CUSTOM_OIDC)
                .withClientType(ClientType.CONFIDENTIAL)
                .withOidcConfiguration(
                    new OidcClientConfig().withClientAuthenticationMethod(method)));
  }

  private static JsonPatch patch(JsonObject... operations) {
    var array = Json.createArrayBuilder();
    List.of(operations).forEach(array::add);
    return Json.createPatch(array.build());
  }

  private static JsonObject operation(String op, String path, String value) {
    return Json.createObjectBuilder().add("op", op).add("path", path).add("value", value).build();
  }
}

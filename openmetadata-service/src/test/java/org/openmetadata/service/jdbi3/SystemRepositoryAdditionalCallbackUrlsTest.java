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
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.lang.reflect.Field;
import java.lang.reflect.Method;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.api.security.AuthenticationConfiguration;
import org.openmetadata.schema.api.security.ClientType;
import org.openmetadata.schema.security.client.OidcClientConfig;
import org.openmetadata.schema.services.connections.metadata.AuthProvider;
import org.openmetadata.schema.system.FieldError;
import org.openmetadata.service.util.ValidationErrorBuilder.FieldPaths;
import sun.misc.Unsafe;

class SystemRepositoryAdditionalCallbackUrlsTest {

  private static final String PRIMARY_CALLBACK = "https://om.example.com/callback";

  @Test
  void acceptsCallbackUrlsForOtherHostsWithThePrimaryPath() {
    assertNull(
        SystemRepository.validateAdditionalCallbackUrls(
            publicClient(List.of("https://dr.example.com/callback"))));
  }

  /** Existing configurations never set the field, so they must stay saveable. */
  @Test
  void acceptsAnAbsentOrEmptyList() {
    assertNull(SystemRepository.validateAdditionalCallbackUrls(publicClient(null)));
    assertNull(SystemRepository.validateAdditionalCallbackUrls(publicClient(List.of())));
  }

  @Test
  void rejectsTheFirstEntryLoginCouldNeverSelect() {
    FieldError error =
        SystemRepository.validateAdditionalCallbackUrls(
            publicClient(
                List.of(
                    "https://dr.example.com/callback", "https://lb.example.com/auth/callback")));

    assertEquals(FieldPaths.AUTH_ADDITIONAL_CALLBACK_URLS, error.getField());
    assertTrue(error.getError().contains("'https://lb.example.com/auth/callback'"));
  }

  /** Confidential clients send the OIDC callback URL, so entries must share its path instead. */
  @Test
  void judgesConfidentialClientsAgainstTheOidcCallbackUrl() {
    AuthenticationConfiguration confidentialClient =
        new AuthenticationConfiguration()
            .withClientType(ClientType.CONFIDENTIAL)
            .withCallbackUrl("https://om.example.com/auth/callback")
            .withOidcConfiguration(new OidcClientConfig().withCallbackUrl(PRIMARY_CALLBACK))
            .withAdditionalCallbackUrls(List.of("https://dr.example.com/callback"));

    assertNull(SystemRepository.validateAdditionalCallbackUrls(confidentialClient));
  }

  /** The check runs as part of the base authentication-field validation on every save. */
  @Test
  void baseFieldValidationRejectsAnUnusableAdditionalCallbackUrl() throws Exception {
    AuthenticationConfiguration config =
        publicClient(List.of("https://dr.example.com/auth/callback"))
            .withProvider(AuthProvider.GOOGLE)
            .withProviderName("google")
            .withJwtPrincipalClaims(List.of("email"))
            .withPublicKeyUrls(List.of("https://www.googleapis.com/oauth2/v3/certs"))
            .withAuthority("https://accounts.google.com")
            .withClientId("client-id");

    FieldError error = validateBaseFields(config);

    assertEquals(FieldPaths.AUTH_ADDITIONAL_CALLBACK_URLS, error.getField());
  }

  /**
   * The base-field check is an instance method that reads nothing from the instance, and building a
   * real repository needs the entity DAOs, so it is invoked on an unconstructed instance.
   */
  private static FieldError validateBaseFields(AuthenticationConfiguration config)
      throws Exception {
    Field unsafeField = Unsafe.class.getDeclaredField("theUnsafe");
    unsafeField.setAccessible(true);
    SystemRepository repository =
        (SystemRepository)
            ((Unsafe) unsafeField.get(null)).allocateInstance(SystemRepository.class);
    Method method =
        SystemRepository.class.getDeclaredMethod(
            "validateAuthenticationConfigurationBaseFields", AuthenticationConfiguration.class);
    method.setAccessible(true);
    return (FieldError) method.invoke(repository, config);
  }

  private AuthenticationConfiguration publicClient(List<String> additionalCallbackUrls) {
    return new AuthenticationConfiguration()
        .withClientType(ClientType.PUBLIC)
        .withCallbackUrl(PRIMARY_CALLBACK)
        .withAdditionalCallbackUrls(additionalCallbackUrls);
  }
}

/*
 *  Copyright 2024 Collate.
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
package org.openmetadata.service.security.auth.validator;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import org.junit.jupiter.api.Test;
import org.openmetadata.schema.services.connections.metadata.AuthProvider;
import org.openmetadata.schema.system.FieldError;
import org.openmetadata.service.util.ValidationErrorBuilder;

class OidcPromptPolicyTest {

  private static final AuthProvider[] OIDC_PROVIDERS = {
    AuthProvider.AZURE,
    AuthProvider.GOOGLE,
    AuthProvider.OKTA,
    AuthProvider.AWS_COGNITO,
    AuthProvider.AUTH_0,
    AuthProvider.CUSTOM_OIDC
  };

  @Test
  void emptyPromptIsAllowed() {
    assertNull(OidcPromptPolicy.validate(AuthProvider.AZURE, null));
    assertNull(OidcPromptPolicy.validate(AuthProvider.AZURE, ""));
    assertNull(OidcPromptPolicy.validate(AuthProvider.AZURE, "   "));
  }

  @Test
  void interactivePromptsAreAllowed() {
    assertNull(OidcPromptPolicy.validate(AuthProvider.AZURE, "select_account"));
    assertNull(OidcPromptPolicy.validate(AuthProvider.AZURE, "login"));
    assertNull(OidcPromptPolicy.validate(AuthProvider.AZURE, "consent"));
    assertNull(OidcPromptPolicy.validate(AuthProvider.GOOGLE, "select_account"));
    assertNull(OidcPromptPolicy.validate(AuthProvider.GOOGLE, "consent"));
    assertNull(OidcPromptPolicy.validate(AuthProvider.OKTA, "select_account login"));
  }

  @Test
  void noneIsRejectedForEveryProviderAsLockoutRisk() {
    for (AuthProvider provider : OIDC_PROVIDERS) {
      FieldError error = OidcPromptPolicy.validate(provider, "none");
      assertNotNull(error, provider + " should reject prompt=none");
      assertEquals(ValidationErrorBuilder.FieldPaths.OIDC_PROMPT, error.getField());
      assertTrue(error.getError().toLowerCase().contains("silent"));
    }
  }

  @Test
  void noneCannotBeCombinedWithOtherValues() {
    FieldError error = OidcPromptPolicy.validate(AuthProvider.AZURE, "none login");
    assertNotNull(error);
    assertTrue(error.getError().contains("cannot be combined"));
  }

  @Test
  void googleRejectsLoginWhichItDoesNotSupport() {
    FieldError error = OidcPromptPolicy.validate(AuthProvider.GOOGLE, "login");
    assertNotNull(error);
    assertTrue(error.getError().contains("does not accept"));
  }

  @Test
  void cognitoRejectsConsentWhichItDoesNotSupport() {
    assertNotNull(OidcPromptPolicy.validate(AuthProvider.AWS_COGNITO, "consent"));
  }

  @Test
  void unrecognizedValueIsRejected() {
    FieldError error = OidcPromptPolicy.validate(AuthProvider.AZURE, "foobar");
    assertNotNull(error);
    assertTrue(error.getError().contains("does not accept"));
  }

  @Test
  void validationIsCaseAndWhitespaceInsensitive() {
    assertNull(OidcPromptPolicy.validate(AuthProvider.AZURE, "  Select_Account  "));
    assertNotNull(OidcPromptPolicy.validate(AuthProvider.AZURE, "NONE"));
  }

  @Test
  void nonOidcProviderIsIgnored() {
    assertNull(OidcPromptPolicy.validate(AuthProvider.SAML, "whatever"));
    assertNull(OidcPromptPolicy.validate(AuthProvider.LDAP, "none"));
  }
}

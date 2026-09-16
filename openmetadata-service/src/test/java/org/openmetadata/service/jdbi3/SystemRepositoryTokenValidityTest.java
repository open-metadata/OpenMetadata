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

import org.junit.jupiter.api.Test;
import org.openmetadata.catalog.security.client.SamlSSOClientConfig;
import org.openmetadata.catalog.type.SamlSecurityConfig;
import org.openmetadata.schema.security.client.OidcClientConfig;
import org.openmetadata.schema.system.FieldError;
import org.openmetadata.service.security.TokenValidityResolver;
import org.openmetadata.service.util.ValidationErrorBuilder.FieldPaths;

class SystemRepositoryTokenValidityTest {

  @Test
  void reportsZeroOidcValidityAsAFieldValidationError() {
    FieldError error =
        SystemRepository.validateOidcTokenValidity(new OidcClientConfig().withTokenValidity(0));

    assertEquals(FieldPaths.OIDC_TOKEN_VALIDITY, error.getField());
    assertEquals(TokenValidityResolver.VALIDATION_MESSAGE, error.getError());
  }

  @Test
  void reportsZeroSamlValidityAsAFieldValidationError() {
    FieldError error = SystemRepository.validateSamlTokenValidity(samlConfigWithValidity(0));

    assertEquals(FieldPaths.SAML_SECURITY_TOKEN_VALIDITY, error.getField());
    assertEquals(TokenValidityResolver.VALIDATION_MESSAGE, error.getError());
  }

  @Test
  void acceptsPositiveValidityAndAbsentOptionalConfiguration() {
    assertNull(
        SystemRepository.validateOidcTokenValidity(new OidcClientConfig().withTokenValidity(3600)));
    assertNull(SystemRepository.validateOidcTokenValidity(null));
    assertNull(SystemRepository.validateSamlTokenValidity(samlConfigWithValidity(3600)));
    assertNull(SystemRepository.validateSamlTokenValidity(new SamlSSOClientConfig()));
    assertNull(SystemRepository.validateSamlTokenValidity(null));
  }

  /**
   * A configuration that simply omits the field must stay saveable: the schema default applies and
   * the runtime resolver covers it. Rejecting an absent value would break every existing config.
   */
  @Test
  void acceptsAnOmittedValidityForBothProviders() {
    assertNull(SystemRepository.validateOidcTokenValidity(new OidcClientConfig()));
    assertNull(SystemRepository.validateSamlTokenValidity(samlConfigWithValidity(null)));
  }

  private SamlSSOClientConfig samlConfigWithValidity(Integer tokenValidity) {
    return new SamlSSOClientConfig()
        .withSecurity(new SamlSecurityConfig().withTokenValidity(tokenValidity));
  }
}

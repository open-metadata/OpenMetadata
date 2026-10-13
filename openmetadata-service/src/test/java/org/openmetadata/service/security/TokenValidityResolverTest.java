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
package org.openmetadata.service.security;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import jakarta.validation.Validation;
import jakarta.validation.Validator;
import org.junit.jupiter.api.Test;
import org.openmetadata.catalog.type.SamlSecurityConfig;
import org.openmetadata.schema.security.client.OidcClientConfig;

class TokenValidityResolverTest {
  private static final Validator VALIDATOR =
      Validation.buildDefaultValidatorFactory().getValidator();

  @Test
  void schemaAndRuntimeDefaultsStayAlignedForBothProviders() {
    assertEquals(
        new OidcClientConfig().getTokenValidity(),
        TokenValidityResolver.DEFAULT_TOKEN_VALIDITY_SECONDS);
    assertEquals(
        new SamlSecurityConfig().getTokenValidity(),
        TokenValidityResolver.DEFAULT_TOKEN_VALIDITY_SECONDS);
  }

  @Test
  void invalidValuesResolveToTheDefault() {
    assertEquals(
        TokenValidityResolver.DEFAULT_TOKEN_VALIDITY_SECONDS,
        TokenValidityResolver.resolveOrDefault(null));
    assertEquals(
        TokenValidityResolver.DEFAULT_TOKEN_VALIDITY_SECONDS,
        TokenValidityResolver.resolveOrDefault(0));
    assertEquals(
        TokenValidityResolver.DEFAULT_TOKEN_VALIDITY_SECONDS,
        TokenValidityResolver.resolveOrDefault(-1));
  }

  @Test
  void positiveValuesArePreserved() {
    assertTrue(TokenValidityResolver.isValid(1));
    assertEquals(900, TokenValidityResolver.resolveOrDefault(900));
  }

  @Test
  void zeroAndNegativeValuesAreRejected() {
    assertFalse(TokenValidityResolver.isValid(null));
    assertFalse(TokenValidityResolver.isValid(0));
    assertFalse(TokenValidityResolver.isValid(-1));
  }

  /**
   * An omitted value must remain saveable — the schema default covers it and the runtime falls back
   * — while an explicitly configured non-positive value is a configuration error.
   */
  @Test
  void onlyExplicitNonPositiveValuesAreRejectedOnWrite() {
    assertFalse(TokenValidityResolver.isConfiguredInvalid(null));
    assertFalse(TokenValidityResolver.isConfiguredInvalid(1));
    assertFalse(TokenValidityResolver.isConfiguredInvalid(3600));
    assertTrue(TokenValidityResolver.isConfiguredInvalid(0));
    assertTrue(TokenValidityResolver.isConfiguredInvalid(-1));
  }

  @Test
  void generatedSchemaConstraintRejectsZeroForBothProviders() {
    assertTrue(hasTokenValidityViolation(new OidcClientConfig().withTokenValidity(0)));
    assertTrue(hasTokenValidityViolation(new SamlSecurityConfig().withTokenValidity(0)));
  }

  private boolean hasTokenValidityViolation(Object config) {
    return VALIDATOR.validate(config).stream()
        .anyMatch(violation -> "tokenValidity".equals(violation.getPropertyPath().toString()));
  }
}

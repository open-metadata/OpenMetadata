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
import org.openmetadata.schema.security.client.OidcClientConfig;

class OidcTokenValidityTest {
  private static final Validator VALIDATOR =
      Validation.buildDefaultValidatorFactory().getValidator();

  @Test
  void schemaAndRuntimeDefaultsStayAligned() {
    assertEquals(
        new OidcClientConfig().getTokenValidity(), OidcTokenValidity.DEFAULT_VALIDITY_SECONDS);
  }

  @Test
  void invalidValuesResolveToTheDefault() {
    assertEquals(
        OidcTokenValidity.DEFAULT_VALIDITY_SECONDS, OidcTokenValidity.resolveOrDefault(null));
    assertEquals(OidcTokenValidity.DEFAULT_VALIDITY_SECONDS, OidcTokenValidity.resolveOrDefault(0));
    assertEquals(
        OidcTokenValidity.DEFAULT_VALIDITY_SECONDS, OidcTokenValidity.resolveOrDefault(-1));
  }

  @Test
  void positiveValuesArePreserved() {
    assertTrue(OidcTokenValidity.isValid(1));
    assertEquals(900, OidcTokenValidity.resolveOrDefault(900));
  }

  @Test
  void zeroAndNegativeValuesAreRejected() {
    assertFalse(OidcTokenValidity.isValid(null));
    assertFalse(OidcTokenValidity.isValid(0));
    assertFalse(OidcTokenValidity.isValid(-1));
  }

  @Test
  void generatedSchemaConstraintRejectsZero() {
    OidcClientConfig oidcConfig = new OidcClientConfig().withTokenValidity(0);

    assertTrue(
        VALIDATOR.validate(oidcConfig).stream()
            .anyMatch(violation -> "tokenValidity".equals(violation.getPropertyPath().toString())));
  }
}

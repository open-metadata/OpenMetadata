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
package org.openmetadata.service.security.auth;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.InputStream;
import java.util.List;
import java.util.regex.Pattern;
import org.junit.jupiter.api.Test;

class PrincipalClaimMappingSchemaTest {
  @Test
  void sourceSchemaAcceptsNamespacedClaimsAndRejectsEmptyOrInvalidMappings() throws Exception {
    try (InputStream schema =
        getClass()
            .getResourceAsStream("/json/schema/configuration/authenticationConfiguration.json")) {
      String expression =
          new ObjectMapper()
              .readTree(schema)
              .path("properties")
              .path("jwtPrincipalClaimsMapping")
              .path("items")
              .path("pattern")
              .asText();
      Pattern pattern = Pattern.compile(expression);
      for (String mapping :
          List.of(
              "email:email",
              "username:preferred_username",
              "email:urn:oid:0.9.2342.19200300.100.1.3",
              "email:http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress")) {
        assertTrue(pattern.matcher(mapping).matches(), mapping);
      }
      for (String mapping : List.of("email:", "role:email", "email:has space")) {
        assertFalse(pattern.matcher(mapping).matches(), mapping);
      }
    }
  }
}

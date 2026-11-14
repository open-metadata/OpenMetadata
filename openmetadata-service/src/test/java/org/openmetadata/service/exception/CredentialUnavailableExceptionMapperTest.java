/*
 *  Copyright 2026 Collate
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

package org.openmetadata.service.exception;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;

import io.dropwizard.jersey.errors.ErrorMessage;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import org.junit.jupiter.api.Test;
import org.openmetadata.service.security.credentials.CredentialUnavailableException;

class CredentialUnavailableExceptionMapperTest {
  private final Response response =
      new CredentialUnavailableExceptionMapper()
          .toResponse(new CredentialUnavailableException("No read slot for alice", 2, null));

  @Test
  void answersServiceUnavailableWithTheRetryHint() {
    assertEquals(503, response.getStatus());
    assertEquals("2", response.getHeaderString("Retry-After"));
  }

  @Test
  void bodyIsTheSharedErrorShapeWithoutThePrincipal() {
    ErrorMessage body = (ErrorMessage) response.getEntity();

    assertEquals(MediaType.APPLICATION_JSON_TYPE, response.getMediaType());
    assertEquals(503, body.getCode());
    assertEquals("Credential verification is temporarily unavailable", body.getMessage());
  }

  @Test
  void carriesNoAuthenticationChallenge() {
    assertNull(response.getHeaderString("WWW-Authenticate"));
  }
}

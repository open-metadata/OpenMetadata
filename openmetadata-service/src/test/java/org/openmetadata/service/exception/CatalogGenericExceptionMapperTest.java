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

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;

import com.fasterxml.jackson.databind.JsonNode;
import jakarta.ws.rs.core.Response;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.utils.JsonUtils;

class CatalogGenericExceptionMapperTest {

  /**
   * A {@link CustomExceptionMessage} raised with a non-enum HTTP status (424, what the basic-auth
   * email-failure paths throw with {@code FAILED_SEND_EMAIL}) used to crash the mapper: the SDK
   * {@code WebServiceException} stored a null {@link Response.Status} and {@code getResponse()}
   * threw {@link IllegalArgumentException} from inside the mapper, surfacing as a generic 500. It
   * must now render the intended 424 (regression introduced by bb1395fc72 / PR #23239). On 2.0 the
   * mapper renders every WebServiceException body as {code, message}; the typed errorType body is
   * a later main-only change, and the 2.0 UI keys this flow on the 424 status.
   */
  @Test
  void aNonEnumStatusCodeIsRenderedAs424() {
    Response response =
        assertDoesNotThrow(
            () ->
                new CatalogGenericExceptionMapper()
                    .toResponse(
                        new CustomExceptionMessage(
                            424, "FAILED_SEND_EMAIL", "Email sending issue")));

    assertEquals(424, response.getStatus());
    assertEquals(Response.Status.Family.CLIENT_ERROR, response.getStatusInfo().getFamily());
    JsonNode body = JsonUtils.valueToTree(response.getEntity());
    assertEquals(424, body.path("code").asInt(), "body.code");
    assertEquals("Email sending issue", body.path("message").asText(), "body.message");
  }

  /** What {@code BasicAuthenticator.sendEmailVerification}/{@code sendPasswordResetLink}/ {@code
   * resetUserPasswordWithToken} throw on a {@code TemplateException} — the exact constants the
   * client contract expects. */
  @Test
  void basicAuthEmailFailureConstantsRenderAs424() {
    Response response =
        new CatalogGenericExceptionMapper()
            .toResponse(
                new CustomExceptionMessage(424, "FAILED_SEND_EMAIL", "Email sending issue"));

    assertEquals(424, response.getStatus());
    JsonNode body = JsonUtils.valueToTree(response.getEntity());
    assertEquals(424, body.path("code").asInt());
    assertEquals("Email sending issue", body.path("message").asText());
  }
}

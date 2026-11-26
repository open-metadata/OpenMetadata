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
import static org.junit.jupiter.api.Assertions.assertNotNull;

import com.fasterxml.jackson.databind.JsonNode;
import jakarta.ws.rs.core.Response;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.sdk.exception.WebServiceException;

/**
 * Regression coverage for the {@code CustomExceptionMessage(int status, ...)} constructor, which
 * used to coerce the int through {@code Response.Status.fromStatusCode(int)}. That call returns
 * {@code null} for non-enum codes such as 424 (Failed Dependency), so {@link
 * WebServiceException#getResponse()} later threw {@link IllegalArgumentException} from inside the
 * exception mapper and the client received a generic 500 instead of the intended 424 {@code
 * FAILED_SEND_EMAIL} (see commit bb1395fc72 / PR #23239).
 */
class CustomExceptionMessageTest {

  /**
   * The raw-int constructor must preserve non-enum HTTP codes (424 here) end-to-end, so the
   * exception mapper can render the typed 424 the basic-auth email failures were raised with.
   */
  @Test
  void intConstructorPreservesNonEnumStatusEndToEnd() {
    Response response =
        assertDoesNotThrow(
            () ->
                new CustomExceptionMessage(424, "FAILED_SEND_EMAIL", "Email sending issue")
                    .getResponse());

    assertEquals(424, response.getStatus());
    assertEquals(Response.Status.Family.CLIENT_ERROR, response.getStatusInfo().getFamily());
    assertTypedBody(response, 424, "FAILED_SEND_EMAIL", "Email sending issue");
  }

  /** The enum-status overload must keep working unchanged for callers that pass a {@link
   * Response.Status}. */
  @Test
  void enumStatusConstructorStillRendersItsStatus() {
    Response response =
        new CustomExceptionMessage(
                Response.Status.BAD_REQUEST, "INVALID_USER_OR_PASSWORD", "bad credentials")
            .getResponse();

    assertEquals(400, response.getStatus());
    assertEquals(Response.Status.Family.CLIENT_ERROR, response.getStatusInfo().getFamily());
    assertTypedBody(response, 400, "INVALID_USER_OR_PASSWORD", "bad credentials");
  }

  /**
   * The {@code (Response, String)} overload used to call {@code fromStatusCode(response.getStatus())}
   * too, which had the same latent defect for non-enum response codes. Pre-existing call sites pass
   * a 400, so they must keep rendering 400; a 424 response must now also be preserved instead of
   * crashing the mapper.
   */
  @Test
  void responseConstructorPreservesNonEnumStatusCode() {
    Response source = Response.status(424).entity(new Object()).build();

    Response response = new CustomExceptionMessage(source, "template failed").getResponse();

    assertEquals(424, response.getStatus());
    assertEquals(Response.Status.Family.CLIENT_ERROR, response.getStatusInfo().getFamily());
  }

  @Test
  void responseConstructorKeepsTheDocStoreHardcoded400Response() {
    // DocStoreMapper throws CustomExceptionMessage(Response.status(400)..., msg) — its 400 must be
    // preserved by the int path this constructor now routes through.
    Response source = Response.status(400).entity(new Object()).build();

    Response response = new CustomExceptionMessage(source, "template invalid").getResponse();

    assertEquals(400, response.getStatus());
    assertEquals(Response.Status.Family.CLIENT_ERROR, response.getStatusInfo().getFamily());
  }

  /** A directly constructed SDK exception with a non-enum code must render the same code, so the
   * spec contract holds for every subclass, not just {@link CustomExceptionMessage}. */
  @Test
  void webServiceExceptionIntConstructorRendersNonEnumStatus() {
    WebServiceException exception =
        new WebServiceException(424, "FAILED_SEND_EMAIL", "Email sending issue");

    Response response = assertDoesNotThrow(exception::getResponse);

    assertEquals(424, response.getStatus());
    assertEquals(Response.Status.Family.CLIENT_ERROR, response.getStatusInfo().getFamily());
    assertEquals("FAILED_SEND_EMAIL", exception.getErrorType());
    assertTypedBody(response, 424, "FAILED_SEND_EMAIL", "Email sending issue");
  }

  /** Server-error enum codes (the family the mapper treats as unhandled) still flow through. */
  @Test
  void intConstructorAcceptsServerErrorCodes() {
    Response response = new CustomExceptionMessage(500, "UNHANDLED", "boom").getResponse();

    assertEquals(500, response.getStatus());
    assertEquals(Response.Status.Family.SERVER_ERROR, response.getStatusInfo().getFamily());
    assertTypedBody(response, 500, "UNHANDLED", "boom");
  }

  private static void assertTypedBody(
      Response response, int expectedCode, String expectedErrorType, String expectedMessage) {
    Object entity = response.getEntity();
    assertNotNull(entity, "getResponse must carry a typed ErrorMessage body");
    JsonNode body = JsonUtils.valueToTree(entity);
    assertEquals(expectedCode, body.path("code").asInt(), "body.code");
    assertEquals(expectedErrorType, body.path("errorType").asText(), "body.errorType");
    assertEquals(expectedMessage, body.path("message").asText(), "body.message");
  }
}

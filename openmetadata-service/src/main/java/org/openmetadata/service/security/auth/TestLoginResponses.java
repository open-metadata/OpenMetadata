/*
 *  Copyright 2025 Collate
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

import jakarta.ws.rs.core.Response;
import java.util.LinkedHashMap;
import java.util.Map;
import org.openmetadata.schema.utils.JsonUtils;

/**
 * Shared HTML+JS response builders for Test Login popups (OIDC and SAML).
 * The popup writes the result to localStorage and closes; the parent window
 * polls localStorage for the outcome.
 */
final class TestLoginResponses {

  private static final String LOCAL_STORAGE_KEY = "sso-test-login-result";
  private static final String MESSAGE_TYPE = "sso-test-login";

  private TestLoginResponses() {}

  static Response buildPostMessageResponse(
      boolean success, String error, Map<String, Object> data) {
    Map<String, Object> message = new LinkedHashMap<>();
    message.put("type", MESSAGE_TYPE);
    message.put("success", success);
    if (error != null) {
      message.put("error", error);
    }
    if (data != null) {
      message.putAll(data);
    }

    String json = JsonUtils.pojoToJson(message);

    String html =
        "<!DOCTYPE html><html><body>"
            + "<p>"
            + (success ? "Authentication successful. This window will close." : "Error: " + error)
            + "</p>"
            + "<script>"
            + "try {"
            + "  localStorage.setItem('"
            + LOCAL_STORAGE_KEY
            + "', JSON.stringify("
            + json
            + "));"
            + "} catch(e) { console.error('Failed to store test login result', e); }"
            + "setTimeout(function() { window.close(); }, 1000);"
            + "</script>"
            + "</body></html>";

    return Response.ok(html, "text/html").build();
  }

  static Response buildHtmlErrorResponse(String message) {
    String sanitized = message.replace("'", "\\'").replace("\n", " ");
    String html =
        "<!DOCTYPE html><html><body>"
            + "<p>Test Login Error: "
            + message
            + "</p>"
            + "<script>"
            + "try {"
            + "  localStorage.setItem('"
            + LOCAL_STORAGE_KEY
            + "', JSON.stringify("
            + "{type: '"
            + MESSAGE_TYPE
            + "', success: false, error: '"
            + sanitized
            + "'}));"
            + "} catch(e) { console.error('Failed to store test login error', e); }"
            + "setTimeout(function() { window.close(); }, 2000);"
            + "</script>"
            + "</body></html>";

    return Response.status(Response.Status.BAD_REQUEST).entity(html).type("text/html").build();
  }
}

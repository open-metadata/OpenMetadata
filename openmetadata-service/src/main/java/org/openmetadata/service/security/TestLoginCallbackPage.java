/*
 *  Copyright 2025 Collate.
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

import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import lombok.extern.slf4j.Slf4j;

/**
 * The page a Test Login popup lands on after the identity provider's callback.
 *
 * <p>It is a constant. It carries nothing from the provider's response, so nothing the provider —
 * or anyone posing as one — sends can reach a DOM; the admin's own window reads the outcome over
 * JSON and closes the popup. The Content-Security-Policy forbids every script and resource, which
 * holds that guarantee even if this markup is ever edited carelessly.
 */
@Slf4j
public final class TestLoginCallbackPage {
  public static final String CONTENT_SECURITY_POLICY = "default-src 'none'";
  public static final String HTML =
      """
      <!DOCTYPE html>
      <html lang="en">
        <head><meta charset="utf-8"><title>OpenMetadata test login</title></head>
        <body><p>Sign-in received. You can close this window and return to OpenMetadata.</p></body>
      </html>
      """;

  private TestLoginCallbackPage() {}

  public static void render(HttpServletResponse resp) {
    try {
      resp.setStatus(HttpServletResponse.SC_OK);
      resp.setContentType("text/html;charset=UTF-8");
      resp.setHeader("Content-Security-Policy", CONTENT_SECURITY_POLICY);
      resp.setHeader("Cache-Control", "no-store");
      // The callback URL carries the authorization code; never leak it through a Referer header.
      resp.setHeader("Referrer-Policy", "no-referrer");
      resp.setHeader("X-Content-Type-Options", "nosniff");
      resp.getWriter().write(HTML);
    } catch (IOException e) {
      LOG.error("Failed to write the test login callback page", e);
    }
  }
}

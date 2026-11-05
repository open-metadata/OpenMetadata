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

package org.openmetadata.service.security.saml;

import jakarta.servlet.annotation.WebServlet;
import jakarta.servlet.http.HttpServlet;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.openmetadata.service.security.AuthServeletHandler;
import org.openmetadata.service.security.AuthServeletHandlerRegistry;
import org.openmetadata.service.security.auth.SamlAuthServletHandler;

/**
 * The ACS answers a valid SAML response with a redirect here that carries a one-time code. This
 * same-site GET also carries the browser's session cookie, so the login completes only in the
 * browser that both started it and delivered the response
 * (ADR:2026-11-03-a-saml-login-completes-in-the-browser-that-started-it).
 */
@WebServlet(SamlLoginCompletionServlet.PATH)
public class SamlLoginCompletionServlet extends HttpServlet {
  public static final String PATH = "/api/v1/saml/complete";
  public static final String CODE_PARAMETER = "code";

  @Override
  protected void doGet(HttpServletRequest request, HttpServletResponse response) {
    AuthServeletHandler handler =
        AuthServeletHandlerRegistry.getHandler(request.getServletContext());
    if (!(handler instanceof SamlAuthServletHandler samlHandler)) {
      response.setStatus(HttpServletResponse.SC_NOT_FOUND);
      return;
    }
    samlHandler.completeLogin(request, response);
  }
}

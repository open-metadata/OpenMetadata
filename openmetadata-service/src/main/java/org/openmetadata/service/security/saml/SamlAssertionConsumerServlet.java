/*
 *  Copyright 2021 Collate
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
import java.util.Optional;
import org.openmetadata.service.security.AuthServeletHandler;
import org.openmetadata.service.security.AuthServeletHandlerRegistry;
import org.openmetadata.service.security.TestLoginCallbackPage;
import org.openmetadata.service.security.auth.SamlAuthServletHandler;
import org.openmetadata.service.security.auth.TestLoginRoundTrip;
import org.openmetadata.service.security.auth.TestLoginSessionCache;

@WebServlet("/api/v1/saml/acs")
public class SamlAssertionConsumerServlet extends HttpServlet {

  @Override
  protected void doPost(HttpServletRequest request, HttpServletResponse response) {
    // A Test Login posts back here with its marker as RelayState. Route it before any live login
    // handling, so a test can never provision a user, mint a token, or start a session.
    Optional<String> testSessionId =
        TestLoginSessionCache.sessionIdFromMarker(request.getParameter("RelayState"));
    if (testSessionId.isPresent()) {
      TestLoginRoundTrip.getInstance().completeSamlCallback(testSessionId.get(), request, response);
      TestLoginCallbackPage.render(response);
      return;
    }
    // This servlet is registered even when SAML is not the live provider, so that a SAML candidate
    // can be tested from any instance. Only the live SAML handler may receive a real assertion;
    // with any other provider live, the path must answer exactly as before: not found.
    AuthServeletHandler handler =
        AuthServeletHandlerRegistry.getHandler(request.getServletContext());
    if (!(handler instanceof SamlAuthServletHandler)) {
      // setStatus, not sendError: sendError hands the request to the SPA's 404 error page, which
      // rejects a POST with 405, where Jersey used to answer this unmapped path with a plain 404.
      response.setStatus(HttpServletResponse.SC_NOT_FOUND);
      return;
    }
    handler.handleCallback(request, response);
  }
}

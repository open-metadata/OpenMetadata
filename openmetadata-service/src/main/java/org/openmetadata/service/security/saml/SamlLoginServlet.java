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

import static org.openmetadata.service.security.AuthenticationCodeFlowHandler.SESSION_REDIRECT_URI;

import com.onelogin.saml2.Auth;
import com.onelogin.saml2.exception.SAMLException;
import jakarta.servlet.ServletException;
import jakarta.servlet.annotation.WebServlet;
import jakarta.servlet.http.HttpServlet;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import lombok.extern.slf4j.Slf4j;
import org.apache.felix.http.javaxwrappers.HttpServletRequestWrapper;
import org.apache.felix.http.javaxwrappers.HttpServletResponseWrapper;

/**
 * This Servlet initiates a login and sends a login request to the IDP. After a successful processing it redirects user
 * to the relayState which is the callback setup in the config.
 */
@Slf4j
@WebServlet("/api/v1/saml/login")
public class SamlLoginServlet extends HttpServlet {
  @Override
  protected void doGet(HttpServletRequest request, HttpServletResponse response)
      throws ServletException, IOException {
    try {
      checkAndStoreRedirectUriInSession(request);
      javax.servlet.http.HttpServletRequest wrappedRequest = new HttpServletRequestWrapper(request);
      javax.servlet.http.HttpServletResponse wrappedResponse =
          new HttpServletResponseWrapper(response);
      Auth auth = new Auth(SamlSettingsHolder.getSaml2Settings(), wrappedRequest, wrappedResponse);
      auth.login();
    } catch (SAMLException ex) {
      LOG.error("Error initiating SAML login", ex);
      throw new ServletException("Error initiating SAML login", ex);
    }
  }

  private void checkAndStoreRedirectUriInSession(HttpServletRequest request) {
    String redirectUri = request.getParameter("callback");
    if (redirectUri != null) {
      request.getSession().setAttribute(SESSION_REDIRECT_URI, redirectUri);
    }
  }
}

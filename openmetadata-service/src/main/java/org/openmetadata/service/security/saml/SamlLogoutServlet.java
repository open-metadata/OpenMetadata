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
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.service.security.AuthServeletHandler;
import org.openmetadata.service.security.AuthServeletHandlerRegistry;

/**
 * This Servlet initiates a login and sends a login request to the IDP. After a successful processing it redirects user
 * to the relayState which is the callback setup in the config.
 */
@WebServlet("/api/v1/saml/logout")
@Slf4j
public class SamlLogoutServlet extends HttpServlet {

  public SamlLogoutServlet() {
    // No constructor dependencies - fetch configuration dynamically
  }

  @Override
  protected void doGet(
      final HttpServletRequest httpServletRequest, final HttpServletResponse httpServletResponse) {
    httpServletResponse.setStatus(HttpServletResponse.SC_METHOD_NOT_ALLOWED);
    httpServletResponse.setHeader("Allow", "POST");
  }

  @Override
  protected void doPost(
      final HttpServletRequest httpServletRequest, final HttpServletResponse httpServletResponse) {
    AuthServeletHandler handler =
        AuthServeletHandlerRegistry.getHandler(httpServletRequest.getServletContext());
    handler.handleLogout(httpServletRequest, httpServletResponse);
  }
}

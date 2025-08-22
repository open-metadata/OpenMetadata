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

package org.openmetadata.service.security.legacy;

import jakarta.servlet.RequestDispatcher;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServlet;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import lombok.extern.slf4j.Slf4j;

/**
 * Base proxy servlet for backward compatibility with legacy authentication endpoints.
 * Forwards requests to the unified authentication endpoints.
 */
@Slf4j
public abstract class LegacyAuthProxyServlet extends HttpServlet {

  protected void forwardToUnifiedEndpoint(
      HttpServletRequest request, HttpServletResponse response, String unifiedPath)
      throws ServletException, IOException {

    LOG.warn(
        "Legacy endpoint accessed: {} - Consider updating to unified endpoint: {}",
        request.getRequestURI(),
        unifiedPath);

    // Add deprecation header
    response.setHeader("X-OM-Auth-Deprecated", "true");
    response.setHeader("X-OM-Auth-Unified-Endpoint", unifiedPath);

    // Forward to unified endpoint
    RequestDispatcher dispatcher = request.getRequestDispatcher(unifiedPath);
    dispatcher.forward(request, response);
  }

  @Override
  protected void doGet(HttpServletRequest req, HttpServletResponse resp)
      throws ServletException, IOException {
    handleRequest(req, resp);
  }

  @Override
  protected void doPost(HttpServletRequest req, HttpServletResponse resp)
      throws ServletException, IOException {
    handleRequest(req, resp);
  }

  protected abstract void handleRequest(HttpServletRequest req, HttpServletResponse resp)
      throws ServletException, IOException;
}

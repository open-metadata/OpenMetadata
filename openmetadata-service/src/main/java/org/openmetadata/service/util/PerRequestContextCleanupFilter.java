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
package org.openmetadata.service.util;

import jakarta.servlet.Filter;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.ServletRequest;
import jakarta.servlet.ServletResponse;
import java.io.IOException;

/**
 * Clears per-request thread state around every request on the application context. Jersey clears
 * it in ImpersonationCleanupFilter, but servlets and filters outside Jersey (MCP, the WebSocket
 * handshake, SSO callbacks) run on the same Jetty threads and never did, so an entity they cached
 * could answer the next request's token check. Prepended so it runs before the filters registered
 * earlier, including ones that answer without calling the chain.
 * ADR:2026-10-23-every-jetty-request-clears-per-request-thread-state
 */
public final class PerRequestContextCleanupFilter implements Filter {

  @Override
  public void doFilter(ServletRequest request, ServletResponse response, FilterChain chain)
      throws IOException, ServletException {
    PerRequestContextCleaner.clear();
    try {
      chain.doFilter(request, response);
    } finally {
      PerRequestContextCleaner.clear();
    }
  }
}

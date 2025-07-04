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

package org.openmetadata.service.socket;

import jakarta.servlet.annotation.WebServlet;
import jakarta.servlet.http.HttpServlet;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import lombok.extern.slf4j.Slf4j;
import org.apache.felix.http.javaxwrappers.HttpServletRequestWrapper;
import org.apache.felix.http.javaxwrappers.HttpServletResponseWrapper;

@Slf4j
@WebServlet("/api/v1/push/feed/*")
public class FeedServlet extends HttpServlet {
  @Override
  protected void service(HttpServletRequest request, HttpServletResponse response)
      throws IOException {
    try {
      // EngineIO server expects javax servlet types, so we need to use wrappers
      HttpServletRequestWrapper wrappedRequest = new HttpServletRequestWrapper(request);
      HttpServletResponseWrapper wrappedResponse = new HttpServletResponseWrapper(response);

      WebSocketManager.getInstance()
          .getEngineIoServer()
          .handleRequest(wrappedRequest, wrappedResponse);
    } catch (Exception ex) {
      LOG.error("[FeedServlet] Error Encountered : {}", ex.getMessage());
      response
          .getWriter()
          .println(String.format("[FeedServlet] Error Encountered : %s", ex.getMessage()));
    }
  }
}

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

package org.openmetadata.catalog.socket;

import java.io.IOException;
import javax.servlet.annotation.WebServlet;
import javax.servlet.http.HttpServlet;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletRequestWrapper;
import javax.servlet.http.HttpServletResponse;

@WebServlet("/api/v1/push/feed/*")
public class FeedServlet extends HttpServlet {
  public FeedServlet() {}

  @Override
  protected void service(HttpServletRequest request, HttpServletResponse response) throws IOException {
    WebSocketManager.getInstance()
        .getEngineIoServer()
        .handleRequest(
            new HttpServletRequestWrapper(request) {
              @Override
              public boolean isAsyncSupported() {
                return true;
              }
            },
            response);
  }
}

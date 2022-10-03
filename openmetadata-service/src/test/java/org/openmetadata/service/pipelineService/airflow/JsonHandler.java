/*
 *  Copyright 2022 Collate
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
package org.openmetadata.service.pipelineService.airflow;

import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpHandler;
import java.io.IOException;
import java.nio.charset.Charset;
import java.util.Map;
import org.apache.commons.io.IOUtils;

class JsonHandler implements HttpHandler {

  final Map<String, MockResponse> pathResponses;

  public JsonHandler(Map<String, MockResponse> pathResponses) {
    this.pathResponses = pathResponses;
  }

  @Override
  public void handle(HttpExchange exchange) throws IOException {
    MockResponse response = pathResponses.get(exchange.getRequestURI().toString());
    exchange.getResponseHeaders().add("Content-Type", response.getContentType());
    exchange.sendResponseHeaders(response.getStatusCode(), response.getBody().length());
    IOUtils.write(response.getBody(), exchange.getResponseBody(), Charset.defaultCharset());
    exchange.close();
  }
}

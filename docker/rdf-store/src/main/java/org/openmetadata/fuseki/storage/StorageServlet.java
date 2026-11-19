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
package org.openmetadata.fuseki.storage;

import jakarta.servlet.http.HttpServlet;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import org.apache.jena.atlas.json.JSON;
import org.apache.jena.atlas.json.JsonObject;

/**
 * {@code GET} {@value #PATH_SPEC}: the data volume's size, free space and reserve, and whether
 * writes are refused, for the client that decides when to compact. It sits behind the image's
 * Shiro filter like every admin path.
 */
public final class StorageServlet extends HttpServlet {
  public static final String PATH_SPEC = "/$/openmetadata/storage";

  private final transient StorageGuard guard;

  public StorageServlet(final StorageGuard guard) {
    this.guard = guard;
  }

  @Override
  protected void doGet(final HttpServletRequest request, final HttpServletResponse response)
      throws IOException {
    final byte[] body = JSON.toString(report(guard)).getBytes(StandardCharsets.UTF_8);
    response.setStatus(200);
    response.setContentType("application/json");
    response.setContentLength(body.length);
    try (OutputStream out = response.getOutputStream()) {
      out.write(body);
    }
  }

  static JsonObject report(final StorageGuard guard) {
    final JsonObject json = new JsonObject();
    json.put("totalBytes", guard.totalBytes());
    json.put("usableBytes", guard.usableBytes());
    json.put("reserveBytes", guard.reserveBytes());
    json.put("lowOnSpace", guard.isLowOnSpace());
    return json;
  }
}

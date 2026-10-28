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
import java.nio.file.Path;
import org.apache.jena.atlas.json.JSON;

/**
 * {@code GET} {@value #PATH_SPEC}: the volume's free space and each TDB2 dataset's size, as
 * {@link StorageReport}. It sits behind the image's Shiro filter like every admin path.
 */
public final class StorageServlet extends HttpServlet {
  public static final String PATH_SPEC = "/$/openmetadata/storage";

  private final transient Path databases;
  private final transient StorageGuard guard;

  public StorageServlet(final Path databases, final StorageGuard guard) {
    this.databases = databases;
    this.guard = guard;
  }

  @Override
  protected void doGet(final HttpServletRequest request, final HttpServletResponse response)
      throws IOException {
    final byte[] body =
        JSON.toString(StorageReport.of(databases, guard).toJson()).getBytes(StandardCharsets.UTF_8);
    response.setStatus(200);
    response.setContentType("application/json");
    response.setContentLength(body.length);
    try (OutputStream out = response.getOutputStream()) {
      out.write(body);
    }
  }
}

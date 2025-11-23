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

import static org.openmetadata.service.exception.OMErrorPageHandler.setSecurityHeader;

import io.dropwizard.servlets.assets.AssetServlet;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import org.jetbrains.annotations.Nullable;
import org.openmetadata.service.config.OMWebConfiguration;
import org.openmetadata.service.resources.system.IndexResource;

public class OpenMetadataAssetServlet extends AssetServlet {
  private final OMWebConfiguration webConfiguration;
  private final String basePath;

  public OpenMetadataAssetServlet(
      String basePath,
      String resourcePath,
      String uriPath,
      @Nullable String indexFile,
      OMWebConfiguration webConf) {
    super(resourcePath, uriPath, indexFile, "text/html", StandardCharsets.UTF_8);
    this.webConfiguration = webConf;
    this.basePath = basePath;
  }

  @Override
  protected void doGet(HttpServletRequest req, HttpServletResponse resp)
      throws ServletException, IOException {
    setSecurityHeader(webConfiguration, resp);

    String requestUri = req.getRequestURI();

    if (requestUri.endsWith("/")) {
      // Serve index.html for directory requests
      resp.setContentType("text/html");
      resp.getWriter().write(IndexResource.getIndexFile(this.basePath));
      return;
    }

    super.doGet(req, resp);

    // For SPA routing: serve index.html for 404s that don't look like static asset requests
    if (!resp.isCommitted() && (resp.getStatus() == 404)) {
      if (isSpaRoute(requestUri)) {
        // Serve index file for SPA routes instead of 404
        resp.setStatus(200);
        resp.setContentType("text/html");
        resp.getWriter().write(IndexResource.getIndexFile(this.basePath));
      } else {
        resp.sendError(404);
      }
    }
  }

  /**
   * Check if the request URI looks like a SPA route (not a static asset)
   * Static assets typically have file extensions, SPA routes don't
   * @param requestUri The request URI to check
   * @return true if this should be treated as a SPA route, false if it's a static asset
   */
  private boolean isSpaRoute(String requestUri) {
    // Remove base path if present
    String pathToCheck = requestUri;
    String normalizedBasePath =
        basePath.endsWith("/") ? basePath.substring(0, basePath.length() - 1) : basePath;

    if (!"/".equals(normalizedBasePath)
        && !normalizedBasePath.isEmpty()
        && requestUri.startsWith(normalizedBasePath)) {
      pathToCheck = requestUri.substring(normalizedBasePath.length());
    }

    // If path has a file extension, it's likely a static asset
    // Don't serve index.html for these
    String fileName = pathToCheck.substring(pathToCheck.lastIndexOf('/') + 1);
    if (fileName.contains(".")) {
      return false; // Has extension, likely a static asset
    }

    // No file extension, treat as SPA route
    return true;
  }
}

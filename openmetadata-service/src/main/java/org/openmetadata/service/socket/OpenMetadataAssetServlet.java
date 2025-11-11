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
import java.util.Arrays;
import java.util.List;
import org.jetbrains.annotations.Nullable;
import org.openmetadata.service.config.OMWebConfiguration;
import org.openmetadata.service.resources.system.IndexResource;

public class OpenMetadataAssetServlet extends AssetServlet {
  private final OMWebConfiguration webConfiguration;
  private final String basePath;

  // List of frontend paths that should be whitelisted and serve the index file
  private static final List<String> WHITELISTED_PATHS = Arrays.asList("/docs", "/signin");

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
      IndexResource index = new IndexResource();
      // Write the dynamic config.js content to the response
      resp.setContentType("text/html");
      resp.getWriter().write(IndexResource.getIndexFile(this.basePath));
      return;
    }

    super.doGet(req, resp);

    // Check if response is 404 and the path should be whitelisted
    if (!resp.isCommitted() && (resp.getStatus() == 404)) {
      if (isWhitelistedPath(requestUri)) {
        // Serve index file for whitelisted paths instead of 404
        resp.setStatus(200);
        resp.setContentType("text/html");
        resp.getWriter().write(IndexResource.getIndexFile(this.basePath));
      } else {
        resp.sendError(404);
      }
    }
  }

  /**
   * Check if the given URI path should be whitelisted
   * @param requestUri The request URI to check
   * @return true if the path should be whitelisted, false otherwise
   */
  private boolean isWhitelistedPath(String requestUri) {
    for (String whitelistedPath : WHITELISTED_PATHS) {
      if (requestUri.startsWith(whitelistedPath)) {
        return true;
      }
    }
    return false;
  }
}

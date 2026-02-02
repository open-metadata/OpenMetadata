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
import jakarta.servlet.http.HttpServletRequestWrapper;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpServletResponseWrapper;
import java.io.IOException;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.nio.file.Path;
import java.nio.file.Paths;
import lombok.extern.slf4j.Slf4j;
import org.jetbrains.annotations.Nullable;
import org.openmetadata.service.config.OMWebConfiguration;
import org.openmetadata.service.resources.system.IndexResource;

@Slf4j
public class OpenMetadataAssetServlet extends AssetServlet {
  private final OMWebConfiguration webConfiguration;
  private final String basePath;
  private final String resourcePath;

  public OpenMetadataAssetServlet(
      String basePath,
      String resourcePath,
      String uriPath,
      @Nullable String indexFile,
      OMWebConfiguration webConf) {
    super(resourcePath, uriPath, indexFile, "text/html", StandardCharsets.UTF_8);
    this.resourcePath = resourcePath;
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

    String acceptEncoding = req.getHeader("Accept-Encoding");

    // 1. Check for Brotli (br)
    if (supportsEncoding(acceptEncoding, "br")) {
      try {
        String fullResourcePath = getPathToCheck(req, requestUri, ".br");
        if (fullResourcePath != null) {
          URL url = this.getClass().getResource(fullResourcePath);
          if (url != null) {
            serveCompressed(req, resp, requestUri, "br", "br");
            return;
          }
        }
      } catch (Exception e) {
        LOG.debug("Failed to serve Brotli compressed asset for {}: {}", requestUri, e.getMessage());
      }
    }

    // 2. Check for Gzip
    if (supportsEncoding(acceptEncoding, "gzip")) {
      try {
        String fullResourcePath = getPathToCheck(req, requestUri, ".gz");
        if (fullResourcePath != null) {
          URL url = this.getClass().getResource(fullResourcePath);

          if (url != null) {
            serveCompressed(req, resp, requestUri, "gzip", "gz");
            return;
          }
        }
      } catch (Exception e) {
        LOG.debug("Failed to serve Gzip compressed asset for {}: {}", requestUri, e.getMessage());
      }
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
   * Check if the Accept-Encoding header supports the given encoding with non-zero quality value.
   * Handles q-values properly (e.g., "br;q=0" means encoding is explicitly disabled).
   */
  private boolean supportsEncoding(String acceptEncoding, String encoding) {
    if (acceptEncoding == null || acceptEncoding.isEmpty()) {
      return false;
    }

    // Split by comma to handle multiple encodings
    String[] encodings = acceptEncoding.toLowerCase().split(",");
    for (String enc : encodings) {
      enc = enc.trim();

      // Check if this encoding matches
      if (enc.startsWith(encoding)) {
        // Check for q=0 which explicitly disables the encoding
        return !enc.contains("q=0");
      }
    }
    return false;
  }

  private String getPathToCheck(HttpServletRequest req, String requestUri, String extension) {
    String pathToCheck = requestUri;
    String contextPath = req.getContextPath();
    if (contextPath != null && requestUri.startsWith(contextPath)) {
      pathToCheck = requestUri.substring(contextPath.length());
    }

    // Reject path traversal attempts early
    if (pathToCheck.contains("..")) {
      LOG.warn("Path traversal attempt detected in request: {}", requestUri);
      return null;
    }

    String fullPath =
        this.resourcePath + (pathToCheck.startsWith("/") ? "" : "/") + pathToCheck + extension;

    // Validate against path traversal attacks
    try {
      Path normalizedPath = Paths.get(fullPath).normalize();
      Path baseResourcePath = Paths.get(this.resourcePath).normalize();

      // Check path is within resource directory
      if (!normalizedPath.startsWith(baseResourcePath)) {
        LOG.warn("Path traversal attempt detected: {} escaped resource directory", requestUri);
        return null;
      }

      // Additional check: normalized path should not go backwards
      if (normalizedPath.toString().contains("..")) {
        LOG.warn("Path contains .. after normalization: {}", requestUri);
        return null;
      }
    } catch (Exception e) {
      LOG.debug("Path validation failed for {}: {}", requestUri, e.getMessage());
      return null;
    }

    return fullPath;
  }

  private void serveCompressed(
      HttpServletRequest req,
      HttpServletResponse resp,
      String requestUri,
      String contentEncoding,
      String extension)
      throws ServletException, IOException {
    resp.setHeader("Content-Encoding", contentEncoding);
    String mimeType = req.getServletContext().getMimeType(requestUri);

    HttpServletRequestWrapper compressedReq =
        new HttpServletRequestWrapper(req) {
          @Override
          public String getPathInfo() {
            String pathInfo = super.getPathInfo();
            return pathInfo != null ? pathInfo + "." + extension : null;
          }

          @Override
          public String getRequestURI() {
            return super.getRequestURI() + "." + extension;
          }
        };

    HttpServletResponseWrapper compressedResp =
        new HttpServletResponseWrapper(resp) {
          @Override
          public void setContentType(String type) {
            if (mimeType != null) {
              super.setContentType(mimeType);
            } else {
              super.setContentType(type);
            }
          }
        };

    super.doGet(compressedReq, compressedResp);
  }

  /**
   * Check if the request URI looks like an SPA route (not a static asset)
   * Static assets typically have file extensions, SPA routes don't
   * @param requestUri The request URI to check
   * @return true if this should be treated as an SPA route, false if it's a static asset
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
    return !fileName.contains("."); // Has extension, likely a static asset

    // No file extension, treat as SPA route
  }
}

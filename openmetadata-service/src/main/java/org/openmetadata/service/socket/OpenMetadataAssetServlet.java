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
import java.util.Set;
import java.util.regex.Pattern;
import lombok.extern.slf4j.Slf4j;
import org.jetbrains.annotations.Nullable;
import org.openmetadata.service.config.OMWebConfiguration;
import org.openmetadata.service.resources.system.IndexResource;
import org.openmetadata.service.security.CspNonceHandler;

@Slf4j
public class OpenMetadataAssetServlet extends AssetServlet {
  private static final Set<String> STATIC_FILE_EXTENSIONS =
      Set.of(
          "js", "css", "map", "json", "txt", "html", "ico", "png", "jpg", "jpeg", "svg", "gif",
          "webp", "woff", "woff2", "ttf", "eot", "otf", "pdf", "md");

  // Matches Vite's content-hash filename pattern, e.g. `index-Z3O_FBkA.js`,
  // `MyComponent.component-a1b2c3d4.css`. The hash chunk is base64url and at
  // least 8 chars — long enough to make accidental collisions vanishingly
  // unlikely. Anything matching is safe to mark {@code immutable} because the
  // filename changes whenever the content does.
  private static final Pattern HASHED_ASSET =
      Pattern.compile(".*-[A-Za-z0-9_-]{8,}\\.[a-z0-9]+(\\.br|\\.gz)?$");

  private static final String IMMUTABLE_CACHE = "public, max-age=31536000, immutable";

  // The HTML shell points at hash-named JS chunks, so it MUST be re-fetched
  // (or revalidated) on every load — otherwise a fresh deploy lands but the
  // browser keeps the stale shell that references chunks that no longer
  // exist. {@code no-cache} forces revalidation on every load; together
  // with the ETag emitted by {@link IndexResource} the request settles as
  // a 304 with ~150 bytes when nothing changed.
  private static final String REVALIDATE_CACHE = "no-cache, must-revalidate";

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
    applyCacheControl(req, resp);

    String requestUri = req.getRequestURI();

    if (requestUri.endsWith("/")) {
      final String cspNonce = (String) req.getAttribute(CspNonceHandler.CSP_NONCE_ATTRIBUTE);
      writeIndexHtml(req, resp, cspNonce);
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
        final String cspNonce = (String) req.getAttribute(CspNonceHandler.CSP_NONCE_ATTRIBUTE);
        resp.setStatus(200);
        writeIndexHtml(req, resp, cspNonce);
      } else {
        resp.sendError(404);
      }
    }
  }

  /**
   * Write the SPA shell, honouring {@code If-None-Match} with a 304 when possible.
   *
   * <p>The cspNonce is per-request (each load gets a fresh value the page's inline scripts use
   * to clear the CSP); we therefore only 304 when there's no nonce in play, so a cached body
   * carrying a stale nonce can't be served against a CSP header that lists a fresh one.
   *
   * <p>The ETag itself describes the stable shell (post-basePath substitution, pre-nonce). It
   * changes when the running JAR's bundled {@code index.html} or {@code basePath} change — i.e.
   * on every deploy — and stays constant within a process otherwise.
   */
  private void writeIndexHtml(HttpServletRequest req, HttpServletResponse resp, String cspNonce)
      throws IOException {
    String etag = IndexResource.getIndexEtag(this.basePath);
    boolean hasPerRequestNonce = cspNonce != null && !cspNonce.isEmpty();
    if (!hasPerRequestNonce) {
      resp.setHeader("ETag", etag);
      String ifNoneMatch = req.getHeader("If-None-Match");
      if (etag.equals(ifNoneMatch)) {
        resp.setStatus(HttpServletResponse.SC_NOT_MODIFIED);
        return;
      }
    }
    resp.setContentType("text/html");
    resp.getWriter().write(IndexResource.getIndexFile(this.basePath, cspNonce));
  }

  /**
   * Pick a {@code Cache-Control} policy by path shape.
   *
   * <ul>
   *   <li><b>Hashed assets under {@code /assets/}</b> — names are content-addressed by Vite
   *       (e.g. {@code index-Z3O_FBkA.js}). The filename changes whenever the body changes, so
   *       the browser can cache forever and not even ask the server again. Emit
   *       {@code public, max-age=31536000, immutable}.
   *   <li><b>SPA HTML / fallback routes</b> — the shell that references the hashed asset names.
   *       Must NOT be long-cached, else a fresh deploy lands and clients keep a stale shell
   *       pointing at chunks that no longer exist. Emit {@code no-cache, must-revalidate} so
   *       the browser revalidates every load; {@link IndexResource} attaches an ETag so the
   *       revalidate settles as a tiny 304 when nothing changed.
   *   <li><b>Unhashed static files</b> (e.g. {@code favicon.ico}, {@code manifest.json}) — fall
   *       through with no explicit Cache-Control so the browser's heuristic kicks in. Adding a
   *       short {@code max-age} here is possible but low-ROI; revisit if logs show high
   *       refetch rates.
   * </ul>
   */
  private void applyCacheControl(HttpServletRequest req, HttpServletResponse resp) {
    String requestUri = req.getRequestURI();
    String pathToCheck = stripBasePath(requestUri);
    if (pathToCheck.startsWith("/assets/") && HASHED_ASSET.matcher(pathToCheck).matches()) {
      resp.setHeader("Cache-Control", IMMUTABLE_CACHE);
      return;
    }
    if (requestUri.endsWith("/") || requestUri.endsWith(".html") || isSpaRoute(requestUri)) {
      resp.setHeader("Cache-Control", REVALIDATE_CACHE);
    }
  }

  private String stripBasePath(String requestUri) {
    String normalizedBasePath =
        basePath.endsWith("/") ? basePath.substring(0, basePath.length() - 1) : basePath;
    if (!"/".equals(normalizedBasePath)
        && !normalizedBasePath.isEmpty()
        && requestUri.startsWith(normalizedBasePath)) {
      return requestUri.substring(normalizedBasePath.length());
    }
    return requestUri;
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
  boolean isSpaRoute(String requestUri) {
    // Remove base path if present
    String pathToCheck = requestUri;
    String normalizedBasePath =
        basePath.endsWith("/") ? basePath.substring(0, basePath.length() - 1) : basePath;

    if (!"/".equals(normalizedBasePath)
        && !normalizedBasePath.isEmpty()
        && requestUri.startsWith(normalizedBasePath)) {
      pathToCheck = requestUri.substring(normalizedBasePath.length());
    }

    // API and OpenAPI routes should never be rewritten to index.html
    if (pathToCheck.startsWith("/api/") || pathToCheck.startsWith("/openapi")) {
      return false;
    }

    // Known static resource directories should not be rewritten.
    if (pathToCheck.startsWith("/assets/")
        || pathToCheck.startsWith("/images/")
        || pathToCheck.startsWith("/favicons/")) {
      return false;
    }

    String fileName = pathToCheck.substring(pathToCheck.lastIndexOf('/') + 1);
    if (fileName.isEmpty()) {
      return true;
    }

    int dotIndex = fileName.lastIndexOf('.');
    if (dotIndex <= 0 || dotIndex == fileName.length() - 1) {
      return true;
    }

    String extension = fileName.substring(dotIndex + 1).toLowerCase();
    return !STATIC_FILE_EXTENSIONS.contains(extension);
  }
}

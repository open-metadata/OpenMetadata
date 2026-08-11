package org.openmetadata.service.resources.system;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.Context;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.Base64;
import java.util.concurrent.ConcurrentHashMap;
import java.util.stream.Collectors;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.text.StringEscapeUtils;
import org.openmetadata.schema.configuration.SentryConfiguration;
import org.openmetadata.service.OpenMetadataApplicationConfig;
import org.openmetadata.service.resources.version.VersionResource;
import org.openmetadata.service.security.CspNonceHandler;

@Slf4j
@Path("/")
public class IndexResource {
  private static volatile String configProcessedHtml;
  private static volatile String configuredBasePath = "/";

  // ETag is computed from the body BEFORE the per-request cspNonce substitution and cached
  // per-basePath (the basePath rarely changes within a process). The map keeps the ETag and
  // the corresponding stable HTML together so a hit can answer 304 without re-rendering.
  // Bounded to a handful of entries in practice — there's typically one configured basePath.
  private static final ConcurrentHashMap<String, EtagCacheEntry> ETAG_CACHE =
      new ConcurrentHashMap<>();

  private record EtagCacheEntry(String etag, String stableHtml) {}

  public static void initialize(OpenMetadataApplicationConfig catalogConfig) {
    String rawIndexHtml;
    try (InputStream inputStream = IndexResource.class.getResourceAsStream("/assets/index.html")) {
      if (inputStream == null) {
        LOG.warn("UI assets not found on classpath. Running in no-ui mode.");
        return;
      }
      rawIndexHtml =
          new BufferedReader(new InputStreamReader(inputStream, StandardCharsets.UTF_8))
              .lines()
              .collect(Collectors.joining("\n"));
    } catch (IOException e) {
      throw new IllegalStateException("Failed to load /assets/index.html", e);
    }

    String basePath = catalogConfig.getBasePath();
    configuredBasePath = (basePath != null && !basePath.isEmpty()) ? basePath : "/";
    SentryConfiguration sentryConfig = catalogConfig.getSentryConfiguration();
    String clusterName = catalogConfig.getClusterName();
    configProcessedHtml =
        rawIndexHtml
            .replace("${sentryEnabled}", String.valueOf(sentryConfig.getEnabled()))
            .replace("${sentryDsn}", escapeJs(sentryConfig.getUiDsn()))
            .replace("${sentryEnvironment}", escapeJs(sentryConfig.getEnvironment()))
            .replace(
                "${sentryTraceSampleRate}",
                escapeJs(String.valueOf(sentryConfig.getTracesSampleRate())))
            .replace("${clusterName}", escapeJs(clusterName != null ? clusterName : "openmetadata"))
            .replace(
                "${appVersion}", escapeJs(new VersionResource().getCatalogVersion().getVersion()));
    // Re-init may bake new values into the template — drop any cached ETags so the next
    // request computes a fresh hash against the new body.
    ETAG_CACHE.clear();
  }

  private static String escapeJs(String value) {
    if (value == null) {
      return "";
    }
    return StringEscapeUtils.escapeEcmaScript(value);
  }

  public static String getIndexFile(String basePath) {
    String html = configProcessedHtml;
    if (html == null) {
      throw new IllegalStateException("IndexResource not initialized. Call initialize() first.");
    }

    LOG.debug("IndexResource.getIndexFile called with basePath: [{}]", basePath);
    return html.replace("${basePath}", basePath);
  }

  public static String getIndexFile(String basePath, String cspNonce) {
    String html = getIndexFile(basePath);
    if (cspNonce != null && !cspNonce.isEmpty()) {
      html = html.replace("${cspNonce}", cspNonce);
    }
    return html;
  }

  /**
   * Strong ETag derived from the body <i>before</i> per-request {@code cspNonce} substitution.
   *
   * <p>The body is otherwise stable across requests in a running process — every dynamic value
   * gets baked in at {@link #initialize}. So a SHA-1 of {@code getIndexFile(basePath)} uniquely
   * identifies the deployed bundle's shell, and the same ETag will match between two requests
   * unless the server was redeployed in between.
   *
   * <p>Callers must NOT 304 the response when a cspNonce is being substituted into the body —
   * each request's nonce is different, so the cached body's stale nonce would be rejected by
   * the CSP header. The asset servlet enforces this guard.
   */
  public static String getIndexEtag(String basePath) {
    String key = basePath == null ? "/" : basePath;
    EtagCacheEntry cached = ETAG_CACHE.get(key);
    String stableHtml = getIndexFile(basePath);
    if (cached != null && cached.stableHtml.equals(stableHtml)) {
      return cached.etag;
    }
    String etag = computeEtag(stableHtml);
    ETAG_CACHE.put(key, new EtagCacheEntry(etag, stableHtml));
    return etag;
  }

  private static String computeEtag(String body) {
    try {
      MessageDigest sha1 = MessageDigest.getInstance("SHA-1");
      byte[] digest = sha1.digest(body.getBytes(StandardCharsets.UTF_8));
      // Strong ETag format per RFC 7232. Base64url keeps the value short (~28 chars).
      return "\"" + Base64.getUrlEncoder().withoutPadding().encodeToString(digest) + "\"";
    } catch (NoSuchAlgorithmException e) {
      // SHA-1 is mandated by every JRE; reaching here means the platform is fundamentally
      // broken. Surface immediately rather than degrade silently.
      throw new IllegalStateException("SHA-1 not available", e);
    }
  }

  /**
   * Drops cached ETag entries — used by tests and after {@link #initialize} so a re-init in
   * the same process picks up the fresh template hash.
   */
  static void clearEtagCacheForTesting() {
    ETAG_CACHE.clear();
  }

  @GET
  @Produces(MediaType.TEXT_HTML)
  public Response getIndex(@Context HttpServletRequest request) {
    final String cspNonce = (String) request.getAttribute(CspNonceHandler.CSP_NONCE_ATTRIBUTE);
    return Response.ok(getIndexFile(configuredBasePath, cspNonce)).build();
  }
}

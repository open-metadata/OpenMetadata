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
import java.util.stream.Collectors;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.text.StringEscapeUtils;
import org.openmetadata.service.resources.version.VersionResource;
import org.openmetadata.service.security.CspNonceHandler;

@Slf4j
@Path("/")
public class IndexResource {
  private static final String RAW_INDEX_HTML;
  private static final String CONFIG_PROCESSED_HTML;

  static {
    try (InputStream inputStream = IndexResource.class.getResourceAsStream("/assets/index.html")) {
      if (inputStream == null) {
        throw new IllegalStateException("Missing required resource: /assets/index.html");
      }
      RAW_INDEX_HTML =
          new BufferedReader(new InputStreamReader(inputStream, StandardCharsets.UTF_8))
              .lines()
              .collect(Collectors.joining("\n"));
    } catch (IOException e) {
      throw new IllegalStateException("Failed to load /assets/index.html", e);
    }

    CONFIG_PROCESSED_HTML =
        RAW_INDEX_HTML
            .replace("${sentryDsn}", escapeJs(System.getenv().getOrDefault("SENTRY_UI_DSN", "")))
            .replace(
                "${sentryEnvironment}",
                escapeJs(System.getenv().getOrDefault("SENTRY_ENVIRONMENT", "development")))
            .replace(
                "${sentryTraceSampleRate}",
                escapeJs(System.getenv().getOrDefault("SENTRY_TRACE_SAMPLE_RATE", "0.5")))
            .replace(
                "${clusterName}",
                escapeJs(System.getenv().getOrDefault("OPENMETADATA_CLUSTER_NAME", "openmetadata")))
            .replace(
                "${appVersion}", escapeJs(new VersionResource().getCatalogVersion().getVersion()));
  }

  private static String escapeJs(String value) {
    if (value == null) {
      return "";
    }
    return StringEscapeUtils.escapeEcmaScript(value);
  }

  public static String getIndexFile(String basePath) {
    LOG.debug("IndexResource.getIndexFile called with basePath: [{}]", basePath);

    return CONFIG_PROCESSED_HTML.replace("${basePath}", basePath);
  }

  public static String getIndexFile(String basePath, String cspNonce) {
    String html = getIndexFile(basePath);
    if (cspNonce != null && !cspNonce.isEmpty()) {
      html = html.replace("${cspNonce}", cspNonce);
    }
    return html;
  }

  @GET
  @Produces(MediaType.TEXT_HTML)
  public Response getIndex(@Context HttpServletRequest request) {
    final String cspNonce = (String) request.getAttribute(CspNonceHandler.CSP_NONCE_ATTRIBUTE);
    return Response.ok(getIndexFile("/", cspNonce)).build();
  }
}

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
import org.openmetadata.schema.configuration.SentryConfiguration;
import org.openmetadata.service.OpenMetadataApplicationConfig;
import org.openmetadata.service.resources.version.VersionResource;
import org.openmetadata.service.security.CspNonceHandler;

@Slf4j
@Path("/")
public class IndexResource {
  private static volatile String configProcessedHtml;
  private static volatile String configuredBasePath = "/";

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

  @GET
  @Produces(MediaType.TEXT_HTML)
  public Response getIndex(@Context HttpServletRequest request) {
    final String cspNonce = (String) request.getAttribute(CspNonceHandler.CSP_NONCE_ATTRIBUTE);
    return Response.ok(getIndexFile(configuredBasePath, cspNonce)).build();
  }
}

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
import org.openmetadata.service.OpenMetadataApplicationConfig;
import org.openmetadata.service.security.CspNonceHandler;

@Slf4j
@Path("/")
public class IndexResource {
  private static final String RAW_INDEX_HTML;

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
  }

  private String indexHtml;

  public IndexResource() {
    indexHtml = RAW_INDEX_HTML;
  }

  public void initialize(OpenMetadataApplicationConfig config) {
    this.indexHtml = this.indexHtml.replace("${basePath}", config.getBasePath());
  }

  public static String getIndexFile(String basePath) {
    LOG.debug("IndexResource.getIndexFile called with basePath: [{}]", basePath);

    String result = RAW_INDEX_HTML.replace("${basePath}", basePath);
    String basePathLine =
        result
            .lines()
            .filter(line -> line.contains("window.BASE_PATH"))
            .findFirst()
            .orElse("NOT FOUND");
    LOG.debug("After replacement, window.BASE_PATH line: {}", basePathLine.trim());

    return result;
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
    String html = indexHtml;
    if (cspNonce != null && !cspNonce.isEmpty()) {
      html = html.replace("${cspNonce}", cspNonce);
    }
    return Response.ok(html).build();
  }
}

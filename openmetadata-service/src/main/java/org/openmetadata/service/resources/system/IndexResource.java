package org.openmetadata.service.resources.system;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.Context;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import java.io.BufferedReader;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.util.stream.Collectors;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.service.OpenMetadataApplicationConfig;
import org.openmetadata.service.security.CspNonceHandler;

@Slf4j
@Path("/")
public class IndexResource {
  private String indexHtml;

  public IndexResource() {
    InputStream inputStream = getClass().getResourceAsStream("/assets/index.html");
    indexHtml =
        new BufferedReader(new InputStreamReader(inputStream))
            .lines()
            .collect(Collectors.joining("\n"));
  }

  public void initialize(OpenMetadataApplicationConfig config) {
    this.indexHtml = this.indexHtml.replace("${basePath}", config.getBasePath());
  }

  public static String getIndexFile(String basePath) {
    LOG.info("IndexResource.getIndexFile called with basePath: [{}]", basePath);

    InputStream inputStream = IndexResource.class.getResourceAsStream("/assets/index.html");
    String indexHtml =
        new BufferedReader(new InputStreamReader(inputStream))
            .lines()
            .collect(Collectors.joining("\n"));

    String result = indexHtml.replace("${basePath}", basePath);
    String basePathLine =
        result
            .lines()
            .filter(line -> line.contains("window.BASE_PATH"))
            .findFirst()
            .orElse("NOT FOUND");
    LOG.info("After replacement, window.BASE_PATH line: {}", basePathLine.trim());

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

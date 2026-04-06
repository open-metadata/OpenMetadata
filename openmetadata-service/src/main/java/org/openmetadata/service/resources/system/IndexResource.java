package org.openmetadata.service.resources.system;

import jakarta.ws.rs.GET;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import java.io.BufferedReader;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.util.stream.Collectors;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.service.OpenMetadataApplicationConfig;

@Slf4j
@Path("/")
public class IndexResource {
  private String indexHtml;

  public IndexResource() {
    try (InputStream inputStream = getClass().getResourceAsStream("/assets/index.html")) {
      if (inputStream == null) {
        throw new IllegalStateException("Resource /assets/index.html not found on classpath");
      }
      try (BufferedReader reader =
          new BufferedReader(new InputStreamReader(inputStream, StandardCharsets.UTF_8))) {
        indexHtml = reader.lines().collect(Collectors.joining("\n"));
      }
    } catch (java.io.IOException e) {
      throw new IllegalStateException("Failed to read /assets/index.html", e);
    }
  }

  public void initialize(OpenMetadataApplicationConfig config) {
    this.indexHtml = this.indexHtml.replace("${basePath}", config.getBasePath());
  }

  public static String getIndexFile(String basePath) {
    LOG.info("IndexResource.getIndexFile called with basePath: [{}]", basePath);

    String indexHtml;
    try (InputStream inputStream = IndexResource.class.getResourceAsStream("/assets/index.html")) {
      if (inputStream == null) {
        throw new IllegalStateException("Resource /assets/index.html not found on classpath");
      }
      try (BufferedReader reader =
          new BufferedReader(new InputStreamReader(inputStream, StandardCharsets.UTF_8))) {
        indexHtml = reader.lines().collect(Collectors.joining("\n"));
      }
    } catch (java.io.IOException e) {
      throw new IllegalStateException("Failed to read /assets/index.html", e);
    }

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

  @GET
  @Produces(MediaType.TEXT_HTML)
  public Response getIndex() {
    return Response.ok(indexHtml).build();
  }
}

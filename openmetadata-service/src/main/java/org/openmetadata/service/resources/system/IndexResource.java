package org.openmetadata.service.resources.system;

import java.io.BufferedReader;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.util.stream.Collectors;
import javax.ws.rs.GET;
import javax.ws.rs.Path;
import javax.ws.rs.Produces;
import javax.ws.rs.core.MediaType;
import javax.ws.rs.core.Response;
import org.openmetadata.service.OpenMetadataApplicationConfig;

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

    InputStream inputStream = IndexResource.class.getResourceAsStream("/assets/index.html");
    String indexHtml =
        new BufferedReader(new InputStreamReader(inputStream))
            .lines()
            .collect(Collectors.joining("\n"));

    return indexHtml.replace("${basePath}", basePath);
  }

  @GET
  @Produces(MediaType.TEXT_HTML)
  public Response getIndex() {
    return Response.ok(indexHtml).build();
  }
}

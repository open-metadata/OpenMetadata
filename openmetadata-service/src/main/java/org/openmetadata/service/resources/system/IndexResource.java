package org.openmetadata.service.resources.system;

import jakarta.ws.rs.GET;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import java.io.BufferedReader;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.util.stream.Collectors;
import org.openmetadata.service.OpenMetadataApplicationConfig;
import org.openmetadata.service.util.UIUtils;

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
    // Use utility method to format basePath for UI assets
    String basePath = UIUtils.formatBasePathForUI(config.getBasePath());
    this.indexHtml = this.indexHtml.replace("${basePath}", basePath);
  }

  public static String getIndexFile(String basePath) {

    InputStream inputStream = IndexResource.class.getResourceAsStream("/assets/index.html");
    String indexHtml =
        new BufferedReader(new InputStreamReader(inputStream))
            .lines()
            .collect(Collectors.joining("\n"));

    // Use utility method to format basePath for UI assets  
    String formattedBasePath = UIUtils.formatBasePathForUI(basePath);
    return indexHtml.replace("${basePath}", formattedBasePath);
  }

  @GET
  @Produces(MediaType.TEXT_HTML)
  public Response getIndex() {
    return Response.ok(indexHtml).build();
  }
}

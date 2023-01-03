package org.openmetadata.service.socket;

import io.dropwizard.servlets.assets.AssetServlet;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import javax.servlet.ServletException;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import org.jetbrains.annotations.Nullable;

public class OpenMetadataAssetServlet extends AssetServlet {

  public OpenMetadataAssetServlet(String resourcePath, String uriPath, @Nullable String indexFile) {
    super(resourcePath, uriPath, indexFile, "text/html", StandardCharsets.UTF_8);
  }

  @Override
  protected void doGet(HttpServletRequest req, HttpServletResponse resp) throws ServletException, IOException {
    super.doGet(req, resp);
    if (!resp.isCommitted() && (resp.getStatus() == 404)) {
      resp.sendError(404);
    }
  }
}

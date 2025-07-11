package org.openmetadata.service.security;

import java.io.IOException;
import javax.annotation.Priority;
import javax.ws.rs.container.ContainerRequestContext;
import javax.ws.rs.container.ContainerRequestFilter;
import javax.ws.rs.core.HttpHeaders;
import javax.ws.rs.ext.Provider;
import lombok.extern.slf4j.Slf4j;

@Provider
@Priority(1000)
@Slf4j
public class ETagRequestFilter implements ContainerRequestFilter {
  
  public static final String ETAG_IF_MATCH_HEADER = "X-OpenMetadata-If-Match";

  @Override
  public void filter(ContainerRequestContext requestContext) throws IOException {
    String ifMatch = requestContext.getHeaderString(HttpHeaders.IF_MATCH);
    
    if (ifMatch != null && !ifMatch.isEmpty()) {
      requestContext.setProperty(ETAG_IF_MATCH_HEADER, ifMatch);
      LOG.debug("Extracted If-Match header: {} for {} {}", 
          ifMatch, requestContext.getMethod(), requestContext.getUriInfo().getPath());
    }
  }
}
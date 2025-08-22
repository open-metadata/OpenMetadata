package org.openmetadata.service.security;

import jakarta.ws.rs.container.ContainerRequestContext;
import jakarta.ws.rs.container.ContainerRequestFilter;
import java.io.IOException;

public class DelegatingContainerRequestFilter implements ContainerRequestFilter {

  @Override
  public void filter(ContainerRequestContext requestContext) throws IOException {
    ContainerRequestFilter currentFilter = ContainerRequestFilterManager.getInstance().getFilter();
    if (currentFilter != null) {
      currentFilter.filter(requestContext);
    }
  }
}

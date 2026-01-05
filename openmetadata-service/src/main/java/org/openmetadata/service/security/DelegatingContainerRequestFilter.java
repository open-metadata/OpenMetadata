package org.openmetadata.service.security;

import jakarta.annotation.Priority;
import jakarta.ws.rs.Priorities;
import jakarta.ws.rs.container.ContainerRequestContext;
import jakarta.ws.rs.container.ContainerRequestFilter;
import jakarta.ws.rs.ext.Provider;
import java.io.IOException;

@Provider
@Priority(Priorities.AUTHENTICATION)
public class DelegatingContainerRequestFilter implements ContainerRequestFilter {

  @Override
  public void filter(ContainerRequestContext requestContext) throws IOException {
    ContainerRequestFilter currentFilter = ContainerRequestFilterManager.getInstance().getFilter();
    if (currentFilter != null) {
      currentFilter.filter(requestContext);
    }
  }
}

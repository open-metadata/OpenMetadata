package org.openmetadata.service.security;

import jakarta.ws.rs.container.ContainerRequestFilter;
import java.util.concurrent.atomic.AtomicReference;

public class ContainerRequestFilterManager {
  private static final ContainerRequestFilterManager INSTANCE = new ContainerRequestFilterManager();
  private final AtomicReference<ContainerRequestFilter> currentFilter = new AtomicReference<>();

  private ContainerRequestFilterManager() {}

  public static ContainerRequestFilterManager getInstance() {
    return INSTANCE;
  }

  public void registerFilter(ContainerRequestFilter filter) {
    currentFilter.set(filter);
  }

  public ContainerRequestFilter getFilter() {
    return currentFilter.get();
  }

  public void updateFilter(ContainerRequestFilter newFilter) {
    currentFilter.set(newFilter);
  }
}

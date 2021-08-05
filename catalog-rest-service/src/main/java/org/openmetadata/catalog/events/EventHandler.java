package org.openmetadata.catalog.events;

import org.openmetadata.catalog.CatalogApplicationConfig;
import org.skife.jdbi.v2.DBI;

import javax.ws.rs.container.ContainerRequestContext;
import javax.ws.rs.container.ContainerResponseContext;

public interface EventHandler {
  void init(CatalogApplicationConfig config, DBI jdbi);
  Void process(ContainerRequestContext requestContext, ContainerResponseContext responseContext);
  void close();
}

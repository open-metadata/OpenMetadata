package org.openmetadata.service.security;

import java.io.IOException;
import javax.annotation.Priority;
import javax.ws.rs.container.ContainerRequestContext;
import javax.ws.rs.container.ContainerResponseContext;
import javax.ws.rs.container.ContainerResponseFilter;
import javax.ws.rs.core.EntityTag;
import javax.ws.rs.core.HttpHeaders;
import javax.ws.rs.ext.Provider;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.service.util.EntityETag;

@Provider
@Priority(1000)
@Slf4j
public class ETagResponseFilter implements ContainerResponseFilter {

  @Override
  public void filter(ContainerRequestContext requestContext, ContainerResponseContext responseContext)
      throws IOException {
    
    if (shouldAddETag(requestContext, responseContext)) {
      Object entity = responseContext.getEntity();
      
      if (entity instanceof EntityInterface) {
        try {
          EntityTag etag = EntityETag.generateETag((EntityInterface) entity);
          responseContext.getHeaders().putSingle(HttpHeaders.ETAG, etag.toString());
          LOG.debug("Added ETag header: {} for entity: {}", etag, ((EntityInterface) entity).getId());
        } catch (Exception e) {
          LOG.warn("Failed to generate ETag for entity: {}", ((EntityInterface) entity).getId(), e);
        }
      }
    }
  }

  private boolean shouldAddETag(ContainerRequestContext requestContext, ContainerResponseContext responseContext) {
    String method = requestContext.getMethod();
    int status = responseContext.getStatus();
    
    boolean isGetMethod = "GET".equals(method);
    boolean isSuccessfulResponse = status >= 200 && status < 300;
    
    return isGetMethod && isSuccessfulResponse;
  }
}